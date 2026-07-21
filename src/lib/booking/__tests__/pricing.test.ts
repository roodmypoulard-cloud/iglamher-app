import { describe, it, expect } from "vitest";
import { computeBooking, computeDeposit, cancellationFee } from "../pricing";

describe("computeBooking", () => {
  it("sums service + add-ons into subtotal", () => {
    const b = computeBooking({ serviceCents: 8500, addonsCents: 2500, takeRateBps: 1500 });
    expect(b.subtotalCents).toBe(11000);
    expect(b.totalCents).toBe(11000);
  });

  it("applies the platform commission to the commission base (not tax/tip)", () => {
    const b = computeBooking({ serviceCents: 10000, takeRateBps: 1500, tipCents: 2000, taxRateBps: 1000 });
    // commission base = 10000; fee = 1500
    expect(b.platformFeeCents).toBe(1500);
    // tax = 10% of 10000 = 1000; total = 10000 + 1000 tax + 2000 tip
    expect(b.taxCents).toBe(1000);
    expect(b.totalCents).toBe(13000);
    // pro nets subtotal - fee + tip = 10000 - 1500 + 2000
    expect(b.professionalNetCents).toBe(10500);
  });

  it("includes travel fee in commission base and total", () => {
    const b = computeBooking({ serviceCents: 9000, travelFeeCents: 3000, takeRateBps: 1500 });
    expect(b.totalCents).toBe(12000);
    expect(b.platformFeeCents).toBe(Math.round(12000 * 0.15)); // 1800
    expect(b.professionalNetCents).toBe(12000 - 1800);
  });

  it("applies a discount before tax and to the commission base", () => {
    const b = computeBooking({ serviceCents: 10000, discountCents: 1500, taxRateBps: 1000, takeRateBps: 1500 });
    // taxable base = 10000 - 1500 = 8500; tax = 850
    expect(b.taxCents).toBe(850);
    expect(b.totalCents).toBe(10000 - 1500 + 850);
    // commission base = 10000 - 1500 = 8500; fee = 1275
    expect(b.platformFeeCents).toBe(1275);
  });

  it("never produces negative or fractional cents", () => {
    const b = computeBooking({ serviceCents: 999, addonsCents: 1, takeRateBps: 1500, discountCents: 5000 });
    expect(Number.isInteger(b.totalCents)).toBe(true);
    expect(b.totalCents).toBeGreaterThanOrEqual(0);
    expect(b.discountCents).toBeLessThanOrEqual(1000);
  });

  it("emits line items for every non-zero component", () => {
    const b = computeBooking({ serviceCents: 8000, addonsCents: 1500, travelFeeCents: 2000, tipCents: 1000, taxRateBps: 500, takeRateBps: 1500 });
    const kinds = b.lineItems.map((l) => l.kind);
    expect(kinds).toEqual(expect.arrayContaining(["service", "addon", "upcharge", "tax", "tip"]));
  });
});

describe("computeDeposit", () => {
  it("full/none returns the whole total", () => {
    expect(computeDeposit(10000, { type: "full" })).toBe(10000);
    expect(computeDeposit(10000, undefined)).toBe(10000);
  });
  it("percent computes a rounded fraction", () => {
    expect(computeDeposit(10000, { type: "percent", value: 20 })).toBe(2000);
    expect(computeDeposit(9999, { type: "percent", value: 20 })).toBe(2000);
  });
  it("fixed is capped at the total", () => {
    expect(computeDeposit(5000, { type: "fixed", value: 8000 })).toBe(5000);
    expect(computeDeposit(10000, { type: "fixed", value: 3000 })).toBe(3000);
  });
});

describe("cancellationFee", () => {
  it("is free with 48h+ notice", () => {
    expect(cancellationFee(4000, 72)).toEqual({ feeCents: 0, refundCents: 4000, tier: "free" });
  });
  it("charges half the deposit between 24 and 48h", () => {
    expect(cancellationFee(4000, 36)).toEqual({ feeCents: 2000, refundCents: 2000, tier: "half" });
  });
  it("charges the full deposit under 24h", () => {
    expect(cancellationFee(4000, 3)).toEqual({ feeCents: 4000, refundCents: 0, tier: "full" });
  });
});
