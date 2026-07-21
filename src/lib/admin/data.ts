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

export async function getPlatformOverview(): Promise<PlatformOverview> {
  const pros = await getAllProfessionalsForAdmin();
  const active = pros.filter((p) => p.isActive);
  const avg = (nums: number[]) => (nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100 : 0);

  const [pendingVerifications, openReports, openDisputes, fraudFlags] = await Promise.all([
    countIn("professional_verifications", "status", ["pending", "more_info_requested"]),
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

export async function getVerificationQueue(): Promise<QueueItem[]> {
  if (!isLiveSupabase()) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("professional_verifications")
    .select("id, professional_id, status, created_at")
    .in("status", ["pending", "more_info_requested"])
    .order("created_at")
    .limit(200);
  return ((data as unknown as Array<{ id: string; professional_id: string; status: string; created_at: string }>) ?? []).map((r) => ({
    id: r.id,
    label: `Professional ${r.professional_id.slice(0, 8)}`,
    sub: r.status,
    createdAt: r.created_at,
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
