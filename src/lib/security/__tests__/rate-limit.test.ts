import { describe, it, expect } from "vitest";
import { RateLimiter } from "../rate-limit";

describe("RateLimiter (sliding window)", () => {
  it("allows up to the limit, then blocks", () => {
    const rl = new RateLimiter({ limit: 3, windowMs: 1000 });
    expect(rl.hit("ip", 0).allowed).toBe(true);
    expect(rl.hit("ip", 10).allowed).toBe(true);
    expect(rl.hit("ip", 20).allowed).toBe(true);
    const blocked = rl.hit("ip", 30);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("recovers after the window slides past old hits", () => {
    const rl = new RateLimiter({ limit: 2, windowMs: 1000 });
    rl.hit("ip", 0);
    rl.hit("ip", 100);
    expect(rl.hit("ip", 200).allowed).toBe(false);
    // At t=1101 the first two hits (t=0,100) have aged out.
    expect(rl.hit("ip", 1101).allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    const rl = new RateLimiter({ limit: 1, windowMs: 1000 });
    expect(rl.hit("a", 0).allowed).toBe(true);
    expect(rl.hit("b", 0).allowed).toBe(true);
    expect(rl.hit("a", 1).allowed).toBe(false);
  });

  it("reports remaining budget", () => {
    const rl = new RateLimiter({ limit: 5, windowMs: 1000 });
    expect(rl.hit("ip", 0).remaining).toBe(4);
    expect(rl.hit("ip", 1).remaining).toBe(3);
  });

  it("evicts idle keys so the store does not grow unbounded", () => {
    // Custom store to observe eviction (mirrors the internal MemoryStore).
    const map = new Map<string, number[]>();
    const store = {
      get: (k: string) => map.get(k),
      set: (k: string, t: number[]) => void map.set(k, t),
      delete: (k: string) => void map.delete(k),
      prune: (before: number) => {
        for (const [k, ts] of map) if (ts.length === 0 || ts[ts.length - 1] < before) map.delete(k);
      },
    };
    const rl = new RateLimiter({ limit: 100, windowMs: 1000 }, store);
    // 500 unique one-time IPs, then one hit that triggers the periodic prune far later.
    for (let i = 0; i < 499; i++) rl.hit(`ip-${i}`, 0);
    expect(map.size).toBe(499);
    rl.hit("ip-late", 100_000); // 500th hit → prune evicts the stale keys
    expect(map.size).toBe(1);
  });
});
