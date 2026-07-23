import "server-only";
// Reads for the Customer Job Marketplace. All queries run with the user's own
// session client so RLS decides visibility (open requests for everyone signed
// in; own requests in any status). Seed mode returns empty lists — the pages
// render their empty states.
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";
import type { JobPhoto, JobRequest } from "./schema";

const FIELDS =
  "id, customer_id, category, title, description, photos, preferred_date, time_window, location_text, is_house_call, budget_cents, status, created_at, profiles:customer_id (first_name, last_name, avatar_url)";

type ProfileJoin = { first_name: string | null; last_name: string | null; avatar_url: string | null } | null;
type Row = {
  id: string;
  customer_id: string;
  category: string;
  title: string;
  description: string;
  photos: unknown;
  preferred_date: string | null;
  time_window: string | null;
  location_text: string;
  is_house_call: boolean;
  budget_cents: number | null;
  status: string;
  created_at: string;
  profiles: ProfileJoin | ProfileJoin[];
};

function mapRow(r: Row): JobRequest {
  const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
  const first = p?.first_name?.trim() ?? "";
  const lastInitial = p?.last_name?.trim()?.[0];
  const photos = Array.isArray(r.photos)
    ? (r.photos as JobPhoto[]).filter((x) => x && typeof x.url === "string" && typeof x.path === "string")
    : [];
  return {
    id: r.id,
    customerId: r.customer_id,
    customerName: first ? (lastInitial ? `${first} ${lastInitial}.` : first) : "iGlamHer member",
    customerAvatarUrl: p?.avatar_url ?? null,
    category: r.category as JobRequest["category"],
    title: r.title,
    description: r.description,
    photos,
    preferredDate: r.preferred_date,
    timeWindow: r.time_window as JobRequest["timeWindow"],
    locationText: r.location_text,
    isHouseCall: r.is_house_call,
    budgetCents: r.budget_cents,
    status: r.status as JobRequest["status"],
    createdAt: r.created_at,
  };
}

/** Recent OPEN requests for the browse feed (excludes the viewer's own — those live under "My requests"). */
export async function listOpenRequests(opts?: { excludeUserId?: string; limit?: number }): Promise<JobRequest[]> {
  if (!isLiveSupabase()) return [];
  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("job_requests")
    .select(FIELDS)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(Math.min(opts?.limit ?? 30, 50));
  if (opts?.excludeUserId) q = q.neq("customer_id", opts.excludeUserId);
  const { data } = await q;
  return ((data ?? []) as unknown as Row[]).map(mapRow);
}

/** The viewer's own requests, newest first, all statuses. */
export async function listMyRequests(userId: string): Promise<JobRequest[]> {
  if (!isLiveSupabase()) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("job_requests")
    .select(FIELDS)
    .eq("customer_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return ((data ?? []) as unknown as Row[]).map(mapRow);
}

/** One request (RLS: owner always; others only while open). */
export async function getJobRequest(id: string): Promise<JobRequest | null> {
  if (!isLiveSupabase()) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("job_requests").select(FIELDS).eq("id", id).maybeSingle();
  return data ? mapRow(data as unknown as Row) : null;
}
