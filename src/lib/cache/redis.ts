import "server-only";
// Redis-backed cache + distributed rate limiter (Upstash REST — serverless-safe).
// Active only when UPSTASH_REDIS_REST_URL + _TOKEN are set. If Redis is configured
// but unreachable, we FALL BACK to per-instance memory and LOG the degradation —
// we never silently pretend Redis is active.
import { Redis } from "@upstash/redis";
import { log } from "@/lib/observability/logger";
import type { Cache } from "./index";
import { MemoryCache } from "./index";
import type { RateLimitResult, RateLimitOptions } from "@/lib/security/rate-limit";

export function isRedisConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

let client: Redis | null = null;
function redis(): Redis {
  if (!client) {
    client = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return client;
}

const NS = "iglamher";

/** Distributed cache. Reads/writes Redis; on any Redis error, degrades to memory. */
export class RedisCache implements Cache {
  private fallback = new MemoryCache(500);
  private degraded = false;

  get<T>(): T | undefined {
    // Sync interface can't await Redis; use getAsync for the shared cache.
    return undefined;
  }
  set(): void {
    /* use setAsync */
  }
  delete(key: string): void {
    void redis().del(`${NS}:${key}`).catch(() => this.markDegraded("delete"));
  }
  clear(): void {
    this.fallback.clear();
  }

  async getAsync<T>(key: string): Promise<T | undefined> {
    try {
      const v = await redis().get<T>(`${NS}:${key}`);
      return v ?? undefined;
    } catch {
      this.markDegraded("get");
      return this.fallback.get<T>(key);
    }
  }
  async setAsync<T>(key: string, value: T, ttlMs: number): Promise<void> {
    try {
      await redis().set(`${NS}:${key}`, value, { px: ttlMs });
    } catch {
      this.markDegraded("set");
      this.fallback.set(key, value, ttlMs);
    }
  }

  private markDegraded(op: string) {
    if (!this.degraded) {
      this.degraded = true;
      log.error("cache.redis.degraded", { op, note: "falling back to per-instance memory — REDUCED protection" });
    }
  }
}

/**
 * Distributed sliding-window rate limit via a Redis sorted set. On Redis failure
 * it fails OPEN (allows the request) but logs — availability over strictness for
 * a transient outage. Returns the same shape as the in-memory limiter.
 */
export async function redisRateLimit(name: string, key: string, opts: RateLimitOptions, now: number): Promise<RateLimitResult> {
  const redisKey = `${NS}:rl:${name}:${key}`;
  const windowStart = now - opts.windowMs;
  try {
    const r = redis();
    await r.zremrangebyscore(redisKey, 0, windowStart);
    const count = await r.zcard(redisKey);
    if (count >= opts.limit) {
      const oldest = (await r.zrange<string[]>(redisKey, 0, 0, { withScores: true }))[1];
      const retryAfterMs = oldest ? Math.max(0, Number(oldest) + opts.windowMs - now) : opts.windowMs;
      return { allowed: false, remaining: 0, retryAfterMs };
    }
    await r.zadd(redisKey, { score: now, member: `${now}-${Math.random()}` });
    await r.pexpire(redisKey, opts.windowMs);
    return { allowed: true, remaining: opts.limit - count - 1, retryAfterMs: 0 };
  } catch {
    log.error("rateLimit.redis.degraded", { name, note: "failing open — REDUCED protection" });
    return { allowed: true, remaining: opts.limit, retryAfterMs: 0 };
  }
}
