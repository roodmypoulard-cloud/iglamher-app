import { describe, it, expect } from "vitest";
import { isEnabled, allFlags, rolloutBucket } from "@/lib/flags";
import { MemoryCache, getOrSet } from "@/lib/cache";
import { suggest, editDistance, type SuggestCorpusItem } from "@/lib/search/suggest";

describe("feature flags", () => {
  it("returns defaults", () => {
    expect(isEnabled("ai_recommendations")).toBe(true);
    expect(isEnabled("voice_calling")).toBe(false);
  });
  it("rollout bucket is deterministic per user", () => {
    expect(rolloutBucket("live_presence", "user-1")).toBe(rolloutBucket("live_presence", "user-1"));
    expect(rolloutBucket("live_presence", "user-1")).not.toBe(rolloutBucket("live_presence", "user-2"));
  });
  it("allFlags returns every flag", () => {
    const f = allFlags();
    expect(Object.keys(f)).toContain("loyalty");
    expect(typeof f.referrals).toBe("boolean");
  });
});

describe("MemoryCache", () => {
  it("stores and expires by TTL", () => {
    const c = new MemoryCache();
    c.set("k", 42, 1000, 0);
    expect(c.get("k", 500)).toBe(42);
    expect(c.get("k", 1001)).toBeUndefined(); // expired
  });
  it("evicts the oldest entry past capacity", () => {
    const c = new MemoryCache(2);
    c.set("a", 1, 10000, 0);
    c.set("b", 2, 10000, 0);
    c.set("c", 3, 10000, 0); // evicts "a"
    expect(c.get("a", 1)).toBeUndefined();
    expect(c.get("c", 1)).toBe(3);
  });
  it("getOrSet memoizes and single-flights", async () => {
    const c = new MemoryCache();
    let calls = 0;
    const load = async () => { calls++; return "value"; };
    const [a, b] = await Promise.all([getOrSet(c, "key", 1000, load), getOrSet(c, "key", 1000, load)]);
    expect(a).toBe("value");
    expect(b).toBe("value");
    expect(calls).toBe(1); // single-flight collapsed both calls
  });
});

describe("search suggest", () => {
  const corpus: SuggestCorpusItem[] = [
    { slug: "maya-rose-beauty", displayName: "Maya R.", city: "Downtown LA", specialties: ["Bridal"], serviceNames: ["Soft Glam", "Bridal Makeup"], categories: ["makeup"] },
    { slug: "nina-k-hair", displayName: "Nina K.", city: "Culver City", specialties: ["Silk press"], serviceNames: ["Silk Press", "Blowout"], categories: ["hair"] },
  ];

  it("completes prefixes across names/services/categories", () => {
    const s = suggest("sil", corpus).map((x) => x.label.toLowerCase());
    expect(s.some((l) => l.includes("silk"))).toBe(true);
  });
  it("matches professional names", () => {
    const s = suggest("maya", corpus);
    expect(s.find((x) => x.kind === "professional")?.slug).toBe("maya-rose-beauty");
  });
  it("is typo-tolerant", () => {
    // "blowuot" -> "blowout"
    expect(editDistance("blowuot", "blowout")).toBeLessThanOrEqual(2);
    const s = suggest("blowuot", corpus).map((x) => x.label.toLowerCase());
    expect(s.some((l) => l.includes("blowout"))).toBe(true);
  });
  it("returns nothing for empty query", () => {
    expect(suggest("", corpus)).toHaveLength(0);
  });
});
