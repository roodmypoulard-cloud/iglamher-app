"use server";
// Minimal Phase 3 admin controls. Admin writes go through the SERVICE-ROLE client
// (never exposed to the browser) and only AFTER verifying the caller's own session
// carries an admin role. This matches the spec: admin access is server-validated,
// not granted through normal client keys.
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";

export type AdminResult = { ok: true } | { ok: false; error: string };

async function requireAdmin(): Promise<{ ok: false; error: string } | { ok: true }> {
  if (!isLiveSupabase()) return { ok: false, error: "Connect Supabase to use admin controls." };
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Sign in required." };
  const { data } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if ((data as { role?: string } | null)?.role !== "admin") return { ok: false, error: "Admin only." };
  return { ok: true };
}

export async function setProfessionalActiveAction(userId: string, active: boolean): Promise<AdminResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const admin = createAdminClient();
  // Approving (activating) also stamps the review decision, so the provider's
  // onboarding state reflects "approved". Deactivating leaves review_status as-is.
  const patch = active ? { is_active: true, review_status: "approved" } : { is_active: false };
  const { error } = await admin.from("professional_profiles").update(patch).eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

export async function setProfessionalFeaturedAction(userId: string, featured: boolean): Promise<AdminResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const admin = createAdminClient();
  const { error } = await admin.from("professional_profiles").update({ is_featured: featured }).eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

export async function setPortfolioHiddenAction(itemId: string, hidden: boolean): Promise<AdminResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const admin = createAdminClient();
  const { error } = await admin.from("professional_portfolio_items").update({ is_hidden: hidden }).eq("id", itemId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

export async function setCategoryActiveAction(categoryId: string, active: boolean): Promise<AdminResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const admin = createAdminClient();
  const { error } = await admin.from("categories").update({ is_active: active }).eq("id", categoryId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}
