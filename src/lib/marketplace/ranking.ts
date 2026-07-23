// ============================================================
// Search ranking & filtering — service layer.
//
// HONEST DESCRIPTION OF HOW THIS WORKS:
// Retrieval is done by the database (indexed): a trigram / full-text query on
// professional_profiles + a name match on services narrows the candidate set
// (see src/lib/data/professionals.ts and migration 0004's GIN/GiST indexes).
// This module then RE-RANKS that candidate set in TypeScript with a weighted
// score. It is NOT an "intelligent" ranker — it is a transparent, deterministic
// weighted sum. Every weight is listed in RANKING_WEIGHTS below.
// ============================================================
import type {
  Professional,
  ProfessionalCardView,
  CategorySlug,
  LocationType,
  GeoPoint,
} from "@/lib/data/model";
import { haversineMiles, isReachable } from "@/lib/data/geo";
import { isPubliclyVisible, publicServices, profileCompleteness } from "./visibility";
import { rankingMultiplierFromScore } from "@/lib/trust/reliability";

export type SortKey =
  | "recommended"
  | "nearest"
  | "rating"
  | "reviews"
  | "price_asc"
  | "earliest";

export interface SearchParams {
  q?: string;
  category?: CategorySlug;
  distanceMi?: number;
  minRating?: number;
  minPriceCents?: number;
  maxPriceCents?: number;
  location?: LocationType | "all";
  verifiedOnly?: boolean;
  instantOnly?: boolean;
  sort?: SortKey;
}

// Weights for the "recommended" score. Sum is documented, not magic.
export const RANKING_WEIGHTS = {
  textRelevance: 0.30,
  rating: 0.20,
  reviewVolume: 0.12,
  distance: 0.15,
  verified: 0.08,
  featured: 0.05,
  availability: 0.05,
  completeness: 0.05,
} as const;

function normalizedText(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^\w\s]/g, " ");
}

/** Free-text relevance 0..1 across name, business, specialty, category, city, services. */
export function textRelevance(pro: Professional, q: string): number {
  const query = normalizedText(q).trim();
  if (!query) return 0;
  const terms = query.split(/\s+/);
  const haystacks: Array<{ text: string; weight: number }> = [
    { text: normalizedText(pro.businessName), weight: 1.0 },
    { text: normalizedText(pro.displayName), weight: 1.0 },
    { text: normalizedText(pro.primarySpecialty), weight: 0.8 },
    { text: normalizedText(pro.specialties.join(" ")), weight: 0.7 },
    { text: normalizedText(pro.city), weight: 0.6 },
    { text: normalizedText(pro.postalCode), weight: 0.6 },
    { text: normalizedText(pro.headline), weight: 0.5 },
    { text: normalizedText(publicServices(pro).map((s) => `${s.name} ${s.categorySlug}`).join(" ")), weight: 0.6 },
  ];
  let best = 0;
  for (const term of terms) {
    let termScore = 0;
    for (const h of haystacks) {
      if (!h.text) continue;
      if (h.text.includes(term)) termScore = Math.max(termScore, h.weight);
    }
    best += termScore;
  }
  return Math.min(1, best / terms.length);
}

/** Does this pro match a text query at all? (used as a hard filter). */
export function matchesQuery(pro: Professional, q: string): boolean {
  return textRelevance(pro, q) > 0;
}

export interface RankContext {
  viewer?: GeoPoint;
  now?: Date;
}

function ratingScore(pro: Professional): number {
  return Math.max(0, Math.min(1, pro.ratingAverage / 5));
}

function reviewVolumeScore(pro: Professional): number {
  // log-saturating: 0 reviews -> 0, ~150 reviews -> ~1
  return Math.min(1, Math.log10(pro.reviewCount + 1) / Math.log10(151));
}

function distanceScore(distanceMi: number | undefined): number {
  if (distanceMi == null) return 0.5; // unknown location -> neutral
  // 0 mi -> 1, 25+ mi -> 0
  return Math.max(0, 1 - distanceMi / 25);
}

function availabilityScore(pro: Professional): number {
  // Proxy signal until Phase 4 slot search: has weekly hours + instant-book bonus.
  const hasHours = pro.availability.length > 0 ? 0.6 : 0;
  const instant = pro.instantBook ? 0.4 : 0;
  return Math.min(1, hasHours + instant);
}

