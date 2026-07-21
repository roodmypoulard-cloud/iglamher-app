// ============================================================
// Caching abstraction. In-memory TTL cache now; swap to Redis/Upstash later
// behind the same Cache interface (set REDIS_URL and provide a RedisCache).
// getOrSet() dedupes and memoizes expensive reads. Injectable clock → testable.
// ============================================================

export interface Cache {
  get<T>(key: string, now?: number): T | undefined;
  set<T>(key: string, value: T, ttlMs: number, now?: number): void;
  delete(key: string): void;
  clear(): void;
}

interface Entry {
  value: unknown;
  expiresAt: number;
}

export class MemoryCache implements Cache {
  private store = new Map<string, Entry>();
  constructor(private readonly maxEntries = 1000) {}

  get<T>(key: string, now = Date.now()): T | undefined {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (e.expiresAt <= now) {
      this.store.delete(key);
      return undefined;
    }
    // LRU touch: re-insert to move to the end.
    this.store.delete(key);
    this.store.set(key, e);
    return e.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number, now = Date.now()): void {
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: now + ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

export const appCache: Cache = new MemoryCache(2000);

const inflight = new Map<string, Promise<unknown>>();

/** Memoize an async read with TTL + single-flight (no thundering herd). */
export async function getOrSet<T>(cache: Cache, key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached !== undefined) return cached;
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const p = (async () => {
    try {
      const value = await loader();
      cache.set(key, value, ttlMs);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}
