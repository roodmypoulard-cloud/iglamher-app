// ============================================================
// Recommendation "shelves" — the named feeds the home + APIs expose.
// Pure + deterministic → unit-tested. Each shelf is a transparent ranking over
// existing data (no external AI service). "Recommended for you" lives in engine.ts.
// ============================================================
import type { Professional, ProfessionalCardView, GeoPoint, CategorySlug } from "@/lib/data/model";
import { haversineMiles } from "@/lib/data/geo";
import { isPubliclyVisible, publicServices } from "@/lib/marketplace/visibility";

export type ShelfKey =
  | "recommended"
  | "trending"
  | "top_rated"
  | "new"
  | "available_today"
  | "luxury";

export const SHELF_META: Record<ShelfKey, string> = {
  recommended: "Recommended for you",
  trending: "Trending near you",
  top_rated: "Top rated",
  new: "New providers",
  available_today: "Available today",
  luxury: "Luxury picks",
};

function toView(pro: Professional, viewer?: GeoPoint): ProfessionalCardView {
  const svc = publicServices(pro);
  return {
    ...pro,
    distanceMi: viewer ? haversineMiles(viewer, { lat: pro.lat, lng: pro.lng }) : undefined,
    categories: Array.from(new Set(svc.map((s) => s.categorySlug))) as CategorySlug[],
    startingPriceCents: svc.length ? Math.min(...svc.map((s) => s.priceCents)) : 0,
  };
}

const visible = (pros: Professional[]) => pros.filter(isPubliclyVisible);

/** Trending: booking momentum (jobs + reviews) weighted by proximity. */
export function trendingNearYou(pros: Professional[], viewer?: GeoPoint, limit = 8): ProfessionalCardView[] {
  return visible(pros)
    .map((p) => toView(p, viewer))
    .map((v) => {
      const momentum = Math.log10(v.jobsCompleted + 1) * 2 + Math.log10(v.reviewCount + 1);
      const proximity = v.distanceMi == null ? 0.5 : Math.max(0, 1 - v.distanceMi / 25);
      return { ...v, score: momentum * (0.6 + 0.4 * proximity) };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);
}

export function topRated(pros: Professional[], viewer?: GeoPoint, limit = 8): ProfessionalCardView[] {
  return visible(pros)
    .map((p) => toView(p, viewer))
    .filter((v) => v.reviewCount >= 1)
    .sort((a, b) => b.ratingAverage - a.ratingAverage || b.reviewCount - a.reviewCount)
    .slice(0, limit);
}

/** New providers: fewest completed jobs (freshest to the marketplace). */
export function newProviders(pros: Professional[], viewer?: GeoPoint, limit = 8): ProfessionalCardView[] {
  return visible(pros)
    .map((p) => toView(p, viewer))
    .sort((a, b) => a.jobsCompleted - b.jobsCompleted || b.ratingAverage - a.ratingAverage)
    .slice(0, limit);
}

/** Available today: instant-book first, then those with weekly hours. */
export function availableToday(pros: Professional[], viewer?: GeoPoint, limit = 8): ProfessionalCardView[] {
  return visible(pros)
    .filter((p) => p.instantBook || p.availability.length > 0)
    .map((p) => toView(p, viewer))
    .sort((a, b) => Number(b.instantBook) - Number(a.instantBook) || b.ratingAverage - a.ratingAverage)
    .slice(0, limit);
}

/** Luxury picks: premium starting price + strong rating + verified. */
export function luxuryPicks(pros: Professional[], viewer?: GeoPoint, limit = 8): ProfessionalCardView[] {
  return visible(pros)
    .map((p) => toView(p, viewer))
    .filter((v) => v.isVerified && v.ratingAverage >= 4.7)
    .sort((a, b) => b.startingPriceCents - a.startingPriceCents)
    .slice(0, limit);
}

export function buildShelf(key: Exclude<ShelfKey, "recommended">, pros: Professional[], viewer?: GeoPoint, limit = 8): ProfessionalCardView[] {
  switch (key) {
    case "trending": return trendingNearYou(pros, viewer, limit);
    case "top_rated": return topRated(pros, viewer, limit);
    case "new": return newProviders(pros, viewer, limit);
    case "available_today": return availableToday(pros, viewer, limit);
    case "luxury": return luxuryPicks(pros, viewer, limit);
  }
}
