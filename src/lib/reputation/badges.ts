// Professional reputation metrics + badges. Pure, deterministic, unit-testable.
// Consumed by the profile/search layers to surface trust signals; the raw counts
// come from bookings/reviews/messages aggregates.

export interface ReputationInput {
  totalBookings: number;
  completedBookings: number;
  cancelledByProBookings: number;
  /** Bookings/enquiries that required a first response. */
  respondableCount: number;
  /** Of those, how many were responded to within the SLA window. */
  respondedWithinSlaCount: number;
  distinctCustomers: number;
  /** Customers with more than one booking. */
  repeatCustomers: number;
  ratingAverage: number;
  reviewCount: number;
  isVerified: boolean;
  accountAgeDays: number;
}

export interface ReputationMetrics {
  completionRate: number; // 0..1
  cancellationRate: number; // 0..1
  responseRate: number; // 0..1
  repeatRate: number; // 0..1
}

export type ReputationBadge = "verified" | "top_pro" | "new_provider";

const ratio = (num: number, den: number) => (den > 0 ? Math.min(1, Math.max(0, num / den)) : 0);

export function reputationMetrics(i: ReputationInput): ReputationMetrics {
  return {
    completionRate: ratio(i.completedBookings, i.totalBookings),
    cancellationRate: ratio(i.cancelledByProBookings, i.totalBookings),
    responseRate: ratio(i.respondedWithinSlaCount, i.respondableCount),
    repeatRate: ratio(i.repeatCustomers, i.distinctCustomers),
  };
}

/** Thresholds for the "Top Pro" badge — established, highly-rated, reliable. */
export const TOP_PRO = {
  minCompleted: 10,
  minRating: 4.8,
  minReviews: 5,
  minCompletionRate: 0.9,
  maxCancellationRate: 0.05,
  minResponseRate: 0.9,
} as const;

/** New-provider window (recently joined and not yet established). */
export const NEW_PROVIDER = { maxAccountAgeDays: 45, maxCompleted: 3 } as const;

export function isTopPro(i: ReputationInput): boolean {
  const m = reputationMetrics(i);
  return (
    i.completedBookings >= TOP_PRO.minCompleted &&
    i.ratingAverage >= TOP_PRO.minRating &&
    i.reviewCount >= TOP_PRO.minReviews &&
    m.completionRate >= TOP_PRO.minCompletionRate &&
    m.cancellationRate <= TOP_PRO.maxCancellationRate &&
    m.responseRate >= TOP_PRO.minResponseRate
  );
}

export function isNewProvider(i: ReputationInput): boolean {
  return i.accountAgeDays <= NEW_PROVIDER.maxAccountAgeDays || i.completedBookings < NEW_PROVIDER.maxCompleted;
}

/** Ordered list of earned badges (verified first, then the primary tier badge). */
export function reputationBadges(i: ReputationInput): ReputationBadge[] {
  const badges: ReputationBadge[] = [];
  if (i.isVerified) badges.push("verified");
  if (isTopPro(i)) badges.push("top_pro");
  else if (isNewProvider(i)) badges.push("new_provider");
  return badges;
}
