// Trust badge derivation. Pure → unit-tested. Badges are computed from
// admin-approved verification state + reputation, never set by the pro.
//
// C4: every badge names exactly ONE thing an admin actually checked. There is
// deliberately no blanket "Verified" badge — a single flag rendered as
// "identity and professional information reviewed" claimed far more than the
// review established. Each label below maps 1:1 to a column an admin writes.

export type TrustBadge =
  | "identity_verified"
  | "licensed"
  | "insured"
  | "home_studio_reviewed"
  | "salon_location_verified"
  | "top_rated";

export interface BadgeInput {
  /** Admin verified a government ID document. */
  identityVerified: boolean;
  /** Admin verified a professional license / credential document. */
  licenseVerified: boolean;
  /** Admin verified a liability insurance document. */
  insured: boolean;
  /** Admin reviewed the home-studio compliance answers. */
  homeStudioReviewed: boolean;
  /** Admin verified the salon / commercial location. */
  salonLocationVerified: boolean;
  ratingAverage: number;
  reviewCount: number;
  reliabilityScore: number;
}

/** `description` is the honest, specific meaning — surfaced on hover/focus so a
 *  badge can never be read as a broader guarantee than what was actually checked. */
export const BADGE_META: Record<TrustBadge, { label: string; icon: string; description: string }> = {
  identity_verified: {
    label: "ID Verified",
    icon: "✓",
    description: "iGlamHer reviewed a government-issued ID for this professional.",
  },
  licensed: {
    label: "License on File",
    icon: "✓",
    description: "iGlamHer reviewed a professional license or credential document. This is not confirmation that the license is currently active with the issuing authority.",
  },
  insured: {
    label: "Insurance on File",
    icon: "✓",
    description: "iGlamHer reviewed a liability insurance document. Maintaining coverage is the professional's responsibility.",
  },
  home_studio_reviewed: {
    label: "Home Studio Reviewed",
    icon: "✓",
    description: "iGlamHer reviewed this professional's home-studio answers. It is not a permit, zoning approval, or permission to operate.",
  },
  salon_location_verified: {
    label: "Salon Location Verified",
    icon: "✓",
    description: "iGlamHer confirmed this professional works from the salon or commercial location listed.",
  },
  top_rated: {
    label: "Top Rated",
    icon: "★",
    description: "Based on client ratings and completed-booking reliability on iGlamHer.",
  },
};

/** Verification badges (admin-checked facts), as opposed to reputation. */
export const VERIFICATION_BADGES: TrustBadge[] = [
  "identity_verified", "licensed", "insured", "home_studio_reviewed", "salon_location_verified",
];

export function isVerificationBadge(b: TrustBadge): boolean {
  return VERIFICATION_BADGES.includes(b);
}

/** Top Rated = strong average, enough reviews, and a reliable track record. */
export function isTopRated(ratingAverage: number, reviewCount: number, reliabilityScore: number): boolean {
  return ratingAverage >= 4.8 && reviewCount >= 20 && reliabilityScore >= 85;
}

export function deriveBadges(input: BadgeInput): TrustBadge[] {
  const badges: TrustBadge[] = [];
  if (input.identityVerified) badges.push("identity_verified");
  if (input.licenseVerified) badges.push("licensed");
  if (input.insured) badges.push("insured");
  if (input.homeStudioReviewed) badges.push("home_studio_reviewed");
  if (input.salonLocationVerified) badges.push("salon_location_verified");
  if (isTopRated(input.ratingAverage, input.reviewCount, input.reliabilityScore)) badges.push("top_rated");
  return badges;
}
