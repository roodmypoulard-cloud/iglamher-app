import { describe, it, expect } from "vitest";
import {
  tierForLifetime, tierProgress, pointsForBooking, milestoneBonus,
  maxRedeemableCents, pointsForRedemption, canRedeem,
} from "@/lib/loyalty/engine";
import {
  generateReferralCode, checkReferralFraud, rewardFor,
} from "@/lib/referral/engine";
import {
  platformMetrics, activeUsers, bookingFunnel, lifetimeValue, retentionRate,
  type BookingFact, type EventFact,
} from "@/lib/analytics/metrics";
import {
  isEligible, discountCents, abVariant, bestDiscount, type Campaign,
} from "@/lib/marketing/campaigns";
import {
  providerEarnings, repeatCustomerRate, forecastNextPeriodCents, utilizationRate, optimizationSuggestions,
} from "@/lib/growth/provider-metrics";

// ---------- loyalty ----------
describe("loyalty engine", () => {
  it("maps lifetime points to tiers", () => {
    expect(tierForLifetime(0).tier).toBe("bronze");
    expect(tierForLifetime(500).tier).toBe("silver");
    expect(tierForLifetime(1500).tier).toBe("gold");
    expect(tierForLifetime(5000).tier).toBe("platinum");
  });
  it("computes tier progress to the next tier", () => {
    const p = tierProgress(1000); // silver, next gold at 1500
    expect(p.tier.tier).toBe("silver");
    expect(p.next?.tier).toBe("gold");
    expect(p.pointsToNext).toBe(500);
    expect(p.progressPct).toBe(50);
  });
  it("earns points with a tier multiplier", () => {
    expect(pointsForBooking(10000, 0)).toBe(100); // bronze $100 -> 100 pts
    expect(pointsForBooking(10000, 1500)).toBe(125); // gold 1.25x
  });
  it("awards milestone bonuses", () => {
    expect(milestoneBonus(1)).toBe(100);
    expect(milestoneBonus(10)).toBe(500);
    expect(milestoneBonus(3)).toBe(0);
  });
  it("handles redemption math", () => {
    expect(maxRedeemableCents(250)).toBe(1000); // 2 units * $5
    expect(pointsForRedemption(500)).toBe(100);
    expect(canRedeem(100, 500)).toBe(true);
    expect(canRedeem(50, 500)).toBe(false);
  });
});

// ---------- referral ----------
describe("referral engine", () => {
  it("generates a deterministic, readable code", () => {
    const a = generateReferralCode("user-123");
    const b = generateReferralCode("user-123");
    expect(a).toBe(b);
    expect(a).toMatch(/^GLAM-[A-Z0-9]{6}$/);
    expect(generateReferralCode("user-999")).not.toBe(a);
  });
  it("rejects self-referral and abuse", () => {
    expect(checkReferralFraud({ referrerId: "u1", referredId: "u1" }).ok).toBe(false);
    expect(checkReferralFraud({ referrerId: "u1", referredId: "u2" }).ok).toBe(true);
  });
  it("enforces IP and referrer velocity caps (Phase 10 hardening)", () => {
    // 5+ accepted referrals from one IP in 24h → blocked
    expect(checkReferralFraud({ referrerId: "u1", referredId: "u2", ipReferralsLast24h: 5 }).ok).toBe(false);
    expect(checkReferralFraud({ referrerId: "u1", referredId: "u2", ipReferralsLast24h: 4 }).ok).toBe(true);
    // 20+ referrals from one referrer in 24h → blocked
    expect(checkReferralFraud({ referrerId: "u1", referredId: "u2", referrerReferralsLast24h: 20 }).ok).toBe(false);
  });
  it("pays the configured rewards per referral kind (granted only at first paid booking)", () => {
    expect(rewardFor("professional").referrerCreditCents).toBe(5000);
    expect(rewardFor("professional").referredCreditCents).toBe(0);
    expect(rewardFor("customer")).toEqual({ referrerCreditCents: 1500, referredCreditCents: 1500, referrerPoints: 250 });
  });
});

// ---------- analytics ----------
const bookings: BookingFact[] = [
  { id: "1", customerId: "c1", professionalId: "p1", status: "completed", totalCents: 10000, platformFeeCents: 1500, createdAt: "2026-06-01T10:00:00Z", startsAt: "2026-06-02T10:00:00Z" },
  { id: "2", customerId: "c1", professionalId: "p2", status: "completed", totalCents: 8000, platformFeeCents: 1200, createdAt: "2026-06-10T10:00:00Z", startsAt: "2026-06-11T10:00:00Z" },
  { id: "3", customerId: "c2", professionalId: "p1", status: "cancelled_customer", totalCents: 5000, platformFeeCents: 0, createdAt: "2026-06-05T10:00:00Z", startsAt: "2026-06-06T10:00:00Z" },
  { id: "4", customerId: "c3", professionalId: "p1", status: "confirmed", totalCents: 12000, platformFeeCents: 1800, createdAt: "2026-06-20T10:00:00Z", startsAt: "2026-07-30T10:00:00Z" },
];