/** The transparent weighted "recommended" score, 0..1. */
export function recommendedScore(pro: Professional, distanceMi: number | undefined): number {
  const w = RANKING_WEIGHTS;
  return (
    w.rating * ratingScore(pro) +
    w.reviewVolume * reviewVolumeScore(pro) +
    w.distance * distanceScore(distanceMi) +
    w.verified * (pro.isVerified ? 1 : 0) +
    w.featured * (pro.isFeatured ? 1 : 0) +
    w.availability * availabilityScore(pro) +
    w.completeness * profileCompleteness(pro)
  );
}

function startingPrice(pro: Professional): number {
  const svc = publicServices(pro);
  return svc.length ? Math.min(...svc.map((s) => s.priceCents)) : 0;
}

/**
 * Filter + rank a candidate set. Pure function: same result for same inputs.
 * Callers pass an already-DB-narrowed candidate list (or the full seed in dev).
 */
export function searchProfessionals(
  candidates: Professional[],
  params: SearchParams,
  ctx: RankContext = {},
): ProfessionalCardView[] {
  const q = params.q?.trim();

  const views = candidates
    // Hard visibility gate — inactive/suspended never surface.
    .filter(isPubliclyVisible)
    .map((pro): ProfessionalCardView => {
      const distanceMi = ctx.viewer ? haversineMiles(ctx.viewer, { lat: pro.lat, lng: pro.lng }) : undefined;
      const cats = Array.from(new Set(publicServices(pro).map((s) => s.categorySlug))) as CategorySlug[];
      const relevance = q ? textRelevance(pro, q) : 0;
      const base = recommendedScore(pro, distanceMi);
      const relevanceScore = q ? RANKING_WEIGHTS.textRelevance * relevance + base : base;
      // Trust influences visibility: reliable providers rank higher, providers
      // with repeated cancellations (low reliability) are demoted.
      const score = relevanceScore * rankingMultiplierFromScore(pro.reliabilityScore);
      return { ...pro, distanceMi, categories: cats, startingPriceCents: startingPrice(pro), score };
    })
    .filter((v) => {
      if (q && !matchesQuery(v, q)) return false;
      if (params.category && !v.categories.includes(params.category)) return false;
      if (params.minRating != null && v.ratingAverage < params.minRating) return false;
      if (params.verifiedOnly && !v.isVerified) return false;
      if (params.instantOnly && !v.instantBook) return false;
      if (params.location && params.location !== "all" && v.locationType !== params.location) return false;
      if (params.minPriceCents != null && v.startingPriceCents < params.minPriceCents) return false;
      if (params.maxPriceCents != null && v.startingPriceCents > params.maxPriceCents) return false;
      if (params.distanceMi != null && v.distanceMi != null) {
        if (v.distanceMi > params.distanceMi) return false;
        if (!isReachable(v.distanceMi, v.locationType, v.serviceRadiusMiles)) return false;
      }
      return true;
    });

  return sortViews(views, params.sort ?? "recommended");
}

export function sortViews(views: ProfessionalCardView[], sort: SortKey): ProfessionalCardView[] {
  const out = [...views];
  switch (sort) {
    case "nearest":
      out.sort((a, b) => (a.distanceMi ?? Infinity) - (b.distanceMi ?? Infinity));
      break;
    case "rating":
      out.sort((a, b) => b.ratingAverage - a.ratingAverage || b.reviewCount - a.reviewCount);
      break;
    case "reviews":
      out.sort((a, b) => b.reviewCount - a.reviewCount || b.ratingAverage - a.ratingAverage);
      break;
    case "price_asc":
      out.sort((a, b) => a.startingPriceCents - b.startingPriceCents);
      break;
    case "earliest":
      // Proxy: instant-book first, then availability score, then rating.
      out.sort(
        (a, b) =>
          Number(b.instantBook) - Number(a.instantBook) ||
          availabilityScore(b) - availabilityScore(a) ||
          b.ratingAverage - a.ratingAverage,
      );
      break;
    case "recommended":
    default:
      out.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      break;
  }
  return out;
}
