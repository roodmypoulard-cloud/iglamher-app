import { describe, it, expect, afterEach } from "vitest";
import { checkEnv } from "@/lib/env";

const KEYS = [
  "APP_ENV", "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
];
const snapshot = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
afterEach(() => {
  for (const k of KEYS) {
    if (snapshot[k] === undefined) delete process.env[k];
    else process.env[k] = snapshot[k];
  }
});

function setProd() {
  process.env.APP_ENV = "production";
  process.env.NEXT_PUBLIC_APP_URL = "https://iglamher.com";
  for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"]) {
    process.env[k] = "set";
  }
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://real.supabase.co";
}

describe("env launch-readiness check", () => {
  it("local env is always ok (no live requirements)", () => {
    process.env.APP_ENV = "local";
    expect(checkEnv().ok).toBe(true);
  });

  it("production with all vars + https is ok", () => {
    setProd();
    const r = checkEnv();
    expect(r.env).toBe("production");
    expect(r.ok).toBe(true);
    expect(r.missingRequired).toHaveLength(0);
  });

  it("production fails fast when a required var is missing", () => {
    setProd();
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const r = checkEnv();
    expect(r.ok).toBe(false);
    expect(r.missingRequired.map((m) => m.key)).toContain("STRIPE_WEBHOOK_SECRET");
  });

  it("production fails when the app URL is not https", () => {
    setProd();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    expect(checkEnv().ok).toBe(false);
  });

  it("flags placeholder values as missing", () => {
    setProd();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://placeholder.supabase.co";
    const r = checkEnv();
    expect(r.missingRequired.map((m) => m.key)).toContain("NEXT_PUBLIC_SUPABASE_URL");
  });
});
