import "server-only";
import { headers } from "next/headers";
import { rateLimit, type LIMITS } from "./rate-limit";

/** Best-effort client IP from proxy headers (Vercel/Cloudflare/standard). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

/**
 * Rate-limit a server action by client IP. Returns an error string when the
 * caller is over budget, otherwise null. Callers surface the message to the UI.
 */
export async function rateLimitGuard(name: keyof typeof LIMITS): Promise<string | null> {
  const ip = await clientIp();
  const res = rateLimit(name, ip, Date.now());
  if (!res.allowed) {
    const secs = Math.ceil(res.retryAfterMs / 1000);
    return `Too many attempts. Please try again in ${secs}s.`;
  }
  return null;
}
