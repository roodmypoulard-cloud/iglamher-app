import { describe, it, expect } from "vitest";
import { formatPrice, formatRating, formatDistance, formatApproxDistance, formatDistanceFor } from "@/lib/format";

describe("formatPrice (money in cents)", () => {
  it("whole dollars have no decimals", () => {
    expect(formatPrice(8500)).toBe("$85");
    expect(formatPrice(0)).toBe("$0");
  });
  it("cents render two decimals", () => {
    expect(formatPrice(8550)).toBe("$85.50");
  });
  it("supports a 'from' prefix", () => {
    expect(formatPrice(16000, { from: true })).toBe("from $160");
  });
});

describe("formatRating / formatDistance", () => {
  it("rating to one decimal", () => {
    expect(formatRating(5)).toBe("5.0");
    expect(formatRating(4.95)).toBe("5.0");
  });
  it("distance label", () => {
    expect(formatDistance(0.5)).toBe("0.5 mi away");
  });
});

// C3 leak 2: precise distance defeats a hidden pin. A viewer who moves and
// re-reads a 0.1-mi distance intersects the circles down to a building.
describe("formatApproxDistance (hidden-pin bucketing)", () => {
  it("buckets instead of reporting a precise radius", () => {
    expect(formatApproxDistance(0.4)).toBe("Under 1 mi away");
    expect(formatApproxDistance(1)).toBe("1–3 mi away");
    expect(formatApproxDistance(2.9)).toBe("1–3 mi away");
    expect(formatApproxDistance(3)).toBe("3–5 mi away");
    expect(formatApproxDistance(9.99)).toBe("5–10 mi away");
    expect(formatApproxDistance(12)).toBe("10–20 mi away");
    expect(formatApproxDistance(40)).toBe("20+ mi away");
  });

  it("never leaks a decimal that could be trilaterated", () => {
    for (const mi of [0.1, 0.55, 1.234, 4.9, 7.77, 19.9, 100]) {
      expect(formatApproxDistance(mi)).not.toMatch(/\d\.\d/);
    }
  });

  it("two nearby distances are indistinguishable inside a bucket", () => {
    // The trilateration attack needs the label to CHANGE as the viewer moves.
    expect(formatApproxDistance(3.1)).toBe(formatApproxDistance(4.8));
    expect(formatApproxDistance(5.1)).toBe(formatApproxDistance(9.8));
  });

  it("formatDistanceFor honours the pro's privacy choice", () => {
    expect(formatDistanceFor(2.34, true)).toBe("1–3 mi away");
    expect(formatDistanceFor(2.34, false)).toBe("2.3 mi away");
  });

  it("a hidden pin never yields the precise string", () => {
    for (const mi of [0.2, 1.7, 6.4, 15.5]) {
      expect(formatDistanceFor(mi, true)).not.toBe(formatDistance(mi));
    }
  });
});
