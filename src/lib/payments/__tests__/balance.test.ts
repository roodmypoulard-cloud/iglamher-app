import { describe, it, expect, vi, beforeEach } from "vitest";

// balance.ts is server-only and talks to Stripe + Supabase; both are mocked so
// these tests exercise the money-path logic (guards, idempotency, failure
// handling) without any network or secrets.
vi.mock("server-only", () => ({}));

const paymentIntents = {
  create: vi.fn(),
  capture: vi.fn(),
  cancel: vi.fn(),
};
vi.mock("../stripe", () => ({
  getStripe: async () => ({ paymentIntents }),
}));

const resolveChargeIdentity = vi.fn();
vi.mock("../customer", () => ({
  resolveChargeIdentity: (...args: unknown[]) => resolveChargeIdentity(...args),
}));

import { holdBookingBalance, captureBookingBalance, releaseBookingBalance } from "../balance";

type Row = Record<string, unknown>;

/**
 * Minimal chainable stand-in for the Supabase admin client covering the exact
 * call shapes balance.ts uses:
 *   from().select().eq().maybeSingle() · from().update().eq() · from().upsert()
 */
function fakeAdmin(booking: Row | null) {
  const updates: Array<{ table: string; payload: Row }> = [];
  const upserts: Array<{ table: string; payload: Row; options?: Row }> = [];
  const admin = {
    from(table: string) {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: table === "bookings" ? booking : null }) }),
        }),
        update: (payload: Row) => {
          updates.push({ table, payload });
          return { eq: async () => ({ error: null }) };
        },
        upsert: async (payload: Row, options?: Row) => {
          upserts.push({ table, payload, options });
          return { error: null };
        },
      };
    },
  };
  // Structural typing: balance.ts only calls the methods stubbed above.
  return { admin: admin as never, updates, upserts };
}

function booking(overrides: Row = {}): Row {
  return {
    id: "bk_1",
    customer_id: "user_1",
    total_cents: 20000,
    amount_due_now_cents: 5000,
    platform_fee_cents: 3000,
    stripe_customer_id: "cus_1",
    stripe_payment_method_id: "pm_1",
    balance_hold_pi_id: null,
    balance_status: "pending",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveChargeIdentity.mockResolvedValue({ customerId: "cus_1", paymentMethodId: "pm_1" });
});

describe("holdBookingBalance", () => {
  it("skips gracefully when the booking row is missing (pre-0018 schema)", async () => {
    const { admin } = fakeAdmin(null);
    expect(await holdBookingBalance(admin, "bk_1")).toEqual({ ok: true, status: "no_balance" });
    expect(paymentIntents.create).not.toHaveBeenCalled();
  });

  it("is idempotent: an already-held or captured balance never re-authorizes", async () => {
    for (const status of ["held", "captured"]) {
      const { admin } = fakeAdmin(booking({ balance_status: status }));
      expect(await holdBookingBalance(admin, "bk_1")).toEqual({ ok: true, status: "held" });
    }
    expect(paymentIntents.create).not.toHaveBeenCalled();
  });

  it("marks a fully-prepaid booking captured with zero balance and no Stripe call", async () => {
    const { admin, updates } = fakeAdmin(booking({ total_cents: 5000, amount_due_now_cents: 5000 }));
    expect(await holdBookingBalance(admin, "bk_1")).toEqual({ ok: true, status: "no_balance" });
    expect(updates).toEqual([{ table: "bookings", payload: { balance_cents: 0, balance_status: "captured" } }]);
    expect(paymentIntents.create).not.toHaveBeenCalled();
  });

  it("hard-fails when money is owed but no card can be resolved", async () => {
    resolveChargeIdentity.mockResolvedValue(null);
    const { admin } = fakeAdmin(booking());
    const out = await holdBookingBalance(admin, "bk_1");
    expect(out.ok).toBe(false);
    expect(paymentIntents.create).not.toHaveBeenCalled();
  });

  it("authorizes the exact remaining balance manually-captured with a per-booking idempotency key", async () => {
    paymentIntents.create.mockResolvedValue({ id: "pi_hold", status: "requires_capture" });
    const { admin, updates } = fakeAdmin(booking());
    expect(await holdBookingBalance(admin, "bk_1")).toEqual({ ok: true, status: "held" });

    const [params, opts] = paymentIntents.create.mock.calls[0];
    expect(params.amount).toBe(15000); // 20000 total - 5000 deposit
    expect(params.capture_method).toBe("manual");
    expect(params.off_session).toBe(true);
    expect(opts).toEqual({ idempotencyKey: "hold_bk_1" });
    expect(updates[0].payload).toMatchObject({ balance_hold_pi_id: "pi_hold", balance_cents: 15000, balance_status: "held" });
  });

  it("records a failed hold when the PI does not reach requires_capture", async () => {
    paymentIntents.create.mockResolvedValue({ id: "pi_hold", status: "requires_action" });
    const { admin, updates } = fakeAdmin(booking());
    const out = await holdBookingBalance(admin, "bk_1");
    expect(out.ok).toBe(false);
    expect(updates[0].payload).toMatchObject({ balance_status: "failed", balance_cents: 15000 });
  });

  it("records a failed hold and surfaces the message when the card declines", async () => {
    paymentIntents.create.mockRejectedValue(new Error("Your card was declined."));
    const { admin, updates } = fakeAdmin(booking());
    const out = await holdBookingBalance(admin, "bk_1");
    expect(out).toEqual({ ok: false, error: expect.stringContaining("Your card was declined.") });
    expect(updates[0].payload).toMatchObject({ balance_status: "failed" });
  });
});

