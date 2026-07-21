import { describe, it, expect } from "vitest";
import { stylistReliability, customerReliability } from "../reliability";
import { deriveBadges, isTopRated } from "../badges";
import { scoreFraud } from "../fraud";

describe("stylist reliability", () => {
  it("gives new stylists a neutral-good baseline (no penalty)", () => {
    const r = stylistReliability({
      bookingsAccepted: 0, bookingsDeclined: 0, bookingsCompleted: 0,
      bookingsCancelledByPro: 0, noShows: 0, lateArrivals: 0, avgResponseMinutes: null, totalBookings: 0,
    });
    expect(r.score).toBe(80);
    expect(r.rankingMultiplier).toBe(1);
  });

  it("rewards a strong track record", () => {
    const r = stylistReliability({
      bookingsAccepted: 100, bookingsDeclined: 5, bookingsCompleted: 98,
      bookingsCancelledByPro: 1, noShows: 0, lateArrivals: 2, avgResponseMinutes: 20, totalBookings: 105,
    });
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.tier).toBe("excellent");
    expect(r.rankingMultiplier).toBeGreaterThan(1);
  });

  it("sinks ranking for repeated cancellations (mandatory rule)", () => {
    const reliable = stylistReliability({
      bookingsAccepted: 50, bookingsDeclined: 2, bookingsCompleted: 48,
      bookingsCancelledByPro: 1, noShows: 0, lateArrivals: 0, avgResponseMinutes: 30, totalBookings: 52,
    });
    const cancels = stylistReliability({
      bookingsAccepted: 50, bookingsDeclined: 2, bookingsCompleted: 25,
      bookingsCancelledByPro: 20, noShows: 5, lateArrivals: 5, avgResponseMinutes: 120, totalBookings: 52,
    });
    expect(cancels.rankingMultiplier).toBeLessThan(reliable.rankingMultiplier);
    expect(cancels.rankingMultiplier).toBeLessThan(0.65); // repeated cancels heavily penalized
    expect(cancels.score).toBeLessThan(reliable.score);
    expect(["fair", "at_risk"]).toContain(cancels.tier);
  });
});

describe("customer reliability", () => {
  it("penalizes cancellations and no-shows", () => {
    const good = customerReliability({ bookingsMade: 10, cancellations: 0, lateCancellations: 0, noShows: 0 });
    const bad = customerReliability({ bookingsMade: 10, cancellations: 5, lateCancellations: 3, noShows: 2 });
    expect(good.score).toBe(100);
    expect(bad.score).toBeLessThan(good.score);
  });
});

describe("trust badges", () => {
  it("derives badges only from verified state", () => {
    const badges = deriveBadges({
      identityVerified: true, licenseVerified: true, insured: false, backgroundChecked: false,
      ratingAverage: 5, reviewCount: 40, reliabilityScore: 92,
    });
    expect(badges).toContain("identity_verified");
    expect(badges).toContain("licensed");
    expect(badges).toContain("top_rated");
    expect(badges).not.toContain("insured");
  });

  it("top rated needs rating + volume + reliability", () => {
    expect(isTopRated(4.9, 25, 90)).toBe(true);
    expect(isTopRated(4.9, 5, 90)).toBe(false); // too few reviews
    expect(isTopRated(4.5, 25, 90)).toBe(false); // rating too low
    expect(isTopRated(4.9, 25, 70)).toBe(false); // unreliable
  });
});

describe("fraud scoring", () => {
  it("scores a clean account as low risk", () => {
    const r = scoreFraud({
      accountAgeHours: 720, sharedPaymentMethodAccounts: 0, sharedDeviceAccounts: 0,
      bookingsLast24h: 1, cancellationRate: 0.05, chargebackCount: 0,
      distinctLocationsLast24h: 1, reviewsWrittenLast24h: 0, failedPaymentsLast24h: 0,
    });
    expect(r.level).toBe("low");
    expect(r.reasons).toHaveLength(0);
  });

  it("flags a fresh account sharing a card with chargebacks as critical", () => {
    const r = scoreFraud({
      accountAgeHours: 0.5, sharedPaymentMethodAccounts: 3, sharedDeviceAccounts: 4,
      bookingsLast24h: 10, cancellationRate: 0.6, chargebackCount: 2,
      distinctLocationsLast24h: 4, reviewsWrittenLast24h: 6, failedPaymentsLast24h: 4,
    });
    expect(r.level).toBe("critical");
    expect(r.reasons).toEqual(expect.arrayContaining(["Chargeback history", "Payment method shared across accounts"]));
  });
});
