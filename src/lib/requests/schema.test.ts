import { describe, expect, it } from "vitest";
import { categoryLabel, createJobRequestSchema, timeAgo } from "./schema";

const base = {
  category: "makeup" as const,
  title: "Soft glam for a wedding",
  description: "Looking for soft glam makeup, medium skin tone, 10am ready time.",
  preferredDate: "2030-05-01",
  timeWindow: "morning" as const,
  locationText: "West Hollywood",
  isHouseCall: false,
  budgetDollars: 150,
  photos: [],
};

describe("createJobRequestSchema", () => {
  it("accepts a complete valid request", () => {
    const r = createJobRequestSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it("accepts nullable optionals", () => {
    const r = createJobRequestSchema.safeParse({ ...base, preferredDate: null, timeWindow: null, budgetDollars: null });
    expect(r.success).toBe(true);
  });

  it("rejects a too-short description", () => {
    expect(createJobRequestSchema.safeParse({ ...base, description: "short" }).success).toBe(false);
  });

  it("rejects an unknown category", () => {
    expect(createJobRequestSchema.safeParse({ ...base, category: "tattoo" }).success).toBe(false);
  });

  it("rejects fractional and out-of-range budgets (whole dollars, $1–$10,000)", () => {
    expect(createJobRequestSchema.safeParse({ ...base, budgetDollars: 99.5 }).success).toBe(false);
    expect(createJobRequestSchema.safeParse({ ...base, budgetDollars: 0 }).success).toBe(false);
    expect(createJobRequestSchema.safeParse({ ...base, budgetDollars: 10001 }).success).toBe(false);
  });

  it("rejects a malformed date and more than 4 photos", () => {
    expect(createJobRequestSchema.safeParse({ ...base, preferredDate: "5/1/2030" }).success).toBe(false);
    const photo = { path: "job-requests/u/p.jpg", url: "https://x.co/p.jpg" };
    expect(createJobRequestSchema.safeParse({ ...base, photos: [photo, photo, photo, photo, photo] }).success).toBe(false);
  });
});

describe("timeAgo", () => {
  const now = Date.parse("2026-07-23T12:00:00Z");
  it("buckets minutes, hours, days and weeks", () => {
    expect(timeAgo("2026-07-23T11:59:40Z", now)).toBe("Just now");
    expect(timeAgo("2026-07-23T11:15:00Z", now)).toBe("45m ago");
    expect(timeAgo("2026-07-23T05:00:00Z", now)).toBe("7h ago");
    expect(timeAgo("2026-07-20T12:00:00Z", now)).toBe("3d ago");
    expect(timeAgo("2026-07-02T12:00:00Z", now)).toBe("3w ago");
  });
});

describe("categoryLabel", () => {
  it("maps keys and falls back to Custom", () => {
    expect(categoryLabel("house_call")).toBe("House Call");
    expect(categoryLabel("nope")).toBe("Custom");
  });
});