describe("analytics metrics", () => {
  it("computes GMV, revenue, and rates", () => {
    const m = platformMetrics(bookings);
    expect(m.gmvCents).toBe(30000); // 10000+8000+12000 (paid), cancelled excluded
    expect(m.platformRevenueCents).toBe(4500);
    expect(m.completedBookings).toBe(2);
    expect(m.paidBookings).toBe(3);
    // decided = 2 completed + 1 cancelled = 3; cancelled 1 -> 1/3
    expect(m.cancellationRate).toBeCloseTo(0.3333, 3);
    // Paying customers are c1 (2 bookings) + c3 (1); c2's booking was cancelled.
    // 1 repeat of 2 paying customers -> 0.5
    expect(m.repeatCustomerRate).toBeCloseTo(0.5, 3);
  });
  it("computes DAU/MAU windows", () => {
    const events: EventFact[] = [
      { userId: "u1", event: "search_submitted", createdAt: "2026-06-30T10:00:00Z" },
      { userId: "u2", event: "professional_viewed", createdAt: "2026-06-15T10:00:00Z" },
      { userId: "u1", event: "professional_viewed", createdAt: "2026-05-01T10:00:00Z" },
    ];
    expect(activeUsers(events, "2026-06-30T23:59:59Z", 1)).toBe(1); // only u1 today
    expect(activeUsers(events, "2026-06-30T23:59:59Z", 30)).toBe(2); // u1+u2 in 30d
  });
  it("builds the booking funnel with conversion", () => {
    const events: EventFact[] = [
      ...Array(100).fill(0).map((_, i) => ({ userId: `u${i}`, event: "search_submitted", createdAt: "2026-06-01T10:00:00Z" })),
      ...Array(40).fill(0).map((_, i) => ({ userId: `u${i}`, event: "professional_viewed", createdAt: "2026-06-01T10:00:00Z" })),
      ...Array(10).fill(0).map((_, i) => ({ userId: `u${i}`, event: "booking_confirmed", createdAt: "2026-06-01T10:00:00Z" })),
    ];
    const funnel = bookingFunnel(events);
    expect(funnel[0].count).toBe(100);
    expect(funnel[1].conversionFromTop).toBeCloseTo(0.4, 3);
    expect(funnel.at(-1)!.conversionFromTop).toBeCloseTo(0.1, 3);
  });
  it("computes CLV and retention", () => {
    const clv = lifetimeValue(bookings);
    expect(clv.maxCents).toBe(18000); // c1: 10000+8000
    expect(retentionRate(bookings, 30)).toBeGreaterThan(0); // c1 rebooked within 30d
  });
});

// ---------- marketing ----------
describe("marketing campaigns", () => {
  const base: Campaign = {
    id: "camp1", name: "Spring", type: "seasonal", discountType: "percent", discountValue: 20,
    isActive: true, startsAt: "2026-06-01T00:00:00Z", endsAt: "2026-06-30T23:59:59Z",
  };
  const ctx = { now: "2026-06-15T10:00:00Z", subtotalCents: 10000, userId: "u1", city: "Downtown LA" };

  it("respects active window", () => {
    expect(isEligible(base, ctx)).toBe(true);
    expect(isEligible(base, { ...ctx, now: "2026-07-15T10:00:00Z" })).toBe(false);
  });
  it("computes percent + fixed discounts, capped at subtotal", () => {
    expect(discountCents(base, 10000)).toBe(2000);
    expect(discountCents({ ...base, discountType: "fixed", discountValue: 999999 }, 5000)).toBe(5000);
  });
  it("geo-targets by city", () => {
    const geo = { ...base, cities: ["Santa Monica"] };
    expect(isEligible(geo, ctx)).toBe(false);
    expect(isEligible(geo, { ...ctx, city: "Santa Monica" })).toBe(true);
  });
  it("A/B bucketing is deterministic per user", () => {
    expect(abVariant("camp1", "userX")).toBe(abVariant("camp1", "userX"));
  });
  it("picks the best applicable discount", () => {
    const best = bestDiscount([base, { ...base, id: "c2", discountType: "fixed", discountValue: 3000 }], ctx);
    expect(best?.discountCents).toBe(3000); // fixed $30 beats 20% of $100 = $20
  });
});

// ---------- provider growth ----------
describe("provider growth metrics", () => {
  const proBookings = bookings.filter((b) => b.professionalId === "p1");
  it("computes earnings net of platform fees", () => {
    const e = providerEarnings(proBookings);
    expect(e.grossCents).toBe(22000); // 10000 + 12000 (paid p1)
    expect(e.platformFeesCents).toBe(3300);
    expect(e.netEarningsCents).toBe(18700);
  });
  it("computes repeat customer rate", () => {
    expect(repeatCustomerRate(bookings)).toBeGreaterThanOrEqual(0);
  });
  it("forecasts from a trailing average", () => {
    expect(forecastNextPeriodCents([100, 200, 300, 400])).toBe(250);
    expect(forecastNextPeriodCents([])).toBe(0);
  });
  it("computes utilization and suggestions", () => {
    expect(utilizationRate(300, 600)).toBe(0.5);
    const s = optimizationSuggestions({ utilization: 0.9, cancellationRate: 0.2, completionRate: 0.8, avgTicketCents: 5000, marketAvgTicketCents: 10000 });
    expect(s.map((x) => x.kind)).toEqual(expect.arrayContaining(["add_availability", "reduce_cancellation", "adjust_price"]));
  });
});
