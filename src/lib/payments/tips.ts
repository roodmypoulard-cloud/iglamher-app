"use server";
// Customer tip after a completed booking. Charges the saved card off-session,
// idempotent (one tip per booking + Stripe idempotency key), records the tip +
// earnings, and notifies the pro. Never fakes success before Stripe confirms.
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "./stripe";
import { isLiveSupabase } from "@/lib/data/source";

export type TipState = { error?: string; success?: string } | undefined;

export async function tipBookingAction(bookingId: string, amountCents: number): Promise<TipState> {
  if (!isLiveSupabase()) return { error: "Tips require the live backend." };
  if (!Number.isInteger(amountCents) || amountCents < 100 || amountCents > 100000) {
    return { error: "Enter a tip between $1 and $1,000." };
  }
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please sign in." };

  const { data: bk } = await supabase
    .from("bookings")
    .select("status, customer_id, professional_id, stripe_customer_id, stripe_payment_method_id")
    .eq("id", bookingId)
    .maybeSingle();
  const b = bk as
    | { status?: string; customer_id?: string; professional_id?: string; stripe_customer_id?: string | null; stripe_payment_method_id?: string | null }
    | null;
  if (!b) return { error: "Booking not found." };
  if (b.customer_id !== auth.user.id) return { error: "Only the customer can add a tip." };
  if (b.status !== "completed") return { error: "You can tip once the appointment is completed." };
  if (!b.stripe_customer_id || !b.stripe_payment_method_id) {
    return { error: "No saved card on file to charge the tip." };
  }

  const admin = createAdminClient();
  const { data: existing } = await admin.from("tips").select("id").eq("booking_id", bookingId).maybeSingle();
  if (existing) return { error: "You've already added a tip for this booking." };

  try {
    const stripe = await getStripe();
    const pi = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: "usd",
        customer: b.stripe_customer_id,
        payment_method: b.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        metadata: { bookingId, kind: "tip" },
      },
      { idempotencyKey: `tip_${bookingId}` },
    );
    if (pi.status !== "succeeded") return { error: "The tip couldn't be charged. Please try again." };

    // Record the tip (unique booking_id prevents duplicates even under retries).
    const { error: tipErr } = await admin.from("tips").insert({
      booking_id: bookingId,
      customer_id: b.customer_id,
      professional_id: b.professional_id,
      amount_cents: amountCents,
      stripe_payment_intent_id: pi.id,
      status: "succeeded",
    });
    if (tipErr && !/duplicate|unique/i.test(tipErr.message)) return { error: tipErr.message };

    // Tips go 100% to the pro.
    await admin.from("earnings_ledger").upsert(
      { professional_id: b.professional_id, booking_id: bookingId, kind: "tip", amount_cents: amountCents, status: "pending" },
      { onConflict: "booking_id,kind" },
    );
    await admin.from("notifications").insert({
      user_id: b.professional_id,
      type: "payout",
      title: "Tip received",
      body: `You received a $${(amountCents / 100).toFixed(2)} tip.`,
      data: { bookingId },
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : "The tip could not be processed.";
    return { error: /card|declined|insufficient|authentication/i.test(m) ? "Your card was declined for the tip." : m };
  }

  revalidatePath(`/bookings/${bookingId}`);
  return { success: "Thank you! Your tip was sent." };
}
