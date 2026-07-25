import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";
import { getAllProfessionalsForAdmin } from "@/lib/data/professionals";

export interface PlatformOverview {
  totalProfessionals: number;
  activeProfessionals: number;
  verifiedProfessionals: number;
  featuredProfessionals: number;
  atRiskProfessionals: number; // reliability < 75
  avgRating: number;
  avgReliability: number;
  pendingVerifications: number;
  openReports: number;
  openDisputes: number;
  fraudFlags: number;
}

async function countIn(table: string, column: string, values: string[]): Promise<number> {
  if (!isLiveSupabase()) return 0;
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase.from(table).select("*", { count: "exact", head: true }).in(column, values);
  return count ?? 0;
}

export interface PendingPro {
  userId: string;
  businessName: string;
  displayName: string;
  slug: string;
  city: string;
  avatarUrl: string;
  servicesCount: number;
  createdAt: string; // UTC ISO
}

/** Pros awaiting manual verification: active, not yet verified, and not curated demo data. */
export async function getPendingVerifications(): Promise<PendingPro[]> {
  if (!isLiveSupabase()) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("professional_profiles")
    .select("user_id, business_name, headline, slug, city, avatar_url, created_at, services(id)")
    .eq("is_verified", false)
    .eq("is_demo", false)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (
    data as unknown as Array<{
      user_id: string;
      business_name: string | null;
      headline: string | null;
      slug: string;
      city: string | null;
      avatar_url: string | null;
      created_at: string;
      services: { id: string }[] | null;
    }>
  ).map((r) => ({
    userId: r.user_id,
    businessName: r.business_name ?? "Unnamed studio",
    displayName: r.headline || r.business_name || "—",
    slug: r.slug,
    city: r.city ?? "—",
    avatarUrl: r.avatar_url ?? "",
    servicesCount: r.services?.length ?? 0,
    createdAt: r.created_at,
  }));
}

export async function getPlatformOverview(): Promise<PlatformOverview> {
  const pros = await getAllProfessionalsForAdmin();
  const active = pros.filter((p) => p.isActive);
  const avg = (nums: number[]) => (nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100 : 0);

  const [pendingVerifications, openReports, openDisputes, fraudFlags] = await Promise.all([
    countIn("professional_profiles", "review_status", ["pending_review", "under_review"]),
    countIn("content_reports", "status", ["open", "reviewing"]),
    countIn("disputes", "status", ["open", "awaiting_response", "under_investigation"]),
    countIn("fraud_flags", "status", ["flagged"]),
  ]);

  return {
    totalProfessionals: pros.length,
    activeProfessionals: active.length,
    verifiedProfessionals: active.filter((p) => p.isVerified).length,
    featuredProfessionals: active.filter((p) => p.isFeatured).length,
    atRiskProfessionals: pros.filter((p) => p.reliabilityScore < 75).length,
    avgRating: avg(active.map((p) => p.ratingAverage)),
    avgReliability: avg(pros.map((p) => p.reliabilityScore)),
    pendingVerifications,
    openReports,
    openDisputes,
    fraudFlags,
  };
}

export interface QueueItem {
  id: string;
  label: string;
  sub: string;
  createdAt?: string;
}

/**
 * Applications awaiting admin review. Reads from professional_profiles.review_status —
 * the SAME source as /admin/applications — so the dashboard queue and the applications
 * list can never disagree. (Was previously reading the legacy professional_verifications
 * table, which caused the "0 pending" vs "1 awaiting review" inconsistency.)
 */
export async function getVerificationQueue(): Promise<QueueItem[]> {
  if (!isLiveSupabase()) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("professional_profiles")
    .select("user_id, business_name, headline, review_status, submitted_at, created_at")
    .in("review_status", ["pending_review", "under_review"])
    .eq("is_demo", false)
    .order("submitted_at", { ascending: true, nullsFirst: false })
    .limit(200);
  return (
    (data as unknown as Array<{
      user_id: string;
      business_name: string | null;
      headline: string | null;
      review_status: string;
      submitted_at: string | null;
      created_at: string;
    }>) ?? []
  ).map((r) => ({
    id: r.user_id,
    label: r.business_name || r.headline || "Unnamed studio",
    sub: r.review_status === "under_review" ? "In review" : "Awaiting review",
    createdAt: r.submitted_at ?? r.created_at,
  }));
}

export async function getOpenReports(): Promise<QueueItem[]> {
  if (!isLiveSupabase()) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("content_reports")
    .select("id, target_type, reason, status, created_at")
    .in("status", ["open", "reviewing"])
    .order("created_at")
    .limit(200);
  return ((data as unknown as Array<{ id: string; target_type: string; reason: string; status: string; created_at: string }>) ?? []).map((r) => ({
    id: r.id,
    label: `${r.reason} · ${r.target_type}`,
    sub: r.status,
    createdAt: r.created_at,
  }));
}

/** Open Stripe card disputes (chargebacks) recorded by the webhook. */
export async function getOpenCardDisputes(): Promise<QueueItem[]> {
  if (!isLiveSupabase()) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("stripe_disputes")
    .select("id, reason, status, amount_cents, evidence_due_by, created_at")
    .in("status", ["needs_response", "warning_needs_response", "under_review", "warning_under_review"])
    .order("created_at")
    .limit(200);
  // Table lands with migration 0035 — an empty queue (not a crash) until then.
  if (error) return [];
  return ((data as unknown as Array<{ id: string; reason: string | null; status: string; amount_cents: number; evidence_due_by: string | null; created_at: string }>) ?? []).map((r) => ({
    id: r.id,
    label: `$${(r.amount_cents / 100).toFixed(2)} · ${r.reason ?? "chargeback"}`,
    sub: r.evidence_due_by ? `${r.status} · evidence due ${new Date(r.evidence_due_by).toLocaleDateString()}` : r.status,
    createdAt: r.created_at,
  }));
}

export async function getOpenDisputes(): Promise<QueueItem[]> {
  if (!isLiveSupabase()) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("disputes")
    .select("id, reason, status, created_at")
    .in("status", ["open", "awaiting_response", "under_investigation"])
    .order("created_at")
    .limit(200);
  return ((data as unknown as Array<{ id: string; reason: string; status: string; created_at: string }>) ?? []).map((r) => ({
    id: r.id,
    label: r.reason,
    sub: r.status,
    createdAt: r.created_at,
  }));
}
