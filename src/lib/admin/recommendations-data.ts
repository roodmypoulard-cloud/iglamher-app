import "server-only";
// Data for /admin/recommendations — placement roster + honest subscription
// stats. Reads with the service-role client (pages are admin-gated).
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";

export interface RecommendationRosterRow {
  userId: string;
  name: string;
  avatarUrl: string | null;
  specialty: string;
  city: string;
  isRecommended: boolean;
  recommendedUntil: string | null;
  isVerified: boolean;
  isActive: boolean;
  subStatus: string | null; // Stripe status, or null = free-era manual placement
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  lastPaymentStatus: string | null;
}

export interface RecommendationStats {
  active: number;
  trialing: number;
  pastDue: number;
  canceled: number;
  freeEra: number;
  mrrCents: number;
}

const PRICE_CENTS = 299;

export async function getRecommendationRoster(): Promise<{ rows: RecommendationRosterRow[]; stats: RecommendationStats }> {
  const empty: RecommendationStats = { active: 0, trialing: 0, pastDue: 0, canceled: 0, freeEra: 0, mrrCents: 0 };
  if (!isLiveSupabase()) return { rows: [], stats: empty };

  const admin = createAdminClient();
  const [{ data: pros }, { data: subs }] = await Promise.all([
    admin
      .from("professional_profiles")
      .select("user_id, business_name, primary_specialty, city, avatar_url, is_recommended, recommended_until, is_verified, is_active, profiles:user_id (first_name, last_name)")
      .order("is_recommended", { ascending: false }),
    admin
      .from("recommendation_subscriptions")
      .select("professional_id, status, current_period_end, cancel_at_period_end, last_payment_status"),
  ]);

  type SubRow = { professional_id: string; status: string; current_period_end: string | null; cancel_at_period_end: boolean; last_payment_status: string | null };
  const subBy = new Map<string, SubRow>(((subs ?? []) as SubRow[]).map((s) => [s.professional_id, s]));

  type ProRow = {
    user_id: string; business_name: string | null; primary_specialty: string | null; city: string | null;
    avatar_url: string | null; is_recommended: boolean | null; recommended_until: string | null;
    is_verified: boolean; is_active: boolean;
    profiles: { first_name: string | null; last_name: string | null } | Array<{ first_name: string | null; last_name: string | null }> | null;
  };

  const rows: RecommendationRosterRow[] = ((pros ?? []) as ProRow[])
    .map((p) => {
      const prof = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
      const sub = subBy.get(p.user_id);
      return {
        userId: p.user_id,
        name: p.business_name || `${prof?.first_name ?? ""} ${prof?.last_name ?? ""}`.trim() || "—",
        avatarUrl: p.avatar_url,
        specialty: p.primary_specialty ?? "—",
        city: p.city ?? "—",
        isRecommended: Boolean(p.is_recommended),
        recommendedUntil: p.recommended_until,
        isVerified: p.is_verified,
        isActive: p.is_active,
        subStatus: sub?.status ?? null,
        periodEnd: sub?.current_period_end ?? null,
        cancelAtPeriodEnd: Boolean(sub?.cancel_at_period_end),
        lastPaymentStatus: sub?.last_payment_status ?? null,
      };
    })
    // Roster = anyone recommended now OR with any subscription history.
    .filter((r) => r.isRecommended || r.subStatus != null);

  const stats: RecommendationStats = { ...empty };
  for (const r of rows) {
    if (r.subStatus === "active") stats.active++;
    else if (r.subStatus === "trialing") stats.trialing++;
    else if (r.subStatus === "past_due") stats.pastDue++;
    else if (r.subStatus === "canceled" || r.subStatus === "unpaid") stats.canceled++;
    else if (r.subStatus == null && r.isRecommended) stats.freeEra++;
  }
  stats.mrrCents = stats.active * PRICE_CENTS;
  return { rows, stats };
}
