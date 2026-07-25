import "server-only";
import { headers } from "next/headers";
import { rateLimit, LIMITS } from "./rate-limit";
import { isRedisConfigured, redisRateLimit } from "@/lib/cache/redis";

/** Best-effort client IP from proxy headers (Vercel/Cloudflare/standard). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

/**
 * Rate-limit a server action by client IP (plus an optional caller-supplied key,
 * e.g. the user id, so authenticated abuse can't rotate IPs). Returns an error
 * string when the caller is over budget, otherwise null.
 *
 * Backing store ladder (documented degradation, never silent):
 * 1. Upstash Redis when UPSTASH_REDIS_REST_URL/_TOKEN are set — distributed,
 *    correct across serverless instances.
 * 2. Redis configured but erroring → redisRateLimit fails OPEN and logs
 *    `rateLimit.redis.degraded` (availability over strictness in an outage).
 * 3. Redis not configured → per-instance in-memory sliding window (protection
 *    is per serverless instance only).
 */
export async function rateLimitGuard(name: keyof typeof LIMITS, extraKey?: string): Promise<string | null> {
  const ip = await clientIp();
  const key = extraKey ? `${ip}:${extraKey}` : ip;
  const res = isRedisConfigured()
    ? await redisRateLimit(name, key, LIMITS[name], Date.now())
    : rateLimit(name, key, Date.now());
  if (!res.allowed) {
    const secs = Math.ceil(res.retryAfterMs / 1000);
    return `Too many attempts. Please try again in ${secs}s.`;
  }
  return null;
}
