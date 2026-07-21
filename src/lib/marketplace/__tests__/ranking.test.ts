import { describe, it, expect } from "vitest";
import { PROFESSIONALS, DEFAULT_VIEWER } from "@/lib/data/seed";
import { searchProfessionals, textRelevance } from "../ranking";

const ctx = { viewer: DEFAULT_VIEWER, now: new Date("2026-07-14T12:00:00Z") };
const slugs = (r: { slug: string }[]) => r.map((x) => x.slug);

describe("public visibility in search", () => {
  it("never returns inactive or suspended professionals", () => {
    const all = searchProfessionals(PROFESSIONALS, {}, ctx);
    expect(slugs(all)).not.toContain("kai-style-co"); // inactive (onboarding incomplete)
    expect(slugs(all)).not.toContain("gigi-glam"); // suspended / unapproved
  });

  it("returns exactly the 10 active professionals with no filters", () => {
    const all = searchProfessionals(PROFESSIONALS, {}, ctx);
    expect(all).toHaveLength(10);
  });
});

describe("search by text", () => {
  it("matches by display/business name", () => {
    const r = searchProfessionals(PROFESSIONALS, { q: "maya" }, ctx);
    expect(slugs(r)).toContain("maya-rose-beauty");
    expect(r[0].slug).toBe("maya-rose-beauty");
  });

  it("matches by service name (silk press -> Nina)", () => {
    const r = searchProfessionals(PROFESSIONALS, { q: "silk press" }, ctx);
    expect(slugs(r)).toContain("nina-k-hair");
  });

  it("matches by city", () => {
    const r = searchProfessionals(PROFESSIONALS, { q: "pasadena" }, ctx);
    expect(slugs(r)).toContain("bella-lash-lab");
  });

  it("matches by ZIP code", () => {
    const r = searchProfessionals(PROFESSIONALS, { q: "91101" }, ctx);
    expect(slugs(r)).toContain("bella-lash-lab");
  });

  it("matches by specialty", () => {
    const r = searchProfessionals(PROFESSIONALS, { q: "bridal" }, ctx);
    expect(slugs(r)).toEqual(expect.arrayContaining(["maya-rose-beauty", "amara-beauty"]));
  });

  it("returns nothing for a nonsense query", () => {
    expect(searchProfessionals(PROFESSIONALS, { q: "zzzznotathing" }, ctx)).toHaveLength(0);
  });

  it("textRelevance is 0 when nothing matches", () => {
    const maya = PROFESSIONALS.find((p) => p.slug === "maya-rose-beauty")!;
    expect(textRelevance(maya, "plumbing")).toBe(0);
    expect(textRelevance(maya, "maya")).toBeGreaterThan(0);
  });
});

describe("filters", () => {
  it("category filter returns only pros offering that category", () => {
    const r = searchProfessionals(PROFESSIONALS, { category: "lashes" }, ctx);
    expect(r.length).toBeGreaterThan(0);
    for (const v of r) expect(v.categories).toContain("lashes");
  });

  it("verified filter excludes unverified pros", () => {
    const r = searchProfessionals(PROFESSIONALS, { verifiedOnly: true }, ctx);
    expect(slugs(r)).not.toContain("remy-cuts"); // unverified
    for (const v of r) expect(v.isVerified).toBe(true);
  });

  it("rating filter drops lower-rated pros", () => {
    const r = searchProfessionals(PROFESSIONALS, { minRating: 4.9 }, ctx);
    for (const v of r) expect(v.ratingAverage).toBeGreaterThanOrEqual(4.9);
  });

  it("price filter respects max starting price", () => {
    const r = searchProfessionals(PROFESSIONALS, { maxPriceCents: 5000 }, ctx);
    for (const v of r) expect(v.startingPriceCents).toBeLessThanOrEqual(5000);
    expect(slugs(r)).toContain("remy-cuts"); // $45 skin fade
  });

  it("location filter narrows to studio-only pros", () => {
    const r = searchProfessionals(PROFESSIONALS, { location: "in_salon" }, ctx);
    for (const v of r) expect(v.locationType).toBe("in_salon");
    expect(slugs(r)).toEqual(expect.arrayContaining(["bella-lash-lab", "crown-by-tori"]));
  });

  it("instant-book filter", () => {
    const r = searchProfessionals(PROFESSIONALS, { instantOnly: true }, ctx);
    for (const v of r) expect(v.instantBook).toBe(true);
  });
});

describe("sorting", () => {
  it("nearest sorts ascending by distance", () => {
    const r = searchProfessionals(PROFESSIONALS, { sort: "nearest" }, ctx);
    for (let i = 1; i < r.length; i++) {
      expect(r[i].distanceMi!).toBeGreaterThanOrEqual(r[i - 1].distanceMi!);
    }
  });

  it("price_asc sorts ascending by starting price", () => {
    const r = searchProfessionals(PROFESSIONALS, { sort: "price_asc" }, ctx);
    for (let i = 1; i < r.length; i++) {
      expect(r[i].startingPriceCents).toBeGreaterThanOrEqual(r[i - 1].startingPriceCents);
    }
  });

  it("rating sorts descending by rating", () => {
    const r = searchProfessionals(PROFESSIONALS, { sort: "rating" }, ctx);
    for (let i = 1; i < r.length; i++) {
      expect(r[i].ratingAverage).toBeLessThanOrEqual(r[i - 1].ratingAverage);
    }
  });
});
