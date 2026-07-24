import "server-only";
// Admin passcode gate — a second factor over the account role=admin check.
// The passcode is a scrypt hash in admin_gate (service-role only). A verified
// entry issues a short-lived signed cookie so the admin isn't re-prompted every
// page. The admin can change the passcode anytime from Settings — no redeploy.
import { cookies } from "next/headers";
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { isLiveSupabase } from "@/lib/data/source";

const COOKIE = "ig_admin_gate";
const TTL_SECONDS = 12 * 60 * 60; // 12h unlock window

// ---------- passcode hashing (scrypt, salted) ----------
function hashPasscode(passcode: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(passcode.normalize("NFKC"), salt, 32).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

function verifyPasscode(passcode: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const derived = scryptSync(passcode.normalize("NFKC"), salt, 32);
  const expected = Buffer.from(hash, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

// ---------- cookie signing (HMAC over the server key) ----------
function sign(userId: string, exp: number): string {
  return createHmac("sha256", serverEnv().SUPABASE_SERVICE_ROLE_KEY)
    .update(`${userId}.${exp}`)
    .digest("hex");
}

function cookieValid(value: string | undefined, userId: string): boolean {
  if (!value) return false;
  const [expStr, mac] = value.split(".");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = sign(userId, exp);
  const a = Buffer.from(mac ?? "", "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------- state ----------
async function readHash(): Promise<string | null> {
  if (!isLiveSupabase()) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("admin_gate").select("passcode_hash").eq("id", true).maybeSingle();
  return (data as { passcode_hash?: string } | null)?.passcode_hash ?? null;
}

/** Has an admin passcode been configured yet? */
export async function isGateConfigured(): Promise<boolean> {
  return (await readHash()) != null;
}

/** True when this admin has a valid unlock cookie for the current session. */
export async function isGateUnlocked(userId: string): Promise<boolean> {
  const jar = await cookies();
  return cookieValid(jar.get(COOKIE)?.value, userId);
}

/** Verify a passcode and, on success, set the unlock cookie. */
export async function unlockGate(userId: string, passcode: string): Promise<{ ok: boolean; error?: string }> {
  const stored = await readHash();
  if (!stored) return { ok: false, error: "No passcode is set yet." };
  if (!verifyPasscode(passcode, stored)) return { ok: false, error: "Incorrect passcode." };

  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const jar = await cookies();
  jar.set(COOKIE, `${exp}.${sign(userId, exp)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
  return { ok: true };
}

/** Set or change the passcode. When one already exists, the current passcode is
 *  required. Re-locks the session so the new code must be entered. */
export async function setGatePasscode(
  userId: string,
  next: string,
  current?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (next.length < 4) return { ok: false, error: "Use at least 4 characters." };
  const existing = await readHash();
  if (existing) {
    if (!current) return { ok: false, error: "Enter your current passcode." };
    if (!verifyPasscode(current, existing)) return { ok: false, error: "Current passcode is incorrect." };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("admin_gate")
    .upsert({ id: true, passcode_hash: hashPasscode(next), updated_by: userId, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) return { ok: false, error: "Couldn't save the passcode." };

  // Force re-entry with the new code.
  const jar = await cookies();
  jar.delete(COOKIE);
  return { ok: true };
}

/** Clear the unlock cookie (lock now). */
export async function lockGate(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
