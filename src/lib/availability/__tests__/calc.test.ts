import { describe, it, expect } from "vitest";
import {
  zonedTimeToUtc,
  weekdayInZone,
  computeDaySlots,
  formatLocalTime,
  type AvailabilityConfig,
} from "../calc";
import type { AvailabilityRule } from "@/lib/data/model";

const LA = "America/Los_Angeles";
const rules: AvailabilityRule[] = [2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  startMinute: 9 * 60,
  endMinute: 18 * 60,
}));

const baseConfig: AvailabilityConfig = {
  timezone: LA,
  rules,
  exceptions: [],
  minNoticeMinutes: 0,
  maxWindowDays: 90,
};

describe("timezone conversion", () => {
  it("PST (winter) 09:00 local -> 17:00 UTC", () => {
    const utc = zonedTimeToUtc(2026, 1, 15, 9 * 60, LA);
    expect(utc.toISOString()).toBe("2026-01-15T17:00:00.000Z");
  });

  it("PDT (summer) 09:00 local -> 16:00 UTC", () => {
    const utc = zonedTimeToUtc(2026, 7, 15, 9 * 60, LA);
    expect(utc.toISOString()).toBe("2026-07-15T16:00:00.000Z");
  });

  it("round-trips back to the same local label", () => {
    const utc = zonedTimeToUtc(2026, 7, 15, 9 * 60, LA);
    expect(formatLocalTime(utc, LA)).toBe("09:00");
  });
});

describe("daylight-saving transitions (America/Los_Angeles)", () => {
  // Spring forward: 2026-03-08, clocks jump 02:00 -> 03:00 (PST->PDT).
  it("the morning AFTER spring-forward is PDT (09:00 -> 16:00 UTC)", () => {
    const utc = zonedTimeToUtc(2026, 3, 8, 9 * 60, LA);
    expect(utc.toISOString()).toBe("2026-03-08T16:00:00.000Z");
  });

  it("the morning BEFORE spring-forward is still PST (09:00 -> 17:00 UTC)", () => {
    const utc = zonedTimeToUtc(2026, 3, 7, 9 * 60, LA);
    expect(utc.toISOString()).toBe("2026-03-07T17:00:00.000Z");
  });

  // Fall back: 2026-11-01, clocks fall 02:00 -> 01:00 (PDT->PST).
  it("the morning of fall-back reads PST (09:00 -> 17:00 UTC)", () => {
    const utc = zonedTimeToUtc(2026, 11, 1, 9 * 60, LA);
    expect(utc.toISOString()).toBe("2026-11-01T17:00:00.000Z");
  });

  it("the day before fall-back is still PDT (09:00 -> 16:00 UTC)", () => {
    const utc = zonedTimeToUtc(2026, 10, 31, 9 * 60, LA);
    expect(utc.toISOString()).toBe("2026-10-31T16:00:00.000Z");
  });
});

describe("weekdayInZone", () => {
  it("computes local weekday correctly", () => {
    // 2026-07-14 is a Tuesday.
    expect(weekdayInZone(2026, 7, 14, LA)).toBe(2);
    // 2026-07-13 is a Monday.
    expect(weekdayInZone(2026, 7, 13, LA)).toBe(1);
  });
});

describe("computeDaySlots", () => {
  const req = {
    date: "2026-07-14", // Tuesday, has 9–18 hours
    serviceDurationMin: 60,
    bufferBeforeMin: 0,
    bufferAfterMin: 15,
    slotIntervalMin: 30,
    now: new Date("2026-07-01T00:00:00Z"),
  };

  it("produces slots that start at opening time in local tz", () => {
    const slots = computeDaySlots(baseConfig, req);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].startLocal).toBe("09:00");
  });

  it("keeps the service + buffer inside working hours", () => {
    const slots = computeDaySlots(baseConfig, req);
    // Last slot start must leave room for 60min service + 15min buffer before 18:00.
    for (const s of slots) {
      expect(s.startLocal <= "16:45").toBe(true);
    }
  });

  it("returns no slots on a non-working weekday (Sunday)", () => {
    const slots = computeDaySlots(baseConfig, { ...req, date: "2026-07-12" }); // Sunday
    expect(slots).toHaveLength(0);
  });

  it("excludes times blocked by an existing booking", () => {
    // Booking 12:00–13:00 local == 19:00–20:00 UTC.
    const slots = computeDaySlots(baseConfig, {
      ...req,
      existingBookings: [{ startsAt: "2026-07-14T19:00:00Z", endsAt: "2026-07-14T20:00:00Z" }],
    });
    expect(slots.map((s) => s.startLocal)).not.toContain("12:00");
  });

  it("excludes times blocked by a time-off exception", () => {
    const config: AvailabilityConfig = {
      ...baseConfig,
      exceptions: [{ startsAt: "2026-07-14T16:00:00Z", endsAt: "2026-07-14T18:00:00Z", isAvailable: false }],
    };
    const slots = computeDaySlots(config, req);
    // 16:00–18:00 UTC == 09:00–11:00 local blocked.
    expect(slots.map((s) => s.startLocal)).not.toContain("09:00");
    expect(slots.map((s) => s.startLocal)).not.toContain("10:00");
  });

  it("respects minimum booking notice", () => {
    const slots = computeDaySlots(
      { ...baseConfig, minNoticeMinutes: 120 }, // earliest bookable = now + 2h
      { ...req, now: new Date("2026-07-14T17:00:00Z") }, // 10:00 local same day -> 12:00 earliest
    );
    expect(slots.length).toBeGreaterThan(0);
    for (const s of slots) expect(s.startLocal >= "12:00").toBe(true);
  });

  it("respects the maximum booking window", () => {
    const slots = computeDaySlots(
      { ...baseConfig, maxWindowDays: 7 },
      { ...req, date: "2026-08-30" }, // way beyond 7 days from 2026-07-01
    );
    expect(slots).toHaveLength(0);
  });
});
