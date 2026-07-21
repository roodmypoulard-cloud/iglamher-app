import { describe, it, expect } from "vitest";
import { PROFESSIONALS, DEFAULT_VIEWER } from "@/lib/data/seed";
import { trendingNearYou, topRated, newProviders, availableToday, luxuryPicks, buildShelf } from "../shelves";

const v = DEFAULT_VIEWER;
const slugs = (r: { slug: string }[]) => r.map((x) => x.slug);

describe("recommendation shelves", () => {
  it("all shelves exclude inactive/suspended pros", () => {
    for (const shelf of [trendingNearYou, topRated, newProviders, availableToday, luxuryPicks]) {
      const s = slugs(shelf(PROFESSIONALS, v, 20));
      expect(s).not.toContain("kai-style-co");
      expect(s).not.toContain("gigi-glam");
    }
  });

  it("top rated is sorted by rating desc", () => {
    const r = topRated(PROFESSIONALS, v, 12);
    for (let i = 1; i < r.length; i++) expect(r[i].ratingAverage).toBeLessThanOrEqual(r[i - 1].ratingAverage);
  });

  it("new providers surfaces the least-experienced first", () => {
    const r = newProviders(PROFESSIONALS, v, 12);
    for (let i = 1; i < r.length; i++) expect(r[i].jobsCompleted).toBeGreaterThanOrEqual(r[i - 1].jobsCompleted);
    // Remy (22 jobs) should appear before Amara (720 jobs).
    expect(slugs(r).indexOf("remy-cuts")).toBeLessThan(slugs(r).indexOf("amara-beauty"));
  });

  it("available today prioritizes instant-book pros", () => {
    const r = availableToday(PROFESSIONALS, v, 12);
    expect(r.length).toBeGreaterThan(0);
    // First result must be instant-book if any exist.
    if (r.some((x) => x.instantBook)) expect(r[0].instantBook).toBe(true);
  });

  it("luxury picks are verified, well-rated, sorted by price desc", () => {
    const r = luxuryPicks(PROFESSIONALS, v, 12);
    for (const x of r) {
      expect(x.isVerified).toBe(true);
      expect(x.ratingAverage).toBeGreaterThanOrEqual(4.7);
    }
    for (let i = 1; i < r.length; i++) expect(r[i].startingPriceCents).toBeLessThanOrEqual(r[i - 1].startingPriceCents);
  });

  it("trending returns momentum-ranked results", () => {
    const r = trendingNearYou(PROFESSIONALS, v, 5);
    expect(r.length).toBe(5);
    for (let i = 1; i < r.length; i++) expect(r[i].score ?? 0).toBeLessThanOrEqual(r[i - 1].score ?? 0);
  });

  it("buildShelf dispatches by key", () => {
    expect(slugs(buildShelf("top_rated", PROFESSIONALS, v, 3))).toEqual(slugs(topRated(PROFESSIONALS, v, 3)));
  });
});
