// Favorites + recently-viewed reads. Live path uses the authed Supabase client
// (RLS ensures a customer only ever sees their own rows). Professionals are
// hydrated in a single batched query (no N+1).
import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "./source";
import { getProfessionalsByUserIds } from "./professionals";
import { searchProfessionals } from "@/lib/marketplace/ranking";
import { DEFAULT_VIEWER } from "./seed";
import type { ProfessionalCardView } from "./model";

export async function getFavoriteProfessionalIds(): Promise<string[]> {
  if (!isLiveSupabase()) return [];
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data } = await supabase.from("favorites").select("professional_id").eq("customer_id", auth.user.id).limit(200);
  return (data as unknown as Array<{ professional_id: string }> | null)?.map((r) => r.professional_id) ?? [];
}

export async function getFavoriteProfessionals(): Promise<ProfessionalCardView[]> {
  const ids = await getFavoriteProfessionalIds();
  if (ids.length === 0) return [];
  const pros = await getProfessionalsByUserIds(ids);
  return searchProfessionals(pros, {}, { viewer: DEFAULT_VIEWER });
}

export async function getRecentlyViewedProfessionals(limit = 12): Promise<ProfessionalCardView[]> {
  if (!isLiveSupabase()) return [];
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data } = await supabase
    .from("recently_viewed")
    .select("professional_id, viewed_at")
    .eq("customer_id", auth.user.id)
    .order("viewed_at", { ascending: false })
    .limit(limit);
  const ids = (data as unknown as Array<{ professional_id: string }> | null)?.map((r) => r.professional_id) ?? [];
  if (ids.length === 0) return [];
  // Single batched fetch, preserving recency order.
  const pros = await getProfessionalsByUserIds(ids);
  const rank = new Map(ids.map((id, i) => [id, i] as const));
  const ordered = [...pros].sort((a, b) => (rank.get(a.userId) ?? 0) - (rank.get(b.userId) ?? 0));
  // Keep recency order (searchProfessionals would re-rank), so map to views directly.
  return searchProfessionals(ordered, { sort: "recommended" }, { viewer: DEFAULT_VIEWER }).sort(
    (a, b) => (rank.get(a.userId) ?? 0) - (rank.get(b.userId) ?? 0),
  );
}
