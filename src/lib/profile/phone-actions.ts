"use server";
// Phone-number verification via Supabase Auth OTP (SMS). Runs entirely through the
// user's own session (anon key + cookies) — never the service role. Requires an
// SMS provider + Phone auth enabled in the Supabase dashboard for delivery.
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";

export type PhoneState = { error?: string; success?: string; verified?: boolean } | undefined;

// E.164: '+' then 7–15 digits, first digit non-zero.
const e164 = z.string().regex(/^\+[1-9]\d{6,14}$/);

/** Send a 6-digit code to the given E.164 number (phone-change OTP). */
export async function sendPhoneOtpAction(phone: string): Promise<PhoneState> {
  if (!isLiveSupabase()) return { error: "Phone verification isn't available in preview mode." };
  if (!e164.safeParse(phone).success) return { error: "Enter a valid phone number, including the country code." };

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please sign in." };

  const { error } = await supabase.auth.updateUser({ phone });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("sms") || m.includes("provider") || m.includes("deliver") || m.includes("send") || m.includes("twilio")) {
      return { error: "We couldn't send the code — SMS delivery failed. Please try again shortly." };
    }
    if (m.includes("invalid") || m.includes("phone") || m.includes("number")) {
      return { error: "That phone number isn't valid. Check the country code and try again." };
    }
    if (m.includes("rate") || m.includes("limit") || m.includes("too many")) {
      return { error: "Too many attempts. Please wait a moment before requesting another code." };
    }
    return { error: error.message };
  }
  return { success: "We sent a 6-digit code by text." };
}

/** Verify the code and mark the phone confirmed; syncs it to the profile. */
export async function verifyPhoneOtpAction(phone: string, token: string): Promise<PhoneState> {
  if (!isLiveSupabase()) return { error: "Phone verification isn't available in preview mode." };
  if (!e164.safeParse(phone).success) return { error: "Invalid phone number." };
  if (!/^\d{6}$/.test(token)) return { error: "Enter the 6-digit code from the text." };

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please sign in." };

  const { error } = await supabase.auth.verifyOtp({ phone, token, type: "phone_change" });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("expired")) return { error: "That code has expired. Tap Resend to get a new one." };
    if (m.includes("invalid") || m.includes("token") || m.includes("incorrect")) {
      return { error: "Incorrect code. Please check it and try again." };
    }
    return { error: error.message };
  }

  // Phone is now confirmed on auth.users — mirror it onto the profile.
  await supabase.from("profiles").update({ phone }).eq("id", auth.user.id);
  return { success: "Phone number verified.", verified: true };
}
