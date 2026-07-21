import { describe, it, expect } from "vitest";
import { reputationMetrics, reputationBadges, isTopPro, isNewProvider } from "../badges";

const base = {
  totalBookings: 0,
  completedBookings: 0,
  cancelledByProBookings: 0,
  respondableCount: 0,
  respondedWithinSlaCount: 0,
  distinctCustomers: 0,
  repeatCustomers: 0,
  ratingAverage: 0,
  reviewCount: 0,
  isVerified: false,
  accountAgeDays: 0,
};

describe("reputation metrics", () => {
  it("computes rates as ratios clamped to 0..1", () => {
    const m = reputationMetrics({
      ...base,
      totalBookings: 20,
      completedBookings: 18,
      cancelledByProBookings: 1,
      respondableCount: 10,
      respondedWithinSlaCount: 9,
      distinctCustomers: 8,
      repeatCustomers: 4,
    });
    expect(m.completionRate).toBeCloseTo(0.9);
    expect(m.cancellationRate).toBeCloseTo(0.05);
    expect(m.responseRate).toBeCloseTo(0.9);
    expect(m.repeatRate).toBeCloseTo(0.5);
  });
  it("returns 0 rates with no bookings (no divide-by-zero)", () => {
    const m = reputationMetrics(base);
    expect(m.completionRate).toBe(0);
    expect(m.responseRate).toBe(0);
  });
});

describe("reputation badges", () => {
  const topPro = {
    ...base,
    totalBookings: 30,
    completedBookings: 28,
    cancelledByProBookings: 1,
    respondableCount: 30,
    respondedWithinSlaCount: 29,
    distinctCustomers: 20,
    repeatCustomers: 12,
    ratingAverage: 4.9,
    reviewCount: 22,
    isVerified: true,
    accountAgeDays: 400,
  };

  it("awards Top Pro to an established, reliable, highly-rated pro", () => {
    expect(isTopPro(topPro)).toBe(true);
    expect(reputationBadges(topPro)).toEqual(["verified", "top_pro"]);
  });

  it("does not award Top Pro when reliability slips", () => {
    expect(isTopPro({ ...topPro, cancelledByProBookings: 6 })).toBe(false); // cancellation > 5%
    expect(isTopPro({ ...topPro, ratingAverage: 4.5 })).toBe(false);
  });

  it("marks a brand-new pro as New Provider (and not Top Pro)", () => {
    const newer = { ...base, accountAgeDays: 10, isVerified: false };
    expect(isNewProvider(newer)).toBe(true);
    expect(reputationBadges(newer)).toEqual(["new_provider"]);
  });

  it("verified badge is independent of tier", () => {
    expect(reputationBadges({ ...base, isVerified: true, accountAgeDays: 5 })).toEqual([
      "verified",
      "new_provider",
    ]);
  });
});
