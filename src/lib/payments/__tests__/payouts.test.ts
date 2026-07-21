import { describe, it, expect } from "vitest";
import { payoutAmountCents } from "../split";

describe("Connect payout split (Phase 11)", () => {
  it("pays the professional total minus the platform commission", () => {
    expect(payoutAmountCents(10000, 1500)).toBe(8500); // $100 booking, 15% fee → $85
    expect(payoutAmountCents(5000, 750)).toBe(4250);
    expect(payoutAmountCents(20000, 3000)).toBe(17000);
  });

  it("never pays a negative amount", () => {
    expect(payoutAmountCents(1000, 2000)).toBe(0);
    expect(payoutAmountCents(0, 0)).toBe(0);
  });

  it("rounds each operand to integer cents", () => {
    expect(payoutAmountCents(10000.4, 1500.4)).toBe(8500);
    expect(payoutAmountCents(9999.6, 1499.6)).toBe(8500); // 10000 − 1500
  });

  it("keeps 100% for the pro when there is no commission", () => {
    expect(payoutAmountCents(8000, 0)).toBe(8000);
  });
});
