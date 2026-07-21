import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";
import { generateReferralCode } from "./engine";

export interface ReferralSummary {
  code: string | null;
  totalReferred: number;
  rewarded: number;
  pending: number;
  available: boolean;
}

export async function getMyReferral(): Promise<ReferralSummary> {
  if (!isLiveSupabase()) return { code: null, totalReferred: 0, rewarded: 0, pending: 0, available: false };
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { code: null, totalReferred: 0, rewarded: 0, pending: 0, available: false };

  const admin = createAdminClient();
  // Get or create a deterministic code for this user.
  let { data: rc } = await admin.from("referral_codes").select("code").eq("user_id", auth.user.id).maybeSingle();
  if (!rc) {
    const code = generateReferralCode(auth.user.id);
    await admin.from("referral_codes").upsert({ user_id: auth.user.id, code, kind: "customer" }, { onConflict: "user_id" });
    rc = { code } as { code: string };
  }

  const { data: refs } = await admin.from("referrals").select("status").eq("referrer_id", auth.user.id).limit(1000);
  const list = (refs as unknown as Array<{ status: string }>) ?? [];
  return {
    code: (rc as { code: string }).code,
    totalReferred: list.length,
    rewarded: list.filter((r) => r.status === "rewarded").length,
    pending: list.filter((r) => r.status === "pending" || r.status === "qualified").length,
    available: true,
  };
}
