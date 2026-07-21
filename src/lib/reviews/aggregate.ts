// Review aggregation. Pure → unit-tested. Computes the multi-dimension averages,
// rating distribution, lifetime rating, and repeat-customer percentage.

export interface ReviewRatings {
  overall: number; // 1–5
  professionalism?: number;
  communication?: number;
  punctuality?: number;
  cleanliness?: number;
  accuracy?: number;
}

export interface ReviewRecord {
  ratings: ReviewRatings;
  customerId: string;
  helpfulCount?: number;
}

export type DimensionKey = keyof ReviewRatings;

export interface ReviewAggregate {
  lifetimeRating: number;
  reviewCount: number;
  totalCompletedBookings: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  dimensions: Record<DimensionKey, number | null>;
  repeatCustomerPct: number;
}

const DIMENSIONS: DimensionKey[] = ["overall", "professionalism", "communication", "punctuality", "cleanliness", "accuracy"];

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}

export function aggregateReviews(reviews: ReviewRecord[], totalCompletedBookings = 0): ReviewAggregate {
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const dims: Record<DimensionKey, number[]> = {
    overall: [], professionalism: [], communication: [], punctuality: [], cleanliness: [], accuracy: [],
  };

  for (const r of reviews) {
    const star = Math.min(5, Math.max(1, Math.round(r.ratings.overall))) as 1 | 2 | 3 | 4 | 5;
    distribution[star] += 1;
    for (const d of DIMENSIONS) {
      const v = r.ratings[d];
      if (typeof v === "number") dims[d].push(v);
    }
  }

  const dimensions = Object.fromEntries(
    DIMENSIONS.map((d) => [d, dims[d].length ? avg(dims[d]) : null]),
  ) as Record<DimensionKey, number | null>;

  // Repeat customers: those who appear in more than one review.
  const counts = new Map<string, number>();
  for (const r of reviews) counts.set(r.customerId, (counts.get(r.customerId) ?? 0) + 1);
  const uniqueCustomers = counts.size;
  const repeatCustomers = [...counts.values()].filter((c) => c > 1).length;
  const repeatCustomerPct = uniqueCustomers > 0 ? Math.round((repeatCustomers / uniqueCustomers) * 100) : 0;

  return {
    lifetimeRating: dimensions.overall ?? 0,
    reviewCount: reviews.length,
    totalCompletedBookings,
    distribution,
    dimensions,
    repeatCustomerPct,
  };
}

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  overall: "Overall",
  professionalism: "Professionalism",
  communication: "Communication",
  punctuality: "Punctuality",
  cleanliness: "Cleanliness",
  accuracy: "Accuracy of listing",
};
