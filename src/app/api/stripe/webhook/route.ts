import { NextResponse } from "next/server";
import { getStripe, isStripeConfigured } from "@/lib/payments/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";
import { captureError, log } from "@/lib/observability/logger";
import { reverseBookingPayout, payoutAmountCents } from "@/lib/payments/payouts";

// ============================================================
// Stripe webhook — the SOURCE OF TRUTH for payment state (not the browser).
//
// Correctness guarantees:
//  • Signature-verified (STRIPE_WEBHOOK_SECRET).
//  • Exactly-once: every event id is inserted into stripe_events first; a
//    duplicate/retried event conflicts and is acknowledged without re-applying.
//  • Idempotent side effects: status guards + upserts keyed on the payment
//    intent, so out-of-order or repeated deliveries converge to the same state.
//  • Returns 200 on handled/duplicate, 500 only on genuine failure (so Stripe
//    retries a transient error but not a duplicate).
// ============================================================

type Admin = ReturnType<typeof createAdminClient>;

export async function POST(req: Request) {
  if (!isStripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const body = await req.text();
  let event: { id: string; type: string; data: { object: unknown } };
  try {
    const stripe = await getStripe();
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (!isLiveSupabase()) return NextResponse.json({ received: true, note: "no db" });
  const admin = createAdminClient();

  // Exactly-once gate: record the event id first. Conflict = already handled.
  const { error: dedupErr } = await admin.from("stripe_events").insert({ id: event.id, type: event.type });
  if (dedupErr) {
    // Unique-violation → duplicate delivery. Any other error → let Stripe retry.
    if (dedupErr.code === "23505") return NextResponse.json({ received: true, duplicate: true });
    captureError(dedupErr, { where: "stripe_events.insert", event: event.type });
    return NextResponse.json({ error: "dedup failed" }, { status: 500 });
  }

  try {
    await handleEvent(admin, event);
    return NextResponse.json({ received: true });
  } catch (err) {
    // Roll back the dedup marker so Stripe's retry can re-attempt processing.
    await admin.from("stripe_events").delete().eq("id", event.id);
    captureError(err, { where: "stripe.handleEvent", event: event.type });
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}

async function handleEvent(admin: Admin, event: { type: string; data: { object: unknown } }) {
  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object as { id: string; metadata?: { bookingId?: string }; amount?: number };
      const bookingId = pi.metadata?.bookingId;
      if (!bookingId) return;

      await admin.from("payments").upsert(
        { booking_id: bookingId, status: "succeeded", amount_cents: pi.amount ?? 0, stripe_payment_intent_id: pi.id },
        { onConflict: "stripe_payment_intent_id" },
      );
      // Only confirm if still pending (guards out-of-order / late delivery).
      const { data: b } = await admin
        .from("bookings")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString(), stripe_payment_intent_id: pi.id })
        .eq("id", bookingId)
        .eq("status", "pending_payment")
        .select("professional_id, total_cents, platform_fee_cents")
        .maybeSingle();
      await admin.from("booking_status_events").insert({ booking_id: bookingId, status: "confirmed", note: "Payment succeeded (webhook)" });
      await admin.from("conversations").update({ is_unlocked: true }).eq("booking_id", bookingId);

      // Record the provider's pending earning (idempotent via unique(booking_id,kind)).
      const row = b as { professional_id?: string; total_cents?: number; platform_fee_cents?: number } | null;
      if (row?.professional_id) {
        const netCents = payoutAmountCents(row.total_cents ?? 0, row.platform_fee_cents ?? 0);
        await admin.from("earnings_ledger").upsert(
          {
            professional_id: row.professional_id,
            booking_id: bookingId,
            kind: "earning",
            amount_cents: netCents,
            status: "pending",
          },
          { onConflict: "booking_id,kind" },
        );
        // Payout is DEFERRED to service completion (the remaining balance is
        // captured then). The deposit is held by the platform now — we only record
        // the pending earning here and never transfer at deposit time (which would
        // over-pay, since only the deposit has been collected).
        log.info("webhook.deposit_collected", { bookingId, netCents });
      }
      log.info("webhook.payment_succeeded", { bookingId });
      return;
    }

    case "payment_intent.payment_failed": {
      const pi = event.data.object as { id: string; metadata?: { bookingId?: string } };
      await admin.from("payments").upsert(
        { status: "failed", stripe_payment_intent_id: pi.id, amount_cents: 0, booking_id: pi.metadata?.bookingId ?? null },
        { onConflict: "stripe_payment_intent_id" },
      );
      return;
    }

    case "payment_intent.canceled": {
      const pi = event.data.object as { metadata?: { bookingId?: string } };
      const bookingId = pi.metadata?.bookingId;
      if (!bookingId) return;
      await admin.from("bookings").update({ status: "cancelled_customer", cancelled_at: new Date().toISOString(), cancellation_reason: "Checkout expired/cancelled" }).eq("id", bookingId).eq("status", "pending_payment");
      return;
    }

    case "charge.refunded": {
      const charge = event.data.object as {
        payment_intent?: string;
        amount?: number;
        amount_refunded?: number;
        refunded?: boolean;
      };
      if (!charge.payment_intent) return;
      const { data: payment } = await admin.from("payments").select("booking_id").eq("stripe_payment_intent_id", charge.payment_intent).maybeSingle();
      const bookingId = (payment as { booking_id?: string } | null)?.booking_id;
      if (!bookingId) return;
      // Stripe sets `refunded: true` only when the charge is fully refunded; for a
      // partial refund it's false and amount_refunded < amount. Never assume full.
      const fullyRefunded =
        charge.refunded === true ||
        (charge.amount != null && charge.amount_refunded != null && charge.amount_refunded >= charge.amount);
      await admin.from("payments").update({ status: fullyRefunded ? "refunded" : "partially_refunded" }).eq("stripe_payment_intent_id", charge.payment_intent);
      const { data: bk } = await admin.from("bookings").select("professional_id").eq("id", bookingId).maybeSingle();
      const proId = (bk as { professional_id?: string } | null)?.professional_id;
      if (proId) {
        await admin.from("earnings_ledger").upsert(
          { professional_id: proId, booking_id: bookingId, kind: "refund_adjustment", amount_cents: -(charge.amount_refunded ?? 0), status: "available" },
          { onConflict: "booking_id,kind" },
        );
      }
      // Claw back the pro's payout proportional to the refund (reverses the transfer).
      await reverseBookingPayout(admin, { bookingId, refundedCents: charge.amount_refunded ?? 0 });
      log.info("webhook.charge_refunded", { bookingId, fullyRefunded });
      return;
    }

    default:
      // Acknowledge unhandled events so Stripe stops retrying them.
      return;
  }
}
