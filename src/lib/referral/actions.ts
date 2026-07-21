"use server";
// Referral mutations. Applying a code records a referral (fraud-checked); it
// qualifies + pays out when the referred user completes their first booking.
import { headers } from "next/headers";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";
import { checkReferralFraud, rewardFor } from "./engine";

export type ReferralActionResult = { ok: true; message: string } | { ok: false; error: string };

const codeSchema = z.string().trim().min(4).max(20);

/** A new/eligible user applies a referral code. */
export async function applyReferralCodeAction(rawCode: string): Promise<ReferralActionResult> {
  const parsed = codeSchema.safeParse(rawCode);
  if (!parsed.success) return { ok: false, error: "Invalid code." };
  if (!isLiveSupabase()) return { ok: false, error: "Connect the backend to use referral codes." };

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Please sign in." };

  const admin = createAdminClient();
  const code = parsed.data.toUpperCase();
  const { data: rc } = await admin.from("referral_codes").select("user_id,kind").eq("code", code).maybeSingle();
  if (!rc) return { ok: false, error: "That code doesn't exist." };
  const referrer = rc as { user_id: string; kind: string };

  // --- Gather real fraud signals ---
  const hdrs = await headers();
  const ip = (hdrs.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const createdAt = auth.user.created_at ? new Date(auth.user.created_at) : null;
  const referredAccountAgeHours = createdAt ? (Date.now() - createdAt.getTime()) / 3_600_000 : undefined;
  const since24h = new Date(Date.now() - 24 * 3_600_000).toISOString();

  const { count: referrerReferralsLast24h } = await admin
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", referrer.user_id)
    .gte("created_at", since24h);

  let ipReferralsLast24h = 0;
  if (ip) {
    const { count } = await admin
      .from("referral_audit")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .eq("decision", "accepted")
      .gte("created_at", since24h);
    ipReferralsLast24h = count ?? 0;
  }

  const fraud = checkReferralFraud({
    referrerId: referrer.user_id,
    referredId: auth.user.id,
    referredAccountAgeHours,
    referrerReferralsLast24h: referrerReferralsLast24h ?? 0,
    ipReferralsLast24h,
  });

  // Audit every decision (accepted or rejected) for abuse investigation.
  await admin.from("referral_audit").insert({
    referred_id: auth.user.id,
    referrer_id: referrer.user_id,
    code,
    ip,
    decision: fraud.ok ? "accepted" : "rejected",
    reasons: fraud.reasons,
  });

  if (!fraud.ok) return { ok: false, error: fraud.reasons[0] };

  // One referral per referred user (enforced by unique constraint too).
  const { data: existing } = await admin.from("referrals").select("id").eq("referred_id", auth.user.id).maybeSingle();
  if (existing) return { ok: false, error: "You've already used a referral code." };

  const { error } = await admin.from("referrals").insert({
    referrer_id: referrer.user_id, referred_id: auth.user.id, code: parsed.data.toUpperCase(), kind: referrer.kind, status: "pending",
  });
  if (error) return { ok: false, error: error.message };

  // Welcome credit to the referred user (referrer pays out on qualification).
  const reward = rewardFor(referrer.kind === "professional" ? "professional" : "customer");
  if (reward.referredCreditCents > 0) {
    await admin.from("account_credits").insert({ user_id: auth.user.id, amount_cents: reward.referredCreditCents, reason: "referral_welcome" });
  }
  return { ok: true, message: reward.referredCreditCents > 0 ? `Code applied — $${(reward.referredCreditCents / 100).toFixed(0)} welcome credit added!` : "Referral code applied." };
}
