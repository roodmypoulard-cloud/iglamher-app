"use server";
// Phone verification via Supabase Phone Auth (Twilio Verify configured in Supabase).
// Flow: start → Supabase SMSes a 6-digit OTP (auth.updateUser({ phone })), then
// verify → auth.verifyOtp({ type: 'phone_change' }). Only on a confirmed OTP do we
// persist the E.164 number to profiles + set phone_verified. All actions run with the
// user's own session (anon key + cookies); no service-role or Twilio secret is touched.
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";

export type PhoneState =
  | { error?: string; success?: string; phone?: string; sent?: boolean; verified?: boolean }
  | undefined;

/** Normalize user input to E.164 (+15551234567). Returns null if it can't.
 *  Not exported — a "use server" module may only export async server actions. */
function toE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed; // already E.164
  const hadPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (hadPlus) return /^\+[1-9]\d{7,14}$/.test(`+${digits}`) ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;                       // US/CA 10-digit
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/** Map Supabase auth errors to clear, user-facing copy. */
function friendly(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("rate") || m.includes("limit") || m.includes("too many") || m.includes("60 seconds") || m.includes("after"))
    return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("expired")) return "That code has expired. Send a new one.";
  if (m.includes("invalid") && (m.includes("otp") || m.includes("token") || m.includes("code")))
    return "That code is incorrect. Check it and try again, or resend.";
  if (m.includes("invalid") && m.includes("phone")) return "That phone number looks invalid. Include the country code.";
  if (m.includes("phone")) return "We couldn't send a code to that number. Double-check it and try again.";
  return msg;
}

async function requireUser() {
  if (!isLiveSupabase()) return { error: "Connect Supabase to verify your phone." as const };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Please sign in." as const };
  return { supabase, user: data.user };
}

/** Step 1 — send (or resend) the 6-digit OTP to the given number. */
export async function startPhoneVerificationAction(_p: PhoneState, formData: FormData): Promise<PhoneState> {
  const gate = await requireUser();
  if ("error" in gate) return { error: gate.error };
  const raw = z.string().min(1).max(30).safeParse(formData.get("phone"));
  if (!raw.success) return { error: "Enter your phone number." };
  const phone = toE164(raw.data);
  if (!phone) return { error: "Enter a valid phone number with country code, e.g. +1 555 123 4567." };
  const { error } = await gate.supabase.auth.updateUser({ phone });
  if (error) return { error: friendly(error.message), phone };
  return { success: `We sent a 6-digit code to ${phone}.`, phone, sent: true };
}

/** Alias for the resend button — identical behaviour, distinct name for clarity. */
export async function resendPhoneOtpAction(_p: PhoneState, formData: FormData): Promise<PhoneState> {
  return startPhoneVerificationAction(_p, formData);
}

/** Step 2 — confirm the OTP, then persist the verified E.164 number. */
export async function verifyPhoneOtpAction(_p: PhoneState, formData: FormData): Promise<PhoneState> {
  const gate = await requireUser();
  if ("error" in gate) return { error: gate.error };
  const phone = toE164(z.string().parse(formData.get("phone") ?? ""));
  const token = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code").safeParse(formData.get("token"));
  if (!phone) return { error: "Something went wrong — please re-enter your number." };
  if (!token.success) return { error: "Enter the 6-digit code from the text message.", phone, sent: true };
  const { error } = await gate.supabase.auth.verifyOtp({ phone, token: token.data, type: "phone_change" });
  if (error) return { error: friendly(error.message), phone, sent: true };
  // OTP confirmed by Supabase → auth.users.phone is set. Mirror to profiles as the
  // verified number. phone_verified columns come from migration 0019; degrade gracefully.
  const { error: upErr } = await gate.supabase
    .from("profiles")
    .update({ phone, phone_verified: true, phone_verified_at: new Date().toISOString() })
    .eq("id", gate.user.id);
  if (upErr) {
    // Column may be missing (0019 not applied). Still store the number so it's not lost.
    await gate.supabase.from("profiles").update({ phone }).eq("id", gate.user.id);
  }
  revalidatePath("/profile/settings");
  return { success: "Phone number verified.", phone, verified: true };
}
