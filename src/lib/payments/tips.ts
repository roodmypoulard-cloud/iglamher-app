"use server";
// Customer tip after a completed booking. Charges the saved card off-session,
// idempotent (one tip per booking + Stripe idempotency key), records the tip +
// earnings, and notifies the pro. Never fakes success before Stripe confirms.
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "./stripe";
import { resolveChargeIdentity } from "./customer";
import { isLiveSupabase } from "@/lib/data/source";
import { emailUserBestEffort } from "@/lib/integrations/notifications";

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

  const admin = createAdminClient();
  const { data: existing } = await admin.from("tips").select("id").eq("booking_id", bookingId).maybeSingle();
  if (existing) return { error: "You've already added a tip for this booking." };

  // Prefer the card saved on the booking; fall back to the customer's account
  // default card (a tip is often added days later from a different surface).
  const charge = await resolveChargeIdentity(admin, {
    userId: auth.user.id,
    bookingCustomerId: b.stripe_customer_id,
    bookingPaymentMethodId: b.stripe_payment_method_id,
  });
  if (!charge) return { error: "No saved card on file to charge the tip." };

  try {
    const stripe = await getStripe();
    const pi = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: "usd",
        customer: charge.customerId,
        payment_method: charge.paymentMethodId,
        off_session: true,
        confirm: true,
        metadata: { bookingId, kind: "tip" },
      },
      { idempotencyKey: `tip_${bookingId}` },
    );
    if (pi.status !== "succeeded") return { error: "The tip couldn't be charged. Please try again." };

    // Persist the resolved card on the booking when it wasn't already saved there,
    // so later charges (or a re-tip attempt) reuse it directly.
    if (b.stripe_customer_id !== charge.customerId || b.stripe_payment_method_id !== charge.paymentMethodId) {
      await admin
        .from("bookings")
        .update({ stripe_customer_id: charge.customerId, stripe_payment_method_id: charge.paymentMethodId })
        .eq("id", bookingId);
    }

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

    // Move the tip to the pro's connected account when Connect is payout-ready.
    // Uses a DEDICATED idempotency key (tip_payout_<bookingId>) and its own Stripe
    // transfer — it must NOT reuse payout_transfers.unique(booking_id), which is
    // already owned by the booking's service payout. If Connect isn't ready the tip
    // earning stays 'pending' for later reconciliation.
    const { data: proAcct } = await admin
      .from("professional_profiles")
      .select("stripe_account_id, connect_payouts_enabled, payouts_frozen")
      .eq("user_id", b.professional_id)
      .maybeSingle();
    const acct = proAcct as { stripe_account_id?: string; connect_payouts_enabled?: boolean; payouts_frozen?: boolean } | null;
    if (acct?.stripe_account_id && acct.connect_payouts_enabled && !acct.payouts_frozen) {
      try {
        await stripe.transfers.create(
          {
            amount: amountCents,
            currency: "usd",
            destination: acct.stripe_account_id,
            transfer_group: bookingId,
            metadata: { bookingId, kind: "tip" },
          },
          { idempotencyKey: `tip_payout_${bookingId}` },
        );
        await admin
          .from("earnings_ledger")
          .update({ status: "paid" })
          .eq("booking_id", bookingId)
          .eq("kind", "tip");
      } catch { /* leave the tip earning pending; reconciliation retries the transfer */ }
    }

    await admin.from("notifications").insert({
      user_id: b.professional_id,
      type: "payout",
      title: "Tip received",
      body: `You received a $${(amountCents / 100).toFixed(2)} tip.`,
      data: { bookingId },
    });
    if (b.professional_id) await emailUserBestEffort(b.professional_id, "payout", "Tip received", `You received a $${(amountCents / 100).toFixed(2)} tip on iGlamHer.`);
  } catch (e) {
    const m = e instanceof Error ? e.message : "The tip could not be processed.";
    return { error: /card|declined|insufficient|authentication/i.test(m) ? "Your card was declined for the tip." : m };
  }

  revalidatePath(`/bookings/${bookingId}`);
  return { success: "Thank you! Your tip was sent." };
}
