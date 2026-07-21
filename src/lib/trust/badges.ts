// Trust badge derivation. Pure → unit-tested. Badges are computed from
// verification state + reputation, never set by the provider themselves.

export type TrustBadge =
  | "identity_verified"
  | "licensed"
  | "insured"
  | "top_rated"
  | "background_checked";

export interface BadgeInput {
  identityVerified: boolean;
  licenseVerified: boolean;
  insured: boolean;
  backgroundChecked: boolean;
  ratingAverage: number;
  reviewCount: number;
  reliabilityScore: number;
}

export const BADGE_META: Record<TrustBadge, { label: string; icon: string }> = {
  identity_verified: { label: "Identity Verified", icon: "✓" },
  licensed: { label: "Licensed Professional", icon: "✓" },
  insured: { label: "Insured", icon: "✓" },
  top_rated: { label: "Top Rated", icon: "★" },
  background_checked: { label: "Background Checked", icon: "✓" },
};

/** Top Rated = strong average, enough reviews, and a reliable track record. */
export function isTopRated(ratingAverage: number, reviewCount: number, reliabilityScore: number): boolean {
  return ratingAverage >= 4.8 && reviewCount >= 20 && reliabilityScore >= 85;
}

export function deriveBadges(input: BadgeInput): TrustBadge[] {
  const badges: TrustBadge[] = [];
  if (input.identityVerified) badges.push("identity_verified");
  if (input.licenseVerified) badges.push("licensed");
  if (input.insured) badges.push("insured");
  if (input.backgroundChecked) badges.push("background_checked");
  if (isTopRated(input.ratingAverage, input.reviewCount, input.reliabilityScore)) badges.push("top_rated");
  return badges;
}
