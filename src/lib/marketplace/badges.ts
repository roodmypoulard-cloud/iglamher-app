import type { ProfessionalCardView } from "@/lib/data/model";

/** Selective badge logic — a card shows at most TWO, in priority order, so the
 *  labels keep their meaning (spec §29/§31). All derived from real fields. */
export type ProBadge = "pick" | "top_rated" | "popular";

export function isTopRated(p: ProfessionalCardView): boolean {
  return p.ratingAverage >= 4.8 && p.reviewCount >= 20;
}
export function isPopular(p: ProfessionalCardView): boolean {
  return p.isFeatured || p.reviewCount >= 40;
}

/** Ordered, de-duplicated badges (max 2) for a card. iGlamHer Pick outranks
 *  Top Rated, which outranks Popular. */
export function proBadges(p: ProfessionalCardView): ProBadge[] {
  const out: ProBadge[] = [];
  if (p.isRecommended) out.push("pick");
  if (isTopRated(p)) out.push("top_rated");
  if (isPopular(p)) out.push("popular");
  return out.slice(0, 2);
}

export const BADGE_LABEL: Record<ProBadge, string> = {
  pick: "iGlamHer Pick",
  top_rated: "Top Rated",
  popular: "Popular",
};
