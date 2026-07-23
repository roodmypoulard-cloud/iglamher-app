// Public marketplace data access. Live Supabase retrieval (indexed + RLS) with
// a deterministic seed fallback. All ranking/visibility runs on the returned rows.
import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "./source";
import { PROFESSIONALS, CATEGORIES, DEFAULT_VIEWER } from "./seed";
import type { Professional, Category, CategorySlug, GeoPoint } from "./model";
import {
  searchProfessionals,
  type SearchParams,
} from "@/lib/marketplace/ranking";
import { isPubliclyVisible, publicServices } from "@/lib/marketplace/visibility";
import type { ProfessionalCardView } from "./model";

// --- shape returned from Supabase (snake_case). Only the fields we map. ---
interface ProRow {
  user_id: string;
  slug: string;
  business_name: string;
  avatar_url: string | null;
  cover_url: string | null;
  headline: string | null;
  bio: string | null;
  primary_specialty: string | null;
  specialties: string[] | null;
  languages: string[] | null;
  years_experience: number | null;
  city: string | null;
  postal_code: string | null;
  location_type: "mobile" | "in_salon" | "both";
  service_radius_miles: number | null;
  location_lat: number | null;
  location_lng: number | null;
  timezone: string | null;
  is_active: boolean;
  is_verified: boolean;
  is_featured: boolean;
  instant_book: boolean;
  rating_average: number;
  review_count: number;
  jobs_completed: number;
  reliability_score: number | null;
  instagram_handle: string | null;
  ig_follower_count: string | null;
  cancellation_policy: unknown;
  services?: ServiceRowDb[];
  service_addons?: AddonRowDb[];
  professional_portfolio_items?: PortfolioRowDb[];
  availability_rules?: RuleRowDb[];
  reviews?: ReviewRowDb[];
}
interface ServiceRowDb {
  id: string; professional_id: string; category_id: string | null; name: string;
  description: string | null; duration_minutes: number; price_cents: number;
  price_is_from: boolean; deposit_type: string; deposit_value: number | null;
  location_type: "mobile" | "in_salon" | "both"; buffer_before_minutes: number;
  buffer_after_minutes: number; travel_fee_cents: number | null; instant_book: boolean;
  is_active: boolean; deleted_at: string | null; sort_order: number;
}
interface AddonRowDb { id: string; professional_id: string; name: string; price_cents: number; is_active: boolean; }
interface PortfolioRowDb {
  id: string; professional_id: string; kind: "image" | "video" | "instagram"; url: string | null;
  thumb_url: string | null; caption: string | null; service_id: string | null; category_id: string | null;
  is_cover: boolean; is_hidden: boolean; sort_order: number;
}
interface RuleRowDb { weekday: number; start_minute: number; end_minute: number; }
interface ReviewRowDb { id: string; rating: number; body: string | null; professional_response: string | null; is_published: boolean; created_at: string; direction?: string | null; }

const catById = new Map(CATEGORIES.map((c) => [c.id, c.slug] as const));

