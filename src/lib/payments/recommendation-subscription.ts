import "server-only";
// $2.99/month Featured Recommendations subscription — Stripe → DB sync.
// Called ONLY from the webhook (service role). Mirrors the Stripe subscription
// into recommendation_subscriptions and keeps the professional's placement
// window (professional_profiles.recommended_until) in step with billing:
//   trialing/active -> placement runs to current_period_end + grace
//   past_due        -> existing window stands; after grace it lapses on its own
//   canceled/unpaid -> window ends with the last paid period
// Admin free-era placements (no subscription row) are never touched here.
import type Stripe from "stripe";
import type { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/observability/logger";

type Admin = ReturnType<typeof createAdminClient>;

/** Grace period after a failed renewal before placement lapses. */
const GRACE_DAYS = 3;

export function isRecommendationPrice(priceId: string | null | undefined): boolean {
  const configured = process.env.STRIPE_RECOMMEND_PRICE_ID;
  return Boolean(configured && priceId && priceId === configured);
}

function ts(unix: number | null | undefined): string | null {
  return unix ? new Date(unix * 1000).toISOString() : null;
}

/** Upsert the mirror row and sync the placement window. Idempotent. */
export async function syncRecommendationSubscription(admin: Admin, sub: Stripe.Subscription): Promise<void> {
  const priceId = sub.items.data[0]?.price?.id ?? null;
  if (!isRecommendationPrice(priceId)) return; // not our product — ignore

  const professionalId = sub.metadata?.professional_id;
  if (!professionalId) {
    log.warn("rec-sub.sync missing professional_id metadata", { sub: sub.id });
    return;
  }

  const item = sub.items.data[0];
  const periodStart = ts(item?.current_period_start ?? null);
  const periodEnd = ts(item?.current_period_end ?? null);

  await admin.from("recommendation_subscriptions").upsert(
    {
      professional_id: professionalId,
      stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null,
      stripe_subscription_id: sub.id,
      stripe_price_id: priceId,
      status: sub.status,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      cancel_at_period_end: sub.cancel_at_period_end,
      trial_start: ts(sub.trial_start),
      trial_end: ts(sub.trial_end),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "professional_id" },
  );

  // Placement window follows the paid period.
  if ((sub.status === "active" || sub.status === "trialing") && periodEnd) {
    const until = new Date(new Date(periodEnd).getTime() + GRACE_DAYS * 86_400_000).toISOString();
    await admin
      .from("professional_profiles")
      .update({ is_recommended: true, recommended_at: new Date().toISOString(), recommended_until: until })
      .eq("user_id", professionalId);
  } else if (sub.status === "canceled" || sub.status === "unpaid" || sub.status === "incomplete_expired") {
    // Access runs through the already-paid period (recommended_until keeps its
    // date); if Stripe reports no remaining period, end the placement now.
    if (!periodEnd || new Date(periodEnd).getTime() < Date.now()) {
      await admin
        .from("professional_profiles")
        .update({ is_recommended: false, recommended_until: null })
        .eq("user_id", professionalId)
        .not("recommended_until", "is", null); // never touch admin free-era rows
    }
  }
  // past_due: no change — the existing recommended_until (period end + grace)
  // lapses by itself if payment never recovers.
}

/** invoice.paid / invoice.payment_failed — record the latest payment outcome. */
export async function recordRecommendationInvoice(admin: Admin, invoice: Stripe.Invoice, outcome: "paid" | "failed"): Promise<void> {
  const line = invoice.lines?.data?.find((l) => {
    const price = l.pricing?.price_details?.price;
    return isRecommendationPrice(typeof price === "string" ? price : price?.id ?? null);
  });
  if (!line) return;
  const subId =
    typeof invoice.parent?.subscription_details?.subscription === "string"
      ? invoice.parent.subscription_details.subscription
      : invoice.parent?.subscription_details?.subscription?.id ?? null;
  if (!subId) return;
  await admin
    .from("recommendation_subscriptions")
    .update({ last_payment_status: outcome, updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subId);
}
