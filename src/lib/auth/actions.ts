"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { safeNext } from "./safe-next";
import { rateLimitGuard } from "@/lib/security/guard";
import {
  signUpSchema,
  signInSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./schemas";

export type ActionState = { error?: string; success?: string } | undefined;

// All mutations validated server-side with Zod. Role is never taken from the
// client — new users default to `customer` via the DB trigger.

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const limited = await rateLimitGuard("auth");
  if (limited) return { error: limited };

  const parsed = signUpSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    accountType: formData.get("accountType") ?? "customer",
    acceptTerms: formData.get("acceptTerms") ?? false,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { firstName, lastName, email, phone, password, accountType } = parsed.data;
  const fullName = `${firstName} ${lastName}`.trim();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // Email confirmation is disabled for beta, so no verification screen. We keep
    // emailRedirectTo pointed at production (never localhost) for any future use.
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      return { error: "An account with this email already exists. Please sign in instead." };
    }
    if (msg.includes("password")) {
      return { error: "That password isn't valid — use at least 8 characters." };
    }
    return { error: error.message };
  }

  // With confirmation OFF, a duplicate signup returns a user with no identities
  // and NO error (Supabase obfuscates to prevent email enumeration). Detect it.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { error: "An account with this email already exists. Please sign in instead." };
  }

  // Ensure an authenticated session exists (confirmation off → signUp returns one;
  // this also covers any edge case by establishing the session explicitly).
  let userId = data.session?.user?.id ?? data.user?.id;
  if (!data.session) {
    const { data: si, error: siErr } = await supabase.auth.signInWithPassword({ email, password });
    if (siErr || !si.session) {
      return { error: "Account created. Please sign in to continue." };
    }
    userId = si.session.user.id;
  }

  // Persist role + account type + profile before redirecting. A professional/both
  // account needs role='professional' (self-upgrade permitted by the role trigger)
  // so pro features unlock; a 'both' account starts in customer mode and can switch.
  // These writes no-op gracefully until migration 0016 adds the columns.
  if (userId) {
    const isPro = accountType === "professional" || accountType === "both";
    if (isPro) {
      await supabase.from("profiles").update({ role: "professional" }).eq("id", userId);
    }
    await supabase
      .from("profiles")
      .update({
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        phone: phone || null,
        account_type: accountType,
        active_mode: accountType === "professional" ? "professional" : "customer",
      })
      .eq("id", userId);
  }

  // Route by account type. 'both' starts with professional onboarding, then can
  // switch modes; customer goes straight to the lightweight customer onboarding.
  const dest = accountType === "customer" ? "/onboarding/customer" : "/onboarding/professional";
  redirect(dest);
}

/** Finish the lightweight customer onboarding and enter the marketplace. */
export async function finishCustomerOnboardingAction() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user) {
    await supabase.from("profiles").update({ onboarding_complete: true }).eq("id", auth.user.id);
  }
  redirect("/discover");
}

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const limited = await rateLimitGuard("auth");
  if (limited) return { error: limited };

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Incorrect email or password." };

  redirect(safeNext(formData.get("next")));
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/signin");
}

export async function forgotPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid email" };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
  });
  if (error) return { error: error.message };
  return { success: "If that email exists, a reset link is on its way." };
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid password" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };
  redirect("/discover");
}