describe("captureBookingBalance", () => {
  it("errors on a missing booking", async () => {
    const { admin } = fakeAdmin(null);
    expect(await captureBookingBalance(admin, "bk_1")).toEqual({ captured: 0, error: "Booking not found." });
  });

  it("is idempotent: an already-captured balance reports the amount without re-capturing", async () => {
    const { admin } = fakeAdmin(booking({ balance_status: "captured" }));
    expect(await captureBookingBalance(admin, "bk_1")).toEqual({ captured: 15000 });
    expect(paymentIntents.capture).not.toHaveBeenCalled();
  });

  it("captures nothing when no hold exists", async () => {
    const { admin } = fakeAdmin(booking({ balance_status: "pending" }));
    expect(await captureBookingBalance(admin, "bk_1")).toEqual({ captured: 0 });
    expect(paymentIntents.capture).not.toHaveBeenCalled();
  });

  it("captures the held PI, marks the booking captured, and records the payment", async () => {
    paymentIntents.capture.mockResolvedValue({ amount_received: 15000 });
    const { admin, updates, upserts } = fakeAdmin(booking({ balance_status: "held", balance_hold_pi_id: "pi_hold" }));
    expect(await captureBookingBalance(admin, "bk_1")).toEqual({ captured: 15000 });

    expect(paymentIntents.capture).toHaveBeenCalledWith("pi_hold", undefined, { idempotencyKey: "capture_bk_1" });
    expect(updates).toEqual([{ table: "bookings", payload: { balance_status: "captured" } }]);
    expect(upserts).toEqual([
      {
        table: "payments",
        payload: { booking_id: "bk_1", status: "succeeded", amount_cents: 15000, stripe_payment_intent_id: "pi_hold" },
        options: { onConflict: "stripe_payment_intent_id" },
      },
    ]);
  });

  it("leaves the hold intact and surfaces the error when capture fails", async () => {
    paymentIntents.capture.mockRejectedValue(new Error("expired authorization"));
    const { admin, updates } = fakeAdmin(booking({ balance_status: "held", balance_hold_pi_id: "pi_hold" }));
    expect(await captureBookingBalance(admin, "bk_1")).toEqual({ captured: 0, error: "expired authorization" });
    expect(updates).toEqual([]);
  });
});

describe("releaseBookingBalance", () => {
  it("does nothing without an active hold", async () => {
    const { admin, updates } = fakeAdmin(booking({ balance_status: "pending" }));
    await releaseBookingBalance(admin, "bk_1");
    expect(paymentIntents.cancel).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });

  it("cancels the held PI and marks the balance released", async () => {
    paymentIntents.cancel.mockResolvedValue({});
    const { admin, updates } = fakeAdmin(booking({ balance_status: "held", balance_hold_pi_id: "pi_hold" }));
    await releaseBookingBalance(admin, "bk_1");
    expect(paymentIntents.cancel).toHaveBeenCalledWith("pi_hold");
    expect(updates).toEqual([{ table: "bookings", payload: { balance_status: "released" } }]);
  });

  it("still marks released when the PI was already canceled/expired on Stripe", async () => {
    paymentIntents.cancel.mockRejectedValue(new Error("No such payment_intent"));
    const { admin, updates } = fakeAdmin(booking({ balance_status: "held", balance_hold_pi_id: "pi_hold" }));
    await releaseBookingBalance(admin, "bk_1");
    expect(updates).toEqual([{ table: "bookings", payload: { balance_status: "released" } }]);
  });
});