function mapPro(row: ProRow): Professional {
  const slugFor = (id: string | null): CategorySlug =>
    (id && catById.get(id)) || "makeup";
  return {
    userId: row.user_id,
    slug: row.slug,
    businessName: row.business_name,
    displayName: row.business_name,
    avatarUrl: row.avatar_url ?? "",
    coverUrl: row.cover_url ?? "",
    headline: row.headline ?? "",
    bio: row.bio ?? "",
    primarySpecialty: row.primary_specialty ?? "",
    specialties: row.specialties ?? [],
    languages: row.languages ?? [],
    yearsExperience: row.years_experience ?? 0,
    city: row.city ?? "",
    postalCode: row.postal_code ?? "",
    locationType: row.location_type,
    serviceRadiusMiles: row.service_radius_miles ?? 15,
    lat: row.location_lat ?? DEFAULT_VIEWER.lat,
    lng: row.location_lng ?? DEFAULT_VIEWER.lng,
    timezone: row.timezone ?? "America/Los_Angeles",
    isActive: row.is_active,
    isVerified: row.is_verified,
    isFeatured: row.is_featured,
    instantBook: row.instant_book,
    ratingAverage: Number(row.rating_average),
    reviewCount: row.review_count,
    jobsCompleted: row.jobs_completed,
    reliabilityScore: row.reliability_score ?? 80,
    instagramHandle: row.instagram_handle ?? "",
    igFollowerCount: row.ig_follower_count ?? "0",
    cancellationPolicy: typeof row.cancellation_policy === "string" ? row.cancellation_policy : "",
    services: (row.services ?? []).map((s) => ({
      id: s.id, professionalId: s.professional_id, categorySlug: slugFor(s.category_id),
      name: s.name, description: s.description ?? "", durationMin: s.duration_minutes,
      priceCents: s.price_cents, priceIsFrom: s.price_is_from,
      depositType: (s.deposit_type as Professional["services"][number]["depositType"]) ?? "full",
      depositValue: s.deposit_value, locationType: s.location_type,
      bufferBeforeMin: s.buffer_before_minutes, bufferAfterMin: s.buffer_after_minutes,
      travelFeeCents: s.travel_fee_cents, instantBook: s.instant_book,
      isActive: s.is_active, isArchived: s.deleted_at != null, sortOrder: s.sort_order,
      images: [], addonIds: [],
    })),
    addons: (row.service_addons ?? []).map((a) => ({
      id: a.id, professionalId: a.professional_id, name: a.name, priceCents: a.price_cents, isActive: a.is_active,
    })),
    portfolio: (row.professional_portfolio_items ?? []).map((p) => ({
      id: p.id, professionalId: p.professional_id, kind: p.kind, url: p.url ?? undefined,
      thumbUrl: p.thumb_url ?? undefined, caption: p.caption ?? undefined,
      serviceId: p.service_id ?? undefined, categorySlug: p.category_id ? slugFor(p.category_id) : undefined,
      isCover: p.is_cover, isHidden: p.is_hidden, sortOrder: p.sort_order,
    })),
    // Only customer→pro reviews are shown on a public pro profile. pro→customer
    // reviews (the pro rating the client) must never leak here. `direction` may be
    // absent on pre-0020 rows, which are all customer_to_pro by definition.
    reviews: (row.reviews ?? [])
      .filter((r) => (r.direction ?? "customer_to_pro") === "customer_to_pro")
      .map((r) => ({
        id: r.id, author: "Verified client", rating: r.rating, body: r.body ?? "",
        serviceName: "", createdAt: r.created_at, professionalResponse: r.professional_response ?? undefined,
        isPublished: r.is_published,
      })),
    availability: (row.availability_rules ?? []).map((r) => ({
      weekday: r.weekday, startMinute: r.start_minute, endMinute: r.end_minute,
    })),
    exceptions: [],
  };
}

const PRO_SELECT =
  "*, services(*), service_addons(*), professional_portfolio_items(*), availability_rules(*), reviews(*)";

/**
 * Moderation gate for public visibility (professional_profiles.account_status, 0024):
 * a suspended/banned pro must never surface publicly. Best-effort — pre-0024 rows have
 * no column (undefined) and are treated as active, so it never crashes an old deploy.
 */
function accountIsActive(row: { account_status?: string | null }): boolean {
  const s = row.account_status;
  return s == null || s === "active";
}

async function fetchActivePros(): Promise<Professional[]> {
  if (!isLiveSupabase()) return PROFESSIONALS.filter(isPubliclyVisible);
  const supabase = await createSupabaseServerClient();
  // SCALABILITY NOTE: this loads active pros and re-ranks in TS. Fine at launch
  // scale; the safety cap prevents a runaway query. At national scale, push the
  // text/category/geo filter to Postgres (FTS + PostGIS, indexes in 0004) and
  // fetch only the candidate set. See PRODUCT_DECISIONS.md.
  const { data, error } = await supabase
    .from("professional_profiles")
    .select(PRO_SELECT)
    .eq("is_active", true)
    // Only surface trustworthy profiles publicly: admin-verified pros or curated
    // demo/launch data. This keeps unverified test signups (e.g. incomplete
    // onboarding accounts with random-suffix names, 0 reviews) out of the feed.
    .or("is_verified.eq.true,is_demo.eq.true")
    .order("reliability_score", { ascending: false })
    .limit(500);
  if (error || !data) return [];
  // Dedupe by user_id at the source so a single pro can never render twice,
  // regardless of any accidental duplicate rows or nested-join fan-out.
  const byId = new Map<string, Professional>();
  for (const row of data as unknown as ProRow[]) {
    if (!accountIsActive(row as { account_status?: string | null })) continue;
    const pro = mapPro(row);
    if (!byId.has(pro.userId)) byId.set(pro.userId, pro);
  }
  return Array.from(byId.values());
}

export async function listCategories(): Promise<Category[]> {
  if (!isLiveSupabase()) return CATEGORIES.filter((c) => c.isActive);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("categories").select("*").eq("is_active", true).order("sort_order");
  if (!data) return CATEGORIES.filter((c) => c.isActive);
  // Fall back to the seed category imagery when the DB row has no image_url.
  const seedImg = new Map(CATEGORIES.map((c) => [c.slug, c.imageUrl] as const));
  return (data as unknown as Array<{ id: string; slug: CategorySlug; name: string; description: string | null; image_url: string | null; is_active: boolean; sort_order: number }>).map((c) => ({
    id: c.id, slug: c.slug, name: c.name, description: c.description ?? "",
    imageUrl: c.image_url || seedImg.get(c.slug) || "", isActive: c.is_active, sortOrder: c.sort_order,
  }));
}

