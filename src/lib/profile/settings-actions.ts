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
import { writeAudit } from "@/lib/audit/log";

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

// Booking statuses that block pausing/deleting (still in flight).
const ACTIVE_BOOKING_STATUSES = ["pending_payment", "confirmed", "change_requested", "in_progress", "disputed"];

/** Count in-flight bookings where the user is customer OR professional. */
async function countActiveBookings(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string): Promise<number> {
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .or(`customer_id.eq.${userId},professional_id.eq.${userId}`)
    .in("status", ACTIVE_BOOKING_STATUSES);
  return count ?? 0;
}

/** Show/hide the user's professional profile in the marketplace (admin write:
 *  the column guard blocks self-setting is_active). Only restores if published. */
async function setProVisibility(userId: string, visible: boolean) {
  const admin = createAdminClient();
  if (visible) {
    await admin.from("professional_profiles").update({ is_active: true }).eq("user_id", userId).eq("review_status", "approved");
  } else {
    await admin.from("professional_profiles").update({ is_active: false }).eq("user_id", userId);
  }
}

export async function pauseAccountAction(): Promise<SettingsState> {
  const gate = await requireUser();
  if ("error" in gate) return { error: gate.error };
  const upcoming = await countActiveBookings(gate.supabase, gate.user.id);
  if (upcoming > 0) {
    return { error: `You have ${upcoming} active booking${upcoming > 1 ? "s" : ""}. Complete, cancel, or reschedule them before pausing.` };
  }
  const now = new Date();
  const { error } = await gate.supabase
    .from("profiles")
    .update({ account_status: "paused", paused_at: now.toISOString(), pause_expires_at: new Date(now.getTime() + 30 * 864e5).toISOString(), deactivated_at: null })
    .eq("id", gate.user.id);
  if (error) return { error: error.message };
  await setProVisibility(gate.user.id, false);
  await writeAudit({ actorId: gate.user.id, action: "account.pause", entity: "user", entityId: gate.user.id, metadata: { days: 30 } });
  revalidatePath("/profile/settings");
  return { success: "Account paused for 30 days. Your profile is hidden; reactivate anytime." };
}

export async function deactivateAccountAction(): Promise<SettingsState> {
  const gate = await requireUser();
  if ("error" in gate) return { error: gate.error };
  const { error } = await gate.supabase
    .from("profiles")
    .update({ account_status: "deactivated", deactivated_at: new Date().toISOString(), paused_at: null, pause_expires_at: null })
    .eq("id", gate.user.id);
  if (error) return { error: error.message };
  await setProVisibility(gate.user.id, false);
  await writeAudit({ actorId: gate.user.id, action: "account.deactivate", entity: "user", entityId: gate.user.id });
  revalidatePath("/profile/settings");
  return { success: "Account deactivated. Your profile is hidden; reactivate anytime to restore access." };
}

