import { z } from "zod";

// Validated environment. Public vars are safe for the browser bundle.
// Server-only secrets must NEVER be imported into client components.

const publicSchema = z.object({
  // Default to production so a missing var can NEVER emit localhost auth links.
  // Local dev overrides this via .env.local (NEXT_PUBLIC_APP_URL=http://localhost:3000).
  NEXT_PUBLIC_APP_URL: z.string().url().default("https://iglamher-app.vercel.app"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

/** Server-only. Throws if called where the service key is absent. */
export function serverEnv() {
  return serverSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}

// ---------------------------------------------------------------------------
// Launch-readiness validation. NOT run at import time (so placeholder/CI builds
// still work). Call assertLaunchReady() from a health check / deploy step. It
// fails fast with a clear list of everything missing for a given environment.
// ---------------------------------------------------------------------------

export type AppEnv = "local" | "test" | "staging" | "production";

export function appEnv(): AppEnv {
  const v = (process.env.APP_ENV ?? "").toLowerCase();
  if (v === "production" || v === "staging" || v === "test" || v === "local") return v;
  return process.env.NODE_ENV === "production" ? "production" : "local";
}

const isPlaceholder = (v?: string) => !v || v.includes("placeholder") || v === "";

/** Required for staging AND production (real transactions). */
const REQUIRED_LIVE: Array<{ key: string; why: string }> = [
  { key: "NEXT_PUBLIC_APP_URL", why: "canonical HTTPS app URL (redirects, webhooks, emails)" },
  { key: "NEXT_PUBLIC_SUPABASE_URL", why: "database / auth endpoint" },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", why: "client Supabase key" },
  { key: "SUPABASE_SERVICE_ROLE_KEY", why: "server admin key (server-only)" },
  { key: "STRIPE_SECRET_KEY", why: "payment processing" },
  { key: "STRIPE_WEBHOOK_SECRET", why: "webhook signature verification (source of truth)" },
  { key: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", why: "client checkout" },
];

/** Recommended but non-fatal; missing → reduced functionality, logged. */
const RECOMMENDED: Array<{ key: string; why: string }> = [
  { key: "REDIS_URL", why: "distributed rate limiting + shared cache (per-instance fallback otherwise)" },
  { key: "SENTRY_DSN", why: "error tracking" },
  { key: "RESEND_API_KEY", why: "transactional email" },
  { key: "TWILIO_ACCOUNT_SID", why: "phone verification (Twilio Verify) — AC…" },
  { key: "TWILIO_AUTH_TOKEN", why: "phone verification secret (Twilio Verify)" },
  { key: "TWILIO_VERIFY_SERVICE_SID", why: "phone verification Verify Service — VA…" },
];

export interface EnvReport {
  env: AppEnv;
  ok: boolean;
  missingRequired: Array<{ key: string; why: string }>;
  missingRecommended: Array<{ key: string; why: string }>;
  httpsAppUrl: boolean;
}

export function checkEnv(): EnvReport {
  const env = appEnv();
  const live = env === "production" || env === "staging";
  const missingRequired = live ? REQUIRED_LIVE.filter((r) => isPlaceholder(process.env[r.key])) : [];
  const missingRecommended = RECOMMENDED.filter((r) => isPlaceholder(process.env[r.key]));
  const httpsAppUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://");
  return {
    env,
    ok: missingRequired.length === 0 && (!live || httpsAppUrl),
    missingRequired,
    missingRecommended,
    httpsAppUrl,
  };
}

/** Throw with an actionable message if the environment isn't launch-ready. */
export function assertLaunchReady(): void {
  const r = checkEnv();
  if (r.ok) return;
  const lines: string[] = [`Environment "${r.env}" is not launch-ready:`];
  for (const m of r.missingRequired) lines.push(`  ✗ ${m.key} — ${m.why}`);
  if ((r.env === "production" || r.env === "staging") && !r.httpsAppUrl) {
    lines.push("  ✗ NEXT_PUBLIC_APP_URL must be https:// in staging/production");
  }
  throw new Error(lines.join("\n"));
}
