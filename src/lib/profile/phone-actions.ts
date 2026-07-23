"use server";
// Phone verification via DIRECT Twilio Verify (see ./twilio-verify).
// Flow: start → Twilio SMSes a 6-digit code → verify → Twilio confirms the code.
// Only on Twilio's "approved" do we persist the E.164 number + set phone_verified.
// Rate-limited by phone number, account, AND IP. No Twilio secret ever reaches the client.
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";
import { sendVerification, checkVerification, twilioConfigured } from "./twilio-verify";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/security/guard";

export type PhoneState =
  | { error?: string; success?: string; phone?: string; sent?: boolean; verified?: boolean }
  | undefined;

/** Normalize user input to E.164 (+15551234567). Returns null if it can't.
 *  Not exported — a "use server" module may only export async server actions.
 *  `defaultDial` (e.g. "1", "44") is applied to a bare national number. */
function toE164(raw: string, defaultDial = "1"): string | null {
  const trimmed = raw.trim();
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed; // already E.164
  const hadPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (hadPlus) return /^\+[1-9]\d{7,14}$/.test(`+${digits}`) ? `+${digits}` : null;
  // US/CA convenience: 10-digit national, or 11-digit starting with 1.
  if (defaultDial === "1") {
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  }
  const candidate = `+${defaultDial}${digits}`;
  return /^\+[1-9]\d{7,14}$/.test(candidate) ? candidate : null;
}

/** Map a coarse Twilio reason → clear, safe, user-facing copy. */
function sendCopy(reason: string): string {
  switch (reason) {
    case "not_configured":
      return "Phone verification is temporarily unavailable. Please try again later.";
    case "invalid_number":
      return "That number can't receive SMS. Check it and try a mobile number.";
    case "max_attempts":
    case "rate_limited":
      return "Too many attempts for this number. Please wait a few minutes and try again.";
    case "undeliverable":
      return "We couldn't deliver a code to that number. Try a different mobile number.";
    default:
      return "We couldn't send a code right now. Please try again in a moment.";
  }
}

async function requireUser() {
  if (!isLiveSupabase()) return { error: "Connect Supabase to verify your phone." as const };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Please sign in." as const };
  return { supabase, user: data.user };
}

/** Enforce the phone / account / IP limits together. Returns an error string or null. */
function guardSend(phone: string, userId: string, ip: string): string | null {
  const now = Date.now();
  for (const key of [`phone:${phone}`, `user:${userId}`, `ip:${ip}`]) {
    const r = rateLimit("phoneSend", key, now);
    if (!r.allowed) {
      const secs = Math.ceil(r.retryAfterMs / 1000);
      return `Too many code requests. Please wait ${secs > 60 ? `${Math.ceil(secs / 60)} min` : `${secs}s`} and try again.`;
    }
  }
  return null;
}

/** Step 1 — send (or resend) the 6-digit code to the given number. */
export async function startPhoneVerificationAction(_p: PhoneState, formData: FormData): Promise<PhoneState> {
  const gate = await requireUser();
  if ("error" in gate) return { error: gate.error };

  const raw = z.string().min(1).max(30).safeParse(formData.get("phone"));
  if (!raw.success) return { error: "Enter your phone number." };
  const dial = z.string().max(4).safeParse(formData.get("dial"));
  const phone = toE164(raw.data, dial.success ? dial.data.replace(/\D/g, "") || "1" : "1");
  if (!phone) return { error: "Enter a valid phone number, e.g. (646) 724-4046." };

  const ip = await clientIp();
  const limited = guardSend(phone, gate.user.id, ip);
  if (limited) return { error: limited, phone };

  const result = await sendVerification(phone);
  if (!result.ok) return { error: sendCopy(result.reason), phone };
  return { success: `We texted a 6-digit code to ${phone}.`, phone, sent: true };
}

/** Alias for the resend button — identical behaviour, distinct name for clarity. */
export async function resendPhoneOtpAction(_p: PhoneState, formData: FormData): Promise<PhoneState> {
  return startPhoneVerificationAction(_p, formData);
}

/** Step 2 — confirm the code with Twilio, then persist the verified E.164 number. */
export async function verifyPhoneOtpAction(_p: PhoneState, formData: FormData): Promise<PhoneState> {
  const gate = await requireUser();
  if ("error" in gate) return { error: gate.error };

  const dial = z.string().max(4).safeParse(formData.get("dial"));
  const phone = toE164(z.string().parse(formData.get("phone") ?? ""), dial.success ? dial.data.replace(/\D/g, "") || "1" : "1");
  const token = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code").safeParse(formData.get("token"));
  if (!phone) return { error: "Something went wrong — please re-enter your number." };
  if (!token.success) return { error: "Enter the 6-digit code from the text message.", phone, sent: true };

  // Brute-force guard on the check endpoint (per account + IP).
  const ip = await clientIp();
  const now = Date.now();
  for (const key of [`user:${gate.user.id}`, `ip:${ip}`]) {
    if (!rateLimit("phoneCheck", key, now).allowed)
      return { error: "Too many attempts. Please wait a few minutes and try again.", phone, sent: true };
  }

  const check = await checkVerification(phone, token.data);
  if (!check.approved) {
    const msg =
      check.reason === "expired"
        ? "That code has expired. Send a new one."
        : check.reason === "not_configured"
          ? "Phone verification is temporarily unavailable. Please try again later."
          : "That code is incorrect. Check it and try again, or resend.";
    return { error: msg, phone, sent: true };
  }

  // Twilio approved → persist. phone_verified columns come from migration 0019; degrade gracefully.
  const { error: upErr } = await gate.supabase
    .from("profiles")
    .update({ phone, phone_verified: true, phone_verified_at: new Date().toISOString() })
    .eq("id", gate.user.id);
  if (upErr) {
    await gate.supabase.from("profiles").update({ phone }).eq("id", gate.user.id);
  }
  revalidatePath("/profile/settings");
  return { success: "Phone number verified.", phone, verified: true };
}

/** Lightweight status probe for diagnostics — never exposes secrets, only booleans. */
export async function phoneVerifyStatusAction(): Promise<{ configured: boolean }> {
  return { configured: twilioConfigured() };
}
