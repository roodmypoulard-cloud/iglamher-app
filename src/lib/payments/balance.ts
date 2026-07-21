import "server-only";
// Day-of balance hold + capture. The deposit is captured and the card saved at
// booking. When the pro starts the job we AUTHORIZE (hold) the remaining balance
// on the saved card to confirm the funds are there; at completion we CAPTURE it.
// Real money moves only on capture. Every step is idempotent + guarded.
import { getStripe } from "./stripe";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

type BookingPay = {
  id: string;
  total_cents: number;
  amount_due_now_cents: number;
  platform_fee_cents: number;
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
  balance_hold_pi_id: string | null;
  balance_status: string;
};

async function loadBooking(admin: Admin, bookingId: string): Promise<BookingPay | null> {
  const { data } = await admin
    .from("bookings")
    .select("id, total_cents, amount_due_now_cents, platform_fee_cents, stripe_customer_id, stripe_payment_method_id, balance_hold_pi_id, balance_status")
    .eq("id", bookingId)
    .maybeSingle();
  return (data as BookingPay | null) ?? null;
}

export type HoldOutcome = { ok: true; status: "held" | "no_balance" } | { ok: false; error: string };

/** Authorize (hold) the remaining balance on the customer's saved card. */
export async function holdBookingBalance(admin: Admin, bookingId: string): Promise<HoldOutcome> {
  const b = await loadBooking(admin, bookingId);
  if (!b) return { ok: false, error: "Booking not found." };
  if (b.balance_status === "held" || b.balance_status === "captured") return { ok: true, status: "held" };

  const balanceCents = Math.max(0, (b.total_cents ?? 0) - (b.amount_due_now_cents ?? 0));
  if (balanceCents <= 0) {
    await admin.from("bookings").update({ balance_cents: 0, balance_status: "captured" }).eq("id", bookingId);
    return { ok: true, status: "no_balance" };
  }
  if (!b.stripe_customer_id || !b.stripe_payment_method_id) {
    return { ok: false, error: "No saved card on file for this booking." };
  }

  try {
    const stripe = await getStripe();
    const pi = await stripe.paymentIntents.create(
      {
        amount: balanceCents,
        currency: "usd",
        customer: b.stripe_customer_id,
        payment_method: b.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        capture_method: "manual", // authorize only — funds held, not captured
        metadata: { bookingId, kind: "balance_hold" },
      },
      { idempotencyKey: `hold_${bookingId}` },
    );
    if (pi.status !== "requires_capture") {
      await admin.from("bookings").update({ balance_status: "failed", balance_cents: balanceCents }).eq("id", bookingId);
      return { ok: false, error: "The card could not be authorized for the balance." };
    }
    await admin.from("bookings").update({ balance_hold_pi_id: pi.id, balance_cents: balanceCents, balance_status: "held" }).eq("id", bookingId);
    return { ok: true, status: "held" };
  } catch (e) {
    await admin.from("bookings").update({ balance_status: "failed", balance_cents: balanceCents }).eq("id", bookingId);
    const msg = e instanceof Error ? e.message : "Card authorization failed.";
    return { ok: false, error: `Couldn't authorize the customer's card for the balance: ${msg}` };
  }
}

/** Capture the held balance at completion. Returns the captured cents. */
export async function captureBookingBalance(admin: Admin, bookingId: string): Promise<{ captured: number; error?: string }> {
  const b = await loadBooking(admin, bookingId);
  if (!b) return { captured: 0, error: "Booking not found." };
  if (b.balance_status === "captured") return { captured: b.total_cents - b.amount_due_now_cents };
  if (b.balance_status !== "held" || !b.balance_hold_pi_id) return { captured: 0 };

  try {
    const stripe = await getStripe();
    const pi = await stripe.paymentIntents.capture(b.balance_hold_pi_id, undefined, { idempotencyKey: `capture_${bookingId}` });
    const captured = pi.amount_received ?? pi.amount ?? 0;
    await admin.from("bookings").update({ balance_status: "captured" }).eq("id", bookingId);
    // Record the balance payment (webhook also records it idempotently by PI id).
    await admin.from("payments").upsert(
      { booking_id: bookingId, status: "succeeded", amount_cents: captured, stripe_payment_intent_id: b.balance_hold_pi_id },
      { onConflict: "stripe_payment_intent_id" },
    );
    return { captured };
  } catch (e) {
    return { captured: 0, error: e instanceof Error ? e.message : "Balance capture failed." };
  }
}

/** Release the hold on cancellation (no capture happened). */
export async function releaseBookingBalance(admin: Admin, bookingId: string): Promise<void> {
  const b = await loadBooking(admin, bookingId);
  if (!b || b.balance_status !== "held" || !b.balance_hold_pi_id) return;
  try {
    const stripe = await getStripe();
    await stripe.paymentIntents.cancel(b.balance_hold_pi_id);
  } catch { /* already released/expired — safe to ignore */ }
  await admin.from("bookings").update({ balance_status: "released" }).eq("id", bookingId);
}
