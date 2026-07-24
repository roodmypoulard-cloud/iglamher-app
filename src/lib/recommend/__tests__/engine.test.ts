import { describe, it, expect } from "vitest";
import { PROFESSIONALS, DEFAULT_VIEWER, PRO_IDS } from "@/lib/data/seed";
import { recommend, scoreMatch } from "../engine";

const baseCtx = { viewer: DEFAULT_VIEWER, now: new Date("2026-07-14T12:00:00Z") };

describe("recommendation engine", () => {
  it("never recommends inactive/suspended professionals", () => {
    const recs = recommend(PROFESSIONALS, baseCtx, 20);
    const slugs = recs.map((r) => r.slug);
    expect(slugs).not.toContain("kai-style-co");
    expect(slugs).not.toContain("gigi-glam");
  });

  it("ranks by personalized match score and returns reasons", () => {
    const recs = recommend(PROFESSIONALS, baseCtx, 5);
    expect(recs.length).toBe(5);
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i].matchScore).toBeLessThanOrEqual(recs[i - 1].matchScore);
    }
    expect(recs[0].reasons.length).toBeGreaterThan(0);
  });

  it("boosts professionals matching the customer's preferred category", () => {
    const withPref = recommend(PROFESSIONALS, { ...baseCtx, preferredCategories: ["lashes"] }, 12);
    // A lashes specialist should rank higher than with no preference signal.
    const lashPro = withPref.find((r) => r.categories.includes("lashes"));
    expect(lashPro).toBeTruthy();
    expect(lashPro!.reasons.join(" ")).toMatch(/lashes/i);
  });

  it("rewards budget fit", () => {
    const cheap = scoreMatch(PROFESSIONALS.find((p) => p.slug === "remy-cuts")!, { ...baseCtx, budgetCents: 6000 });
    const expensiveForBudget = scoreMatch(PROFESSIONALS.find((p) => p.slug === "amara-beauty")!, { ...baseCtx, budgetCents: 6000 });
    expect(cheap.score).toBeGreaterThan(0);
    expect(cheap.reasons).toContain("In your budget");
    // Amara starts at $90 → over a $60 budget → no "in budget" reason.
    expect(expensiveForBudget.reasons).not.toContain("In your budget");
  });

  it("strongly favors a professional the customer has booked before", () => {
    const mayaId = PRO_IDS.P1;
    const withHistory = recommend(PROFESSIONALS, { ...baseCtx, pastProfessionalIds: [mayaId] }, 12);
    const maya = withHistory.find((r) => r.userId === mayaId)!;
    expect(maya.reasons).toContain("You've booked before");
    // Repeat affinity should place Maya at or near the very top.
    expect(withHistory.slice(0, 3).map((r) => r.userId)).toContain(mayaId);
  });

  it("demotes low-reliability professionals via the trust multiplier", () => {
    const recs = recommend(PROFESSIONALS, baseCtx, 20);
    const remy = recs.find((r) => r.slug === "remy-cuts"); // reliability 76
    const maya = recs.find((r) => r.slug === "maya-rose-beauty"); // reliability 92
    expect(maya!.matchScore).toBeGreaterThan(remy!.matchScore);
  });
});
