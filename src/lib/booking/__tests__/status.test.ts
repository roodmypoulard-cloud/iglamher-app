import { describe, it, expect } from "vitest";
import { canTransition, allowedTransitions, reservesTime, isActive } from "../status";

describe("booking status machine", () => {
  it("confirms a paid booking only via the system", () => {
    expect(canTransition("pending_payment", "confirmed", "system")).toBe(true);
    expect(canTransition("pending_payment", "confirmed", "customer")).toBe(false);
  });

  it("lets a professional start and complete a confirmed booking", () => {
    expect(canTransition("confirmed", "in_progress", "professional")).toBe(true);
    expect(canTransition("in_progress", "completed", "professional")).toBe(true);
    expect(canTransition("in_progress", "completed", "customer")).toBe(false);
  });

  it("lets either party cancel a confirmed booking", () => {
    expect(canTransition("confirmed", "cancelled_customer", "customer")).toBe(true);
    expect(canTransition("confirmed", "cancelled_professional", "professional")).toBe(true);
  });

  it("does not allow skipping straight from pending to completed", () => {
    expect(canTransition("pending_payment", "completed", "professional")).toBe(false);
  });

  it("refunded is terminal", () => {
    expect(allowedTransitions("refunded")).toHaveLength(0);
  });

  it("only admins can refund a completed booking", () => {
    expect(canTransition("completed", "refunded", "admin")).toBe(true);
    expect(canTransition("completed", "refunded", "professional")).toBe(false);
  });

  it("reservesTime holds the slot for active + completed bookings", () => {
    expect(reservesTime("confirmed")).toBe(true);
    expect(reservesTime("pending_payment")).toBe(true);
    expect(reservesTime("cancelled_customer")).toBe(false);
    expect(reservesTime("refunded")).toBe(false);
  });

  it("isActive tracks in-flight bookings", () => {
    expect(isActive("confirmed")).toBe(true);
    expect(isActive("completed")).toBe(false);
  });
});
