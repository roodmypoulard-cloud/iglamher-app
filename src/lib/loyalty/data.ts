import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";
import { tierForLifetime, tierProgress } from "./engine";

export interface LoyaltySummary {
  points: number;
  lifetimePoints: number;
  tier: string;
  tierLabel: string;
  next: string | null;
  pointsToNext: number;
  progressPct: number;
  transactions: { pointsDelta: number; reason: string; createdAt: string }[];
  available: boolean; // false in seed/dev mode
}

const EMPTY: LoyaltySummary = {
  points: 0, lifetimePoints: 0, tier: "bronze", tierLabel: "Bronze",
  next: "Silver", pointsToNext: 500, progressPct: 0, transactions: [], available: false,
};

export async function getMyLoyalty(): Promise<LoyaltySummary> {
  if (!isLiveSupabase()) return EMPTY;
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return EMPTY;

  const admin = createAdminClient();
  // Ensure an account exists (idempotent).
  let { data: acct } = await admin.from("loyalty_accounts").select("points,lifetime_points").eq("user_id", auth.user.id).maybeSingle();
  if (!acct) {
    await admin.from("loyalty_accounts").upsert({ user_id: auth.user.id, points: 0, lifetime_points: 0, tier: "bronze" }, { onConflict: "user_id" });
    acct = { points: 0, lifetime_points: 0 } as { points: number; lifetime_points: number };
  }
  const a = acct as { points: number; lifetime_points: number };
  const { data: txns } = await admin
    .from("loyalty_transactions")
    .select("points_delta,reason,created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const prog = tierProgress(a.lifetime_points);
  return {
    points: a.points,
    lifetimePoints: a.lifetime_points,
    tier: prog.tier.tier,
    tierLabel: tierForLifetime(a.lifetime_points).label,
    next: prog.next?.label ?? null,
    pointsToNext: prog.pointsToNext,
    progressPct: prog.progressPct,
    transactions: ((txns as unknown as Array<{ points_delta: number; reason: string; created_at: string }>) ?? []).map((t) => ({
      pointsDelta: t.points_delta, reason: t.reason, createdAt: t.created_at,
    })),
    available: true,
  };
}
