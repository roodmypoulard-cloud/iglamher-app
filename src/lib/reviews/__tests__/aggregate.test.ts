import { describe, it, expect } from "vitest";
import { aggregateReviews } from "../aggregate";

const r = (customerId: string, overall: number, extra = {}) => ({ customerId, ratings: { overall, ...extra } });

describe("review aggregation", () => {
  it("returns zeros for no reviews", () => {
    const a = aggregateReviews([]);
    expect(a.reviewCount).toBe(0);
    expect(a.lifetimeRating).toBe(0);
    expect(a.repeatCustomerPct).toBe(0);
  });

  it("computes lifetime rating and distribution", () => {
    const a = aggregateReviews([r("c1", 5), r("c2", 5), r("c3", 4), r("c4", 3)]);
    expect(a.reviewCount).toBe(4);
    expect(a.lifetimeRating).toBe(4.25);
    expect(a.distribution[5]).toBe(2);
    expect(a.distribution[4]).toBe(1);
    expect(a.distribution[3]).toBe(1);
  });

  it("averages each dimension independently", () => {
    const a = aggregateReviews([
      r("c1", 5, { professionalism: 5, cleanliness: 4 }),
      r("c2", 4, { professionalism: 3, cleanliness: 5 }),
    ]);
    expect(a.dimensions.professionalism).toBe(4);
    expect(a.dimensions.cleanliness).toBe(4.5);
    expect(a.dimensions.punctuality).toBeNull(); // never provided
  });

  it("computes repeat-customer percentage", () => {
    // c1 appears twice → 1 of 3 unique customers is a repeat → 33%.
    const a = aggregateReviews([r("c1", 5), r("c1", 4), r("c2", 5), r("c3", 4)]);
    expect(a.repeatCustomerPct).toBe(33);
  });

  it("carries total completed bookings through", () => {
    const a = aggregateReviews([r("c1", 5)], 120);
    expect(a.totalCompletedBookings).toBe(120);
  });
});
