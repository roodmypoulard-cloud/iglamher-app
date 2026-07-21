// Sliding-window rate limiter. Pure + injectable clock → unit-tested.
//
// The default store is in-memory (per serverless instance). For multi-instance
// production, swap in a shared store (Upstash Redis / Supabase) via the Store
// interface — the algorithm is unchanged.

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

interface Store {
  get(key: string): number[] | undefined;
  set(key: string, timestamps: number[]): void;
  delete(key: string): void;
  prune(before: number): void;
}

class MemoryStore implements Store {
  private map = new Map<string, number[]>();
  get(key: string) {
    return this.map.get(key);
  }
  set(key: string, timestamps: number[]) {
    this.map.set(key, timestamps);
  }
  delete(key: string) {
    this.map.delete(key);
  }
  /** Drop keys whose newest hit is older than `before` (prevents unbounded growth). */
  prune(before: number) {
    for (const [key, ts] of this.map) {
      if (ts.length === 0 || ts[ts.length - 1] < before) this.map.delete(key);
    }
  }
}

export class RateLimiter {
  private hits = 0;
  constructor(
    private readonly options: RateLimitOptions,
    private readonly store: Store = new MemoryStore(),
  ) {}

  /** Record a hit for `key` at `now` (ms) and report whether it's allowed. */
  hit(key: string, now: number): RateLimitResult {
    // Periodically evict idle keys so the store never grows without bound.
    if (++this.hits % 500 === 0) this.store.prune(now - this.options.windowMs);

    const windowStart = now - this.options.windowMs;
    const recent = (this.store.get(key) ?? []).filter((t) => t > windowStart);

    if (recent.length >= this.options.limit) {
      const oldest = recent[0];
      this.store.set(key, recent);
      return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, oldest + this.options.windowMs - now) };
    }

    recent.push(now);
    this.store.set(key, recent);
    return { allowed: true, remaining: this.options.limit - recent.length, retryAfterMs: 0 };
  }
}

// Named limiters for the surfaces the spec calls out (auth, search, messages, promos).
export const LIMITS = {
  auth: { limit: 5, windowMs: 60_000 }, // 5 attempts / min
  search: { limit: 60, windowMs: 60_000 },
  message: { limit: 30, windowMs: 60_000 },
  booking: { limit: 10, windowMs: 60_000 },
} as const;

const registry = new Map<string, RateLimiter>();

/** Convenience wrapper using a shared registry of named limiters. */
export function rateLimit(name: keyof typeof LIMITS, key: string, now: number): RateLimitResult {
  let limiter = registry.get(name);
  if (!limiter) {
    limiter = new RateLimiter(LIMITS[name]);
    registry.set(name, limiter);
  }
  return limiter.hit(`${name}:${key}`, now);
}
