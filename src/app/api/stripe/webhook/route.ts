import { NextResponse } from "next/server";
import { getStripe, isStripeConfigured } from "@/lib/payments/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";
import { captureError, log } from "@/lib/observability/logger";
import { reverseBookingPayout, payoutAmountCents } from "@/lib/payments/payouts";
import { ensureBookingConversationUnlocked } from "@/lib/messaging/unlock";
import { emailUserBestEffort } from "@/lib/integrations/notifications";
import { syncRecommendationSubscription, recordRecommendationInvoice } from "@/lib/payments/recommendation-subscription";

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
      const pi = event.data.object as {
        id: string; amount?: number; customer?: string | null; payment_method?: string | null;
        metadata?: { bookingId?: string; kind?: string };
      };
      const bookingId = pi.metadata?.bookingId;
      if (!bookingId) return;

      await admin.from("payments").upsert(
        { booking_id: bookingId, status: "succeeded", amount_cents: pi.amount ?? 0, stripe_payment_intent_id: pi.id },
        { onConflict: "stripe_payment_intent_id" },
      );
      // The balance capture (at completion) also fires this event — just record the
      // payment above; confirmation + payout are handled in the completion action.
      if (pi.metadata?.kind === "balance_hold") { log.info("webhook.balance_captured", { bookingId }); return; }

      // Deposit: save the customer + card for the day-of balance hold, then confirm.
      const { data: bk } = await admin.from("bookings").select("total_cents, amount_due_now_cents, customer_id, professional_id").eq("id", bookingId).maybeSingle();
      const info = bk as { total_cents?: number; amount_due_now_cents?: number; customer_id?: string; professional_id?: string } | null;
      const balanceCents = Math.max(0, (info?.total_cents ?? 0) - (info?.amount_due_now_cents ?? 0));

      // Persist the chargeable card on the booking REGARDLESS of status. The webhook
      // is the source of truth; do NOT gate PM persistence on the pending→confirmed
      // edge, or a booking already confirmed by /book/success loses its saved card.
      const cardPatch: Record<string, unknown> = {};
      if (pi.customer) cardPatch.stripe_customer_id = pi.customer;
      if (pi.payment_method) cardPatch.stripe_payment_method_id = pi.payment_method;
      if (Object.keys(cardPatch).length > 0) {
        await admin.from("bookings").update(cardPatch).eq("id", bookingId);
      }

      const { data: b } = await admin
        .from("bookings")
        .update({
          status: "confirmed", confirmed_at: new Date().toISOString(), stripe_payment_intent_id: pi.id,
          balance_cents: balanceCents,
        })
        .eq("id", bookingId)
        .eq("status", "pending_payment")
        .select("professional_id, customer_id, total_cents, platform_fee_cents")
        .maybeSingle();

      // Ensure conversation + members exist and unlock it (idempotent; runs on every
      // delivery so backfilled/trigger-less bookings still get messaging).
      await ensureBookingConversationUnlocked(admin, bookingId, info?.customer_id, info?.professional_id);

      // Record the provider's pending earning (idempotent via unique(booking_id,kind)).
      const row = b as { professional_id?: string; customer_id?: string; total_cents?: number; platform_fee_cents?: number } | null;
      // The following side effects fire ONLY on the pending→confirmed transition
      // (row is non-null only when this delivery flipped the status).
      if (row) {
        await admin.from("booking_status_events").insert({ booking_id: bookingId, status: "confirmed", note: "Payment succeeded (webhook)" });
      }
      // Booking-confirmed notifications (best-effort; only fires on the pending→confirmed transition).
      if (row?.professional_id && row?.customer_id) {
        try {
          await admin.from("notifications").insert([
            { user_id: row.customer_id, type: "booking", title: "Booking confirmed", body: "Your payment went through and your appointment is confirmed.", data: { bookingId } },
            { user_id: row.professional_id, type: "booking", title: "New booking", body: "You have a new confirmed booking.", data: { bookingId } },
          ]);
          // Mirror to email (best-effort — never blocks webhook ack).
          await emailUserBestEffort(row.customer_id, "booking", "Booking confirmed", "Your payment went through and your appointment is confirmed.");
          await emailUserBestEffort(row.professional_id, "booking", "New booking", "You have a new confirmed booking.");
        } catch { /* best-effort */ }
      }
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

    // ---- $2.99/mo Featured Recommendations subscription lifecycle ----
    // checkout.session.completed for subscriptions carries no line items here;
    // the subscription.* events that follow are the source of truth.
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as import("stripe").Stripe.Subscription;
      await syncRecommendationSubscription(admin, sub);
      return;
    }
    case "invoice.paid": {
      await recordRecommendationInvoice(admin, event.data.object as import("stripe").Stripe.Invoice, "paid");
      return;
    }
    case "invoice.payment_failed": {
      await recordRecommendationInvoice(admin, event.data.object as import("stripe").Stripe.Invoice, "failed");
      return;
    }

    default:
      // Acknowledge unhandled events so Stripe stops retrying them.
      return;
  }
}
