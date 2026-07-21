import { describe, it, expect } from "vitest";
import { formatPrice, formatRating, formatDistance } from "@/lib/format";

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
