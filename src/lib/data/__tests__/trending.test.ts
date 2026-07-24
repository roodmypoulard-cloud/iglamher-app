import { describe, it, expect } from "vitest";
import { rankByRecentActivity } from "@/lib/data/trending-rank";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.parse("2026-07-23T12:00:00Z");
const iso = (daysAgo: number) => new Date(now - daysAgo * DAY).toISOString();

describe("rankByRecentActivity", () => {
  it("ranks by count within the window, ignoring bookings outside it", () => {
    const rows = [
      { professional_id: "a", created_at: iso(1) },
      { professional_id: "a", created_at: iso(2) },
      { professional_id: "a", created_at: iso(30) }, // outside 7d — ignored
      { professional_id: "b", created_at: iso(1) },
    ];
    expect(rankByRecentActivity(rows, now, 7)).toEqual(["a", "b"]);
  });

  it("excludes a pro whose only activity is older than the window (expires)", () => {
    const rows = [
      { professional_id: "old", created_at: iso(10) },
      { professional_id: "fresh", created_at: iso(3) },
    ];
    expect(rankByRecentActivity(rows, now, 7)).toEqual(["fresh"]);
  });

  it("breaks ties by most-recent activity", () => {
    const rows = [
      { professional_id: "x", created_at: iso(6) },
      { professional_id: "y", created_at: iso(1) },
    ];
    // both count=1; y is more recent → first
    expect(rankByRecentActivity(rows, now, 7)).toEqual(["y", "x"]);
  });

  it("honors the limit", () => {
    const rows = ["a", "b", "c", "d"].map((id) => ({ professional_id: id, created_at: iso(1) }));
    expect(rankByRecentActivity(rows, now, 7, 2)).toHaveLength(2);
  });

  it("returns empty when nothing is in the window", () => {
    const rows = [{ professional_id: "a", created_at: iso(20) }];
    expect(rankByRecentActivity(rows, now, 7)).toEqual([]);
  });
});