export async function reactivateAccountAction(): Promise<SettingsState> {
  const gate = await requireUser();
  if ("error" in gate) return { error: gate.error };
  const { error } = await gate.supabase
    .from("profiles")
    .update({ account_status: "active", paused_at: null, pause_expires_at: null, deactivated_at: null })
    .eq("id", gate.user.id);
  if (error) return { error: error.message };
  await setProVisibility(gate.user.id, true);
  await writeAudit({ actorId: gate.user.id, action: "account.reactivate", entity: "user", entityId: gate.user.id });
  revalidatePath("/profile/settings");
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

/** Reasons a user cannot delete yet — must be resolved first. */
export async function getDeletionEligibilityAction(): Promise<{ canDelete: boolean; blockers: string[] }> {
  const gate = await requireUser();
  if ("error" in gate) return { canDelete: false, blockers: ["Please sign in."] };
  const { supabase, user } = gate;
  const blockers: string[] = [];

  const active = await countActiveBookings(supabase, user.id);
  if (active > 0) blockers.push(`${active} active booking${active > 1 ? "s" : ""} — complete or cancel them first`);

  const admin = createAdminClient();
  const { count: pendingPayouts } = await admin
    .from("payout_transfers")
    .select("id", { count: "exact", head: true })
    .eq("professional_id", user.id)
    .in("status", ["pending", "failed"]);
  if ((pendingPayouts ?? 0) > 0) blockers.push(`${pendingPayouts} pending payout${pendingPayouts! > 1 ? "s" : ""} — wait until settled`);

  const { data: disputed } = await supabase
    .from("bookings")
    .select("id", { head: false })
    .or(`customer_id.eq.${user.id},professional_id.eq.${user.id}`)
    .eq("status", "disputed")
    .limit(1);
  if ((disputed?.length ?? 0) > 0) blockers.push("an active dispute — resolve it first");

  const { count: processingRefunds } = await admin
    .from("refunds")
    .select("id", { count: "exact", head: true })
    .in("status", ["processing", "pending"]);
  if ((processingRefunds ?? 0) > 0) blockers.push(`${processingRefunds} refund(s) still processing`);

  return { canDelete: blockers.length === 0, blockers };
}

/**
 * Permanently delete the account. Requires re-authentication (password) and the
 * literal "DELETE". Financial records are FK-protected (bookings/payments use ON
 * DELETE RESTRICT), so we SOFT-delete + anonymize the profile, purge personal
 * data + storage, disable login, and revoke sessions. Server-side only.
 */
export async function deleteAccountAction(password: string, confirmText: string): Promise<SettingsState> {
  const gate = await requireUser();
  if ("error" in gate) return { error: gate.error };
  const { supabase, user } = gate;
  if (confirmText !== "DELETE") return { error: 'Type "DELETE" to confirm.' };

  // Re-authenticate (password users). OAuth-only users have no password grant;
  // being in an authenticated session is their re-auth.
  if (user.email) {
    const { error: reauth } = await supabase.auth.signInWithPassword({ email: user.email, password });
    if (reauth) return { error: "Password is incorrect." };
  }

  const { canDelete, blockers } = await getDeletionEligibilityAction();
  if (!canDelete) return { error: `Can't delete yet: ${blockers.join("; ")}.` };

  const admin = createAdminClient();
  const uid = user.id;

  // 1) Purge personal data (soft-delete keeps FK-protected financial rows).
  await Promise.all([
    admin.from("favorites").delete().eq("customer_id", uid),
    admin.from("addresses").delete().eq("user_id", uid),
    admin.from("notification_preferences").delete().eq("user_id", uid),
    admin.from("professional_portfolio_items").delete().eq("professional_id", uid),
    admin.from("services").delete().eq("professional_id", uid),
    admin.from("availability_rules").delete().eq("professional_id", uid),
    admin.from("availability_exceptions").delete().eq("professional_id", uid),
    admin.from("professional_category_assignments").delete().eq("professional_id", uid),
    admin.from("blocked_dates").delete().eq("professional_id", uid),
  ]);

  // 2) Purge portfolio media from Storage.
  try {
    const { data: files } = await admin.storage.from("portfolio").list(uid);
    if (files?.length) await admin.storage.from("portfolio").remove(files.map((f) => `${uid}/${f.name}`));
  } catch { /* storage best-effort */ }

  // 3) Anonymize + hide professional profile (bookings/payments stay, FK-linked).
  await admin.from("professional_profiles").update({
    is_active: false, business_name: "Deleted provider", bio: null, headline: null,
    instagram_handle: null, avatar_url: null, cover_url: null,
  }).eq("user_id", uid);

  // 4) Anonymize the personal profile (remove identity; retain the row for FKs).
  const nowIso = new Date().toISOString();
  await admin.from("profiles").update({
    account_status: "deleted", full_name: "Deleted User", first_name: null, last_name: null,
    phone: null, avatar_url: null,
    deletion_requested_at: nowIso, deleted_at: nowIso, anonymized_at: nowIso,
  }).eq("id", uid);

  await writeAudit({ actorId: uid, action: "account.delete", entity: "user", entityId: uid, metadata: { anonymized: true } });

  // 5) Disable login + revoke sessions: scramble the auth email/password and ban.
  await admin.auth.admin.updateUserById(uid, {
    email: `deleted-${uid}@deleted.iglamher.invalid`,
    password: crypto.randomUUID() + crypto.randomUUID(),
    ban_duration: "876000h",
  });

  await supabase.auth.signOut();
  redirect("/?deleted=1");
}
