import "server-only";
// Referral qualification — the ONLY place referral money is granted.
// Called from the Stripe webhook on a booking's pending→confirmed transition
// (deposit paid), for both parties: a referred customer qualifies on their first
// paid booking made; a referred professional on their first paid booking
// received. Nothing is granted at code-apply time (Sybil defence: sign-ups
// without real paid activity earn nothing, for anyone).
import { rewardFor } from "./engine";
import { tierForLifetime } from "@/lib/loyalty/engine";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export async function qualifyReferralOnFirstPaidBooking(admin: Admin, userId: string, bookingId: string): Promise<void> {
  // Status-guarded flip pending → rewarded: the row comes back only on the
  // transition, so retried webhook deliveries grant at most once.
  const { data } = await admin
    .from("referrals")
    .update({ status: "rewarded", rewarded_at: new Date().toISOString() })
    .eq("referred_id", userId)
    .eq("status", "pending")
    .select("referrer_id, kind")
    .maybeSingle();
  const ref = data as { referrer_id: string; kind: string } | null;
  if (!ref) return;

  const reward = rewardFor(ref.kind === "professional" ? "professional" : "customer");

  const credits: Array<{ user_id: string; amount_cents: number; reason: string }> = [];
  if (reward.referredCreditCents > 0) {
    credits.push({ user_id: userId, amount_cents: reward.referredCreditCents, reason: "referral_welcome" });
  }
  if (reward.referrerCreditCents > 0) {
    credits.push({ user_id: ref.referrer_id, amount_cents: reward.referrerCreditCents, reason: "referral_reward" });
  }
  if (credits.length > 0) await admin.from("account_credits").insert(credits);

  // Referrer loyalty points — same bookkeeping as awardBookingPoints.
  if (reward.referrerPoints > 0) {
    const { data: acct } = await admin.from("loyalty_accounts").select("points,lifetime_points").eq("user_id", ref.referrer_id).maybeSingle();
    const a = acct as { points?: number; lifetime_points?: number } | null;
    const lifetimePoints = (a?.lifetime_points ?? 0) + reward.referrerPoints;
    await admin.from("loyalty_accounts").upsert(
      {
        user_id: ref.referrer_id,
        points: (a?.points ?? 0) + reward.referrerPoints,
        lifetime_points: lifetimePoints,
        tier: tierForLifetime(lifetimePoints).tier,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    await admin.from("loyalty_transactions").insert({
      user_id: ref.referrer_id,
      points_delta: reward.referrerPoints,
      reason: "referral_reward",
      booking_id: bookingId,
    });
  }
}
