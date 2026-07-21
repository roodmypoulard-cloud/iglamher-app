"use server";
// Account settings mutations. Every action authenticates and operates only on the
// signed-in user's own rows. New-column writes degrade gracefully until migration
// 0017 is applied. Never exposes secrets.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";

export type SettingsState = { error?: string; success?: string } | undefined;

async function requireUser() {
  if (!isLiveSupabase()) return { error: "Connect Supabase to manage your account." as const };
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please sign in." as const };
  return { supabase, user: auth.user };
}

const nameSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name").max(60),
  lastName: z.string().trim().min(1, "Enter your last name").max(60),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
});

export async function updatePersonalInfoAction(_p: SettingsState, formData: FormData): Promise<SettingsState> {
  const gate = await requireUser();
  if ("error" in gate) return { error: gate.error };
  const parsed = nameSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { firstName, lastName, phone } = parsed.data;
  const { error } = await gate.supabase
    .from("profiles")
    .update({ first_name: firstName, last_name: lastName, full_name: `${firstName} ${lastName}`.trim(), phone: phone || null })
    .eq("id", gate.user.id);
  if (error) return { error: error.message };
  revalidatePath("/profile/settings");
  return { success: "Personal information updated." };
}

export async function changeEmailAction(_p: SettingsState, formData: FormData): Promise<SettingsState> {
  const gate = await requireUser();
  if ("error" in gate) return { error: gate.error };
  const email = z.string().email("Enter a valid email").safeParse(formData.get("email"));
  if (!email.success) return { error: "Enter a valid email." };
  const { error } = await gate.supabase.auth.updateUser({ email: email.data });
  if (error) return { error: error.message };
  return { success: "Check your new email to confirm the change." };
}

export async function changePasswordAction(_p: SettingsState, formData: FormData): Promise<SettingsState> {
  const gate = await requireUser();
  if ("error" in gate) return { error: gate.error };
  const pw = z.string().min(8, "At least 8 characters").safeParse(formData.get("password"));
  if (!pw.success) return { error: pw.error.issues[0]?.message ?? "Invalid password" };
  if (formData.get("password") !== formData.get("confirmPassword")) return { error: "Passwords do not match." };
  const { error } = await gate.supabase.auth.updateUser({ password: pw.data });
  if (error) return { error: error.message };
  return { success: "Password updated." };
}

export async function changePhoneAction(_p: SettingsState, formData: FormData): Promise<SettingsState> {
  const gate = await requireUser();
  if ("error" in gate) return { error: gate.error };
  const phone = z.string().trim().max(30).safeParse(formData.get("phone"));
  if (!phone.success) return { error: "Enter a valid phone number." };
  const { error } = await gate.supabase.from("profiles").update({ phone: phone.data || null }).eq("id", gate.user.id);
  if (error) return { error: error.message };
  revalidatePath("/profile/settings");
  return { success: "Phone number updated." };
}

async function setStatus(status: "active" | "paused" | "deactivated"): Promise<{ error: string } | null> {
  const gate = await requireUser();
  if ("error" in gate) return { error: gate.error ?? "Please sign in." };
  const patch: Record<string, unknown> = { account_status: status };
  if (status === "paused") { patch.paused_until = new Date(Date.now() + 30 * 864e5).toISOString(); patch.deactivated_at = null; }
  else if (status === "deactivated") { patch.deactivated_at = new Date().toISOString(); patch.paused_until = null; }
  else { patch.paused_until = null; patch.deactivated_at = null; }
  const { error } = await gate.supabase.from("profiles").update(patch).eq("id", gate.user.id);
  if (error) return { error: error.message };
  revalidatePath("/profile/settings");
  return null;
}

export async function pauseAccountAction(): Promise<SettingsState> {
  const r = await setStatus("paused");
  if (r) return r;
  return { success: "Account paused for 30 days. You can reactivate anytime." };
}
export async function deactivateAccountAction(): Promise<SettingsState> {
  const r = await setStatus("deactivated");
  if (r) return r;
  return { success: "Account deactivated. Reactivate anytime to restore access." };
}
export async function reactivateAccountAction(): Promise<SettingsState> {
  const r = await setStatus("active");
  if (r) return r;
  return { success: "Welcome back — your account is active again." };
}

export async function saveNotificationPrefsAction(_p: SettingsState, formData: FormData): Promise<SettingsState> {
  const gate = await requireUser();
  if ("error" in gate) return { error: gate.error };
  const row = {
    user_id: gate.user.id,
    email: formData.get("email") === "on" || formData.get("email") === "true",
    sms: formData.get("sms") === "on" || formData.get("sms") === "true",
    push: formData.get("push") === "on" || formData.get("push") === "true",
  };
  const { error } = await gate.supabase.from("notification_preferences").upsert(row, { onConflict: "user_id" });
  if (error) return { error: error.message };
  revalidatePath("/profile/settings");
  return { success: "Notification preferences saved." };
}

export async function saveLanguageAction(language: string): Promise<SettingsState> {
  const gate = await requireUser();
  if ("error" in gate) return { error: gate.error };
  const l = z.enum(["en", "es", "fr", "ht"]).safeParse(language);
  if (!l.success) return { error: "Unsupported language." };
  const { error } = await gate.supabase.from("profiles").update({ language: l.data }).eq("id", gate.user.id);
  if (error) return { error: error.message };
  revalidatePath("/profile/settings");
  return { success: "Language updated." };
}

export async function saveAppearanceAction(appearance: string): Promise<SettingsState> {
  const gate = await requireUser();
  if ("error" in gate) return { error: gate.error };
  const a = z.enum(["system", "light", "dark"]).safeParse(appearance);
  if (!a.success) return { error: "Invalid option." };
  await gate.supabase.from("profiles").update({ appearance: a.data }).eq("id", gate.user.id);
  return { success: "Appearance saved." };
}

/** Export the user's own data as a downloadable JSON payload. */
export async function downloadMyDataAction(): Promise<{ error?: string; data?: string }> {
  const gate = await requireUser();
  if ("error" in gate) return { error: gate.error };
  const { supabase, user } = gate;
  const [profile, bookings, prefs] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("bookings").select("*").eq("customer_id", user.id),
    supabase.from("notification_preferences").select("*").eq("user_id", user.id).maybeSingle(),
  ]);
  const payload = {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email },
    profile: profile.data ?? null,
    bookings: bookings.data ?? [],
    notification_preferences: prefs.data ?? null,
  };
  return { data: JSON.stringify(payload, null, 2) };
}

/** Permanently delete the account. Cascades all owned rows via auth.users FK. */
export async function deleteAccountAction(): Promise<SettingsState> {
  const gate = await requireUser();
  if ("error" in gate) return { error: gate.error };
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(gate.user.id);
  if (error) return { error: error.message };
  await gate.supabase.auth.signOut();
  redirect("/");
}
