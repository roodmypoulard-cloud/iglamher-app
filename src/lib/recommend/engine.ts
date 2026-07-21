// ============================================================
// Stylist recommendation engine — "Recommended For You".
//
// Personalized re-ranking over the existing marketplace data. Pure + deterministic
// → unit-tested. No external AI service required: this is a transparent weighted
// model over signals we already have (rating, reliability, distance, availability,
// price fit, category affinity, repeat/favorite affinity). Every weight is listed.
//
// This is honest personalization, not a black box — see MATCH_WEIGHTS.
// ============================================================
import type { Professional, ProfessionalCardView, CategorySlug, GeoPoint } from "@/lib/data/model";
import { haversineMiles } from "@/lib/data/geo";
import { isPubliclyVisible, publicServices, profileCompleteness } from "@/lib/marketplace/visibility";
import { rankingMultiplierFromScore } from "@/lib/trust/reliability";

export interface CustomerContext {
  viewer?: GeoPoint;
  /** Categories the customer has shown interest in (bookings, favorites, browsing). */
  preferredCategories?: CategorySlug[];
  /** Comfortable spend ceiling in cents (from past bookings or a stated budget). */
  budgetCents?: number;
  /** Professionals the customer has favorited. */
  favoriteIds?: string[];
  /** Professionals the customer has booked before (rebooking affinity). */
  pastProfessionalIds?: string[];
  now?: Date;
}

export const MATCH_WEIGHTS = {
  rating: 0.18,
  reliability: 0.14,
  distance: 0.14,
  availability: 0.10,
  completeness: 0.06,
  categoryAffinity: 0.16,
  budgetFit: 0.10,
  repeatAffinity: 0.08,
  favoriteAffinity: 0.04,
} as const;

export interface Recommendation extends ProfessionalCardView {
  matchScore: number; // 0..1
  reasons: string[]; // human-readable "why recommended"
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function startingPrice(pro: Professional): number {
  const svc = publicServices(pro);
  return svc.length ? Math.min(...svc.map((s) => s.priceCents)) : 0;
}

function categoriesOf(pro: Professional): CategorySlug[] {
  return Array.from(new Set(publicServices(pro).map((s) => s.categorySlug)));
}

/** Personalized 0..1 match score for one professional given a customer context. */
export function scoreMatch(
  pro: Professional,
  ctx: CustomerContext,
): { score: number; reasons: string[]; distanceMi?: number } {
  const w = MATCH_WEIGHTS;
  const reasons: string[] = [];

  const rating = clamp01(pro.ratingAverage / 5);
  const reliability = clamp01(pro.reliabilityScore / 100);

  const distanceMi = ctx.viewer ? haversineMiles(ctx.viewer, { lat: pro.lat, lng: pro.lng }) : undefined;
  const distance = distanceMi == null ? 0.5 : clamp01(1 - distanceMi / 25);
  if (distanceMi != null && distanceMi <= 5) reasons.push("Close to you");

  const availability = clamp01((pro.availability.length > 0 ? 0.6 : 0) + (pro.instantBook ? 0.4 : 0));
  if (pro.instantBook) reasons.push("Instant booking");

  const completeness = profileCompleteness(pro);

  // Category affinity: overlap between the customer's interests and the pro's categories.
  const cats = categoriesOf(pro);
  let categoryAffinity = 0;
  if (ctx.preferredCategories?.length) {
    const overlap = cats.filter((c) => ctx.preferredCategories!.includes(c));
    categoryAffinity = overlap.length ? 1 : 0;
    if (overlap.length) reasons.push(`Does ${overlap[0]}`);
  } else {
    categoryAffinity = 0.5; // neutral when we don't know preferences
  }

  // Budget fit: full credit if starting price is within budget, decaying above it.
  const start = startingPrice(pro);
  let budgetFit = 0.5;
  if (ctx.budgetCents && ctx.budgetCents > 0) {
    budgetFit = start <= ctx.budgetCents ? 1 : clamp01(1 - (start - ctx.budgetCents) / ctx.budgetCents);
    if (start <= ctx.budgetCents) reasons.push("In your budget");
  }

  const repeatAffinity = ctx.pastProfessionalIds?.includes(pro.userId) ? 1 : 0;
  if (repeatAffinity) reasons.push("You've booked before");
  const favoriteAffinity = ctx.favoriteIds?.includes(pro.userId) ? 1 : 0;

  if (pro.isVerified) reasons.push("Verified");

  const score =
    w.rating * rating +
    w.reliability * reliability +
    w.distance * distance +
    w.availability * availability +
    w.completeness * completeness +
    w.categoryAffinity * categoryAffinity +
    w.budgetFit * budgetFit +
    w.repeatAffinity * repeatAffinity +
    w.favoriteAffinity * favoriteAffinity;

  return { score: clamp01(score), reasons: reasons.slice(0, 3), distanceMi };
}

/** Rank the candidate set for a customer, returning the top recommendations. */
export function recommend(
  candidates: Professional[],
  ctx: CustomerContext,
  limit = 8,
): Recommendation[] {
  return candidates
    .filter(isPubliclyVisible)
    .map((pro): Recommendation => {
      const { score, reasons, distanceMi } = scoreMatch(pro, ctx);
      // Blend personalization with the trust multiplier so low-reliability pros
      // never top the personalized list either.
      const matchScore = clamp01(score * rankingMultiplierFromScore(pro.reliabilityScore));
      return {
        ...pro,
        distanceMi,
        categories: categoriesOf(pro),
        startingPriceCents: startingPrice(pro),
        score: matchScore,
        matchScore,
        reasons,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}
