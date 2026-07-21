import "server-only";
// Stripe Connect payouts — separate charges + transfers.
//
// Money flow: the customer's charge lands on the PLATFORM account (the platform
// keeps its commission), then a Transfer moves the professional's NET earning to
// their connected account. Refunds reverse the transfer proportionally.
//
// Guarantees:
//  • Idempotent per booking — payout_transfers.unique(booking_id) + a Stripe
//    idempotency key (`payout_<bookingId>`), so webhook retries never double-pay.
//  • Best-effort inside the webhook — failures are recorded (status='failed') and
//    never throw, so a payout hiccup can't block booking confirmation. A retry
//    action (or reconciliation) settles failed/pending payouts later.
import { getStripe } from "./stripe";
import { payoutAmountCents } from "./split";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

// Re-export the pure split helper so callers can keep importing it from here.
export { payoutAmountCents };

export type PayoutOutcome =
  | { status: "paid"; transferId: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

/** Transfer the professional's net earning to their connected account. */
export async function transferBookingPayout(
  admin: Admin,
  args: { bookingId: string; professionalId: string; netCents: number },
): Promise<PayoutOutcome> {
  const { bookingId, professionalId, netCents } = args;
  if (netCents <= 0) return { status: "skipped", reason: "zero_net" };

  // Idempotency guard — a paid/pending transfer already exists for this booking.
  const { data: existing } = await admin
    .from("payout_transfers")
    .select("status, stripe_transfer_id")
    .eq("booking_id", bookingId)
    .maybeSingle();
  const ex = existing as { status: string; stripe_transfer_id: string | null } | null;
  if (ex && (ex.status === "paid" || ex.status === "reversed")) {
    return { status: "skipped", reason: "already_transferred" };
  }

  // The pro must have a payout-eligible connected account.
  const { data: pro } = await admin
    .from("professional_profiles")
    .select("stripe_account_id, connect_payouts_enabled, payouts_frozen")
    .eq("user_id", professionalId)
    .maybeSingle();
  const p = pro as
    | { stripe_account_id?: string; connect_payouts_enabled?: boolean; payouts_frozen?: boolean }
    | null;
  if (!p?.stripe_account_id || !p.connect_payouts_enabled || p.payouts_frozen) {
    // Not eligible yet — keep the earning pending; a later retry pays it out once
    // the pro finishes Connect onboarding.
    await admin.from("payout_transfers").upsert(
      {
        booking_id: bookingId,
        professional_id: professionalId,
        amount_cents: netCents,
        status: "pending",
        failure_reason: "connect_not_ready",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "booking_id" },
    );
    return { status: "skipped", reason: "connect_not_ready" };
  }

  try {
    const stripe = await getStripe();
    const transfer = await stripe.transfers.create(
      {
        amount: netCents,
        currency: "usd",
        destination: p.stripe_account_id,
        transfer_group: bookingId,
        metadata: { bookingId, professionalId },
      },
      { idempotencyKey: `payout_${bookingId}` },
    );
    await admin.from("payout_transfers").upsert(
      {
        booking_id: bookingId,
        professional_id: professionalId,
        stripe_transfer_id: transfer.id,
        amount_cents: netCents,
        status: "paid",
        failure_reason: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "booking_id" },
    );
    // The earning is now settled to the pro's Stripe balance.
    await admin
      .from("earnings_ledger")
      .update({ status: "paid" })
      .eq("booking_id", bookingId)
      .eq("kind", "earning");
    return { status: "paid", transferId: transfer.id };
  } catch (e) {
    const reason = e instanceof Error ? e.message : "transfer_failed";
    await admin.from("payout_transfers").upsert(
      {
        booking_id: bookingId,
        professional_id: professionalId,
        amount_cents: netCents,
        status: "failed",
        failure_reason: reason,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "booking_id" },
    );
    return { status: "failed", reason };
  }
}

/** Claw back a payout when a booking is refunded (proportional reversal). */
export async function reverseBookingPayout(
  admin: Admin,
  args: { bookingId: string; refundedCents: number },
): Promise<void> {
  const { data } = await admin
    .from("payout_transfers")
    .select("stripe_transfer_id, amount_cents, status")
    .eq("booking_id", args.bookingId)
    .maybeSingle();
  const row = data as { stripe_transfer_id?: string; amount_cents?: number; status?: string } | null;
  if (!row?.stripe_transfer_id || row.status === "reversed") return;
  const reverseCents = Math.min(Math.max(0, Math.round(args.refundedCents)), row.amount_cents ?? 0);
  if (reverseCents <= 0) return;
  try {
    const stripe = await getStripe();
    await stripe.transfers.createReversal(
      row.stripe_transfer_id,
      { amount: reverseCents },
      { idempotencyKey: `reverse_${args.bookingId}_${reverseCents}` },
    );
    const fully = reverseCents >= (row.amount_cents ?? 0);
    await admin
      .from("payout_transfers")
      .update({ status: fully ? "reversed" : "paid", updated_at: new Date().toISOString() })
      .eq("booking_id", args.bookingId);
  } catch {
    // Best-effort; reconciliation / retry can re-attempt.
  }
}
