"use server";
// Minimal Phase 3 admin controls. Admin writes go through the SERVICE-ROLE client
// (never exposed to the browser) and only AFTER verifying the caller's own session
// carries an admin role. This matches the spec: admin access is server-validated,
// not granted through normal client keys.
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";
import { unmetApprovalRequirements } from "@/lib/pro/application";

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

/**
 * Toggle a professional's public visibility from the admin dashboard.
 *
 * This is NOT an approval path — it never stamps review_status='approved' and never
 * verifies documents. Approval only happens through approveApplicationAction, which
 * checks the government ID + credential requirements and purges the ID afterward.
 *
 *  - Deactivating (active=false) is always allowed.
 *  - Activating (active=true) is refused unless the pro has ALREADY been approved
 *    (review_status='approved') and is not banned/suspended — this only ever re-enables
 *    visibility for a previously-vetted pro. To approve a new applicant, use the
 *    application review (approveApplicationAction).
 */
export async function setProfessionalActiveAction(userId: string, active: boolean): Promise<AdminResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const admin = createAdminClient();

  if (!active) {
    const { error } = await admin.from("professional_profiles").update({ is_active: false }).eq("user_id", userId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin");
    revalidatePath("/admin/applications");
    return { ok: true };
  }

  const { data: cur } = await admin
    .from("professional_profiles")
    .select("account_status, review_status")
    .eq("user_id", userId)
    .maybeSingle();
  const c = cur as { account_status?: string; review_status?: string } | null;
  if (c?.account_status === "banned" || c?.account_status === "suspended") {
    return { ok: false, error: "This account is banned or suspended — reactivate it before making it public." };
  }
  if (c?.review_status !== "approved") {
    return { ok: false, error: "Approve the application first — open it to verify their ID and credentials, then Approve." };
  }
  // Already vetted → safe to re-enable visibility without re-stamping the decision.
  const { error } = await admin.from("professional_profiles").update({ is_active: true }).eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  revalidatePath("/admin/applications");
  return { ok: true };
}

/**
 * Legacy verified toggle. Turning verification OFF is always allowed; turning it ON
 * makes the pro public, so it enforces the SAME gate as the full approval flow —
 * refuses banned/suspended accounts and requires the government ID + credential
 * documents to be verified first. It does not replace approveApplicationAction (which
 * also emails the applicant and purges the ID); prefer that for new approvals.
 */
export async function setProfessionalVerifiedAction(userId: string, verified: boolean): Promise<AdminResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const admin = createAdminClient();

  if (!verified) {
    const { error } = await admin.from("professional_profiles").update({ is_verified: false }).eq("user_id", userId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/applications");
    revalidatePath("/admin");
    return { ok: true };
  }

  const { data: acct } = await admin.from("professional_profiles").select("account_status").eq("user_id", userId).maybeSingle();
  if ((acct as { account_status?: string } | null)?.account_status === "banned" || (acct as { account_status?: string } | null)?.account_status === "suspended") {
    return { ok: false, error: "This account is banned or suspended and cannot be verified." };
  }
  const { data: docs } = await admin.from("professional_documents").select("kind, review_status").eq("professional_id", userId);
  const unmet = unmetApprovalRequirements((docs as Array<{ kind: string; review_status: string | null }> | null) ?? []);
  if (unmet.length > 0) return { ok: false, error: `Cannot verify yet — still needed: ${unmet.join("; ")}. Use the application review to approve.` };

  const { error } = await admin.from("professional_profiles").update({ is_verified: true, is_active: true }).eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/applications");
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
