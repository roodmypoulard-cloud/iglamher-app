import { describe, it, expect } from "vitest";
import { parseNaturalQuery } from "../parse";

describe("natural-language query parser", () => {
  it("extracts category from intent words", () => {
    expect(parseNaturalQuery("bridal makeup artist").category).toBe("makeup");
    expect(parseNaturalQuery("someone for textured hair").category).toBe("hair");
    expect(parseNaturalQuery("volume lashes please").category).toBe("lashes");
    expect(parseNaturalQuery("wardrobe stylist for a shoot").category).toBe("stylist");
  });

  it("extracts a price ceiling", () => {
    expect(parseNaturalQuery("natural glam under $150").maxPriceCents).toBe(15000);
    expect(parseNaturalQuery("makeup below 90").maxPriceCents).toBe(9000);
    expect(parseNaturalQuery("hair stylist").maxPriceCents).toBeUndefined();
  });

  it("extracts timing", () => {
    expect(parseNaturalQuery("bridal makeup tomorrow morning").when).toBe("tomorrow");
    expect(parseNaturalQuery("lashes today").when).toBe("today");
    expect(parseNaturalQuery("hair this weekend").when).toBe("weekend");
  });

  it("handles a full natural-language query", () => {
    const p = parseNaturalQuery("I need a natural glam makeup artist under $150 tomorrow");
    expect(p.category).toBe("makeup");
    expect(p.maxPriceCents).toBe(15000);
    expect(p.when).toBe("tomorrow");
  });
});