export async function searchProfessionalViews(
  params: SearchParams,
  viewer: GeoPoint = DEFAULT_VIEWER,
  now: Date = new Date(),
): Promise<ProfessionalCardView[]> {
  const pros = await fetchActivePros();
  return searchProfessionals(pros, params, { viewer, now });
}

export async function getFeaturedProfessionals(limit = 6, viewer: GeoPoint = DEFAULT_VIEWER): Promise<ProfessionalCardView[]> {
  const views = await searchProfessionalViews({ sort: "rating" }, viewer);
  return views.filter((v) => v.isFeatured).slice(0, limit);
}

export async function getProfessionalsByCategory(slug: CategorySlug, viewer: GeoPoint = DEFAULT_VIEWER): Promise<ProfessionalCardView[]> {
  return searchProfessionalViews({ category: slug }, viewer);
}

export async function getProfessionalBySlug(slug: string): Promise<Professional | null> {
  if (!isLiveSupabase()) {
    const p = PROFESSIONALS.find((x) => x.slug === slug);
    return p && isPubliclyVisible(p) ? p : null;
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("professional_profiles")
    .select(PRO_SELECT)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error || !data) return null;
  if (!accountIsActive(data as { account_status?: string | null })) return null;
  return mapPro(data as unknown as ProRow);
}

/**
 * Batch fetch professionals by user id in a SINGLE query (avoids N+1 in
 * favorites / recently-viewed). Returns them in the order of `ids`.
 */
export async function getProfessionalsByUserIds(ids: string[], activeOnly = true): Promise<Professional[]> {
  if (ids.length === 0) return [];
  if (!isLiveSupabase()) {
    const set = new Set(ids);
    const found = PROFESSIONALS.filter((p) => set.has(p.userId) && (!activeOnly || p.isActive));
    return orderBy(found, ids);
  }
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("professional_profiles").select(PRO_SELECT).in("user_id", ids);
  if (activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error || !data) return [];
  const rows = data as unknown as ProRow[];
  const visible = activeOnly ? rows.filter((r) => accountIsActive(r as { account_status?: string | null })) : rows;
  return orderBy(visible.map(mapPro), ids);
}

function orderBy(pros: Professional[], ids: string[]): Professional[] {
  const rank = new Map(ids.map((id, i) => [id, i] as const));
  return [...pros].sort((a, b) => (rank.get(a.userId) ?? 0) - (rank.get(b.userId) ?? 0));
}

/** Owner/dashboard read — includes inactive profiles and archived services. */
export async function getProfessionalByUserId(userId: string): Promise<Professional | null> {
  if (!isLiveSupabase()) {
    return PROFESSIONALS.find((x) => x.userId === userId) ?? null;
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("professional_profiles")
    .select(PRO_SELECT)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return mapPro(data as unknown as ProRow);
}

/** Admin listing — ALL professionals incl. inactive (RLS: is_admin can read). */
export async function getAllProfessionalsForAdmin(): Promise<Professional[]> {
  if (!isLiveSupabase()) return PROFESSIONALS;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("professional_profiles")
    .select(PRO_SELECT)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (!data) return [];
  return (data as unknown as ProRow[]).map(mapPro);
}

export interface ServiceWithPro {
  service: Professional["services"][number];
  professional: Professional;
}

export async function getServiceWithProfessional(serviceId: string): Promise<ServiceWithPro | null> {
  if (!isLiveSupabase()) {
    for (const p of PROFESSIONALS) {
      if (!isPubliclyVisible(p)) continue;
      const service = publicServices(p).find((s) => s.id === serviceId);
      if (service) return { service, professional: p };
    }
    return null;
  }
  const supabase = await createSupabaseServerClient();
  const { data: svc } = await supabase.from("services").select("professional_id").eq("id", serviceId).maybeSingle();
  if (!svc) return null;
  const proId = (svc as { professional_id: string }).professional_id;
  const { data } = await supabase.from("professional_profiles").select(PRO_SELECT).eq("user_id", proId).eq("is_active", true).maybeSingle();
  if (!data) return null;
  const professional = mapPro(data as unknown as ProRow);
  const service = publicServices(professional).find((s) => s.id === serviceId);
  return service ? { service, professional } : null;
}
