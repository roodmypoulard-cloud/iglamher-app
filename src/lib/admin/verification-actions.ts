"use server";
// Admin review actions for pro applications. Every action is admin-gated, writes an
// immutable verification_events audit row, and (approve/reject/needs-info) emails the
// applicant via Zoho SMTP. Profile writes use the service-role client (bypasses the
// is_verified/is_active column guards, which only privileged writers may change).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";
import { APPLICATION_SECTIONS, unmetApprovalRequirements } from "@/lib/pro/application";
import { sendEmail, approvedEmail, rejectedEmail, needsInfoEmail } from "@/lib/email/send";
import { writeAudit } from "@/lib/audit/log";

export type AdminResult = { ok: true } | { ok: false; error: string };

type Admin = ReturnType<typeof createAdminClient>;

/** Append one immutable audit row. target defaults to the application (the professional). */
async function logEvent(
  admin: Admin,
  opts: {
    proId: string;
    actorId: string;
    action: string;
    body?: string;
    visibleToApplicant?: boolean;
    targetType?: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await admin.from("verification_events").insert({
    professional_id: opts.proId,
    actor_id: opts.actorId,
    action: opts.action,
    body: opts.body ?? null,
    visible_to_applicant: opts.visibleToApplicant ?? false,
    target_type: opts.targetType ?? "application",
    target_id: opts.targetId ?? opts.proId,
    metadata: opts.metadata ?? {},
  });
}

async function requireAdmin(): Promise<{ ok: false; error: string } | { ok: true; adminId: string }> {
  if (!isLiveSupabase()) return { ok: false, error: "Connect Supabase to use admin controls." };
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Sign in required." };
  const { data } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if ((data as { role?: string } | null)?.role !== "admin") return { ok: false, error: "Admin only." };
  return { ok: true, adminId: auth.user.id };
}

async function applicant(admin: ReturnType<typeof createAdminClient>, proId: string): Promise<{ email: string | null; name: string }> {
  const { data: prof } = await admin.from("professional_profiles").select("business_name").eq("user_id", proId).maybeSingle();
  const name = (prof as { business_name?: string } | null)?.business_name?.trim() || "there";
  try {
    const { data } = await admin.auth.admin.getUserById(proId);
    return { email: data.user?.email ?? null, name };
  } catch {
    return { email: null, name };
  }
}

/** Delete the applicant's government-ID files + rows. We promise not to store IDs,
 *  so they're purged the moment a decision is made — verification only, never kept. */
async function purgeIdDocuments(admin: ReturnType<typeof createAdminClient>, proId: string): Promise<void> {
  const { data } = await admin.from("professional_documents").select("id,file_path").eq("professional_id", proId).eq("kind", "id_document");
  const rows = (data as Array<{ id: string; file_path: string }> | null) ?? [];
  if (rows.length === 0) return;
  await admin.storage.from("verification-docs").remove(rows.map((r) => r.file_path)).catch(() => {});
  await admin.from("professional_documents").delete().eq("professional_id", proId).eq("kind", "id_document");
}

/** Mark a submitted application as under review (when an admin opens it). */
export async function openApplicationAction(proId: string): Promise<AdminResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const admin = createAdminClient();
  const { data: cur } = await admin.from("professional_profiles").select("review_status").eq("user_id", proId).maybeSingle();
  if ((cur as { review_status?: string } | null)?.review_status === "pending_review") {
    await admin.from("professional_profiles").update({ review_status: "under_review" }).eq("user_id", proId);
    await admin.from("verification_events").insert({ professional_id: proId, actor_id: gate.adminId, action: "opened" });
    revalidatePath("/admin/applications");
  }
  return { ok: true };
}

export async function approveApplicationAction(proId: string): Promise<AdminResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const admin = createAdminClient();

  // Guard: a banned account can never be approved.
  const { data: acct } = await admin.from("professional_profiles").select("account_status").eq("user_id", proId).maybeSingle();
  if ((acct as { account_status?: string } | null)?.account_status === "banned") {
    return { ok: false, error: "This account is banned and cannot be approved." };
  }

  // Guard: enforce the same approval requirements the UI shows (defence in depth).
  const { data: docs } = await admin.from("professional_documents").select("kind, review_status").eq("professional_id", proId);
  const unmet = unmetApprovalRequirements((docs as Array<{ kind: string; review_status: string | null }> | null) ?? []);
  if (unmet.length > 0) return { ok: false, error: `Cannot approve yet — still needed: ${unmet.join("; ")}.` };

  const { error } = await admin
    .from("professional_profiles")
    .update({ is_verified: true, is_active: true, review_status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: gate.adminId, rejection_reason: null, needs_info_note: null, needs_info_sections: [] })
    .eq("user_id", proId);
  if (error) return { ok: false, error: error.message };
  await purgeIdDocuments(admin, proId); // ID used only for verification — never stored
  await logEvent(admin, { proId, actorId: gate.adminId, action: "approved", visibleToApplicant: true });
  const { email, name } = await applicant(admin, proId);
  if (email) { const t = approvedEmail(name); await sendEmail(email, t.subject, t.html, t.text); }
  revalidatePath("/admin/applications");
  revalidatePath("/admin/applications");
  return { ok: true };
}

export async function rejectApplicationAction(proId: string, reason: string): Promise<AdminResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const r = z.string().trim().min(5, "Please give a reason (min 5 characters).").max(1000).safeParse(reason);
  if (!r.success) return { ok: false, error: r.error.issues[0].message };
  const admin = createAdminClient();
  const { error } = await admin
    .from("professional_profiles")
    .update({ review_status: "rejected", is_active: false, is_verified: false, reviewed_at: new Date().toISOString(), reviewed_by: gate.adminId, rejection_reason: r.data })
    .eq("user_id", proId);
  if (error) return { ok: false, error: error.message };
  await purgeIdDocuments(admin, proId);
  await admin.from("verification_events").insert({ professional_id: proId, actor_id: gate.adminId, action: "rejected", body: r.data, visible_to_applicant: true });
  const { email, name } = await applicant(admin, proId);
  if (email) { const t = rejectedEmail(name, r.data); await sendEmail(email, t.subject, t.html, t.text); }
  revalidatePath("/admin/applications");
  return { ok: true };
}

export async function needsMoreInfoAction(proId: string, note: string, sections: string[]): Promise<AdminResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const n = z.string().trim().min(5, "Add a note explaining what's needed.").max(1000).safeParse(note);
  if (!n.success) return { ok: false, error: n.error.issues[0].message };
  const secs = (Array.isArray(sections) ? sections : []).filter((s): s is (typeof APPLICATION_SECTIONS)[number] => (APPLICATION_SECTIONS as readonly string[]).includes(s));
  if (secs.length === 0) return { ok: false, error: "Select at least one section they should fix." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("professional_profiles")
    .update({ review_status: "needs_more_info", needs_info_note: n.data, needs_info_sections: secs, reviewed_at: new Date().toISOString(), reviewed_by: gate.adminId })
    .eq("user_id", proId);
  if (error) return { ok: false, error: error.message };
  // Only purge the ID when identity is one of the sections we're asking them to redo —
  // that's the only case where they can re-upload it (identity is locked otherwise).
  // Purging it for an unrelated needs-info request would delete the one ID doc while
  // leaving the section un-editable, permanently blocking a later approve.
  if (secs.includes("identity")) await purgeIdDocuments(admin, proId);
  await admin.from("verification_events").insert({ professional_id: proId, actor_id: gate.adminId, action: "needs_more_info", body: n.data, visible_to_applicant: true });
  const { email, name } = await applicant(admin, proId);
  if (email) { const t = needsInfoEmail(name, n.data, secs); await sendEmail(email, t.subject, t.html, t.text); }
  revalidatePath("/admin/applications");
  return { ok: true };
}

/** Internal admin note (never emailed, not visible to the applicant). */
export async function addInternalNoteAction(proId: string, note: string): Promise<AdminResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const n = z.string().trim().min(1).max(1000).safeParse(note);
  if (!n.success) return { ok: false, error: "Note can't be empty." };
  const admin = createAdminClient();
  await logEvent(admin, { proId, actorId: gate.adminId, action: "note", body: n.data });
  revalidatePath(`/admin/applications/${proId}`);
  return { ok: true };
}

// ---- Per-document review ----------------------------------------------------
/** Mark a single uploaded document verified or flagged. Flagging requires a reason. */
export async function reviewDocumentAction(docId: string, decision: "verified" | "flagged", flagReason?: string): Promise<AdminResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  if (decision !== "verified" && decision !== "flagged") return { ok: false, error: "Invalid decision." };
  let reason: string | null = null;
  if (decision === "flagged") {
    const r = z.string().trim().min(3, "Add a short reason for flagging this document.").max(500).safeParse(flagReason ?? "");
    if (!r.success) return { ok: false, error: r.error.issues[0].message };
    reason = r.data;
  }
  const admin = createAdminClient();
  const { data: doc } = await admin.from("professional_documents").select("professional_id, kind").eq("id", docId).maybeSingle();
  const d = doc as { professional_id?: string; kind?: string } | null;
  if (!d?.professional_id) return { ok: false, error: "Document not found." };
  const { error } = await admin
    .from("professional_documents")
    .update({ review_status: decision, flag_reason: reason, reviewed_by: gate.adminId, reviewed_at: new Date().toISOString() })
    .eq("id", docId);
  if (error) return { ok: false, error: error.message };
  await logEvent(admin, {
    proId: d.professional_id, actorId: gate.adminId,
    action: decision === "verified" ? "doc_verified" : "doc_flagged",
    body: reason ?? undefined, targetType: "document", targetId: docId, metadata: { kind: d.kind },
  });
  revalidatePath(`/admin/applications/${d.professional_id}`);
  revalidatePath(`/admin/applications/${d.professional_id}`);
  return { ok: true };
}

// ---- Account moderation (independent of the application review) --------------
/** Ban an account: hidden everywhere, blocked from pro features, cannot re-apply. */
export async function banProfessionalAction(proId: string, reason: string): Promise<AdminResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const r = z.string().trim().min(5, "A ban reason is required (min 5 characters).").max(1000).safeParse(reason);
  if (!r.success) return { ok: false, error: r.error.issues[0].message };
  const admin = createAdminClient();
  const { error } = await admin
    .from("professional_profiles")
    .update({ account_status: "banned", banned_at: new Date().toISOString(), banned_by: gate.adminId, ban_reason: r.data, is_active: false, is_verified: false, is_featured: false })
    .eq("user_id", proId);
  if (error) return { ok: false, error: error.message };
  await purgeIdDocuments(admin, proId);
  await logEvent(admin, { proId, actorId: gate.adminId, action: "banned", body: r.data, targetType: "professional" });
  revalidatePath("/admin/applications");
  revalidatePath("/admin/professionals");
  return { ok: true };
}

/** Temporarily suspend (reversible): hidden + blocked, but may be reactivated. */
export async function suspendProfessionalAction(proId: string, reason: string): Promise<AdminResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const r = z.string().trim().min(3, "Add a short reason.").max(1000).safeParse(reason);
  if (!r.success) return { ok: false, error: r.error.issues[0].message };
  const admin = createAdminClient();
  const { error } = await admin
    .from("professional_profiles")
    .update({ account_status: "suspended", suspended_at: new Date().toISOString(), is_active: false })
    .eq("user_id", proId);
  if (error) return { ok: false, error: error.message };
  await logEvent(admin, { proId, actorId: gate.adminId, action: "suspended", body: r.data, targetType: "professional" });
  revalidatePath("/admin/applications");
  revalidatePath("/admin/professionals");
  return { ok: true };
}

/** Reactivate a suspended/banned account back to active (does not re-verify). */
export async function reactivateProfessionalAction(proId: string): Promise<AdminResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const admin = createAdminClient();
  const { data: cur } = await admin.from("professional_profiles").select("account_status").eq("user_id", proId).maybeSingle();
  const wasBanned = (cur as { account_status?: string } | null)?.account_status === "banned";
  const { error } = await admin
    .from("professional_profiles")
    .update({ account_status: "active", banned_at: null, banned_by: null, ban_reason: null, suspended_at: null, is_active: true })
    .eq("user_id", proId);
  if (error) return { ok: false, error: error.message };
  await logEvent(admin, { proId, actorId: gate.adminId, action: wasBanned ? "unbanned" : "unsuspended", targetType: "professional" });
  revalidatePath("/admin/applications");
  revalidatePath("/admin/professionals");
  return { ok: true };
}

/** Toggle the verified badge (admin override, audit-logged). */
export async function toggleVerifiedAction(proId: string, next: boolean): Promise<AdminResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const admin = createAdminClient();
  const { error } = await admin.from("professional_profiles").update({ is_verified: next }).eq("user_id", proId);
  if (error) return { ok: false, error: error.message };
  await logEvent(admin, { proId, actorId: gate.adminId, action: next ? "verified_on" : "verified_off", targetType: "professional" });
  revalidatePath("/admin/professionals");
  return { ok: true };
}

/** Toggle the featured flag (audit-logged). Cannot feature a non-active account. */
export async function toggleFeaturedAction(proId: string, next: boolean): Promise<AdminResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const admin = createAdminClient();
  if (next) {
    const { data: acct } = await admin.from("professional_profiles").select("account_status").eq("user_id", proId).maybeSingle();
    if ((acct as { account_status?: string } | null)?.account_status !== "active") {
      return { ok: false, error: "Only active accounts can be featured." };
    }
  }
  const { error } = await admin.from("professional_profiles").update({ is_featured: next }).eq("user_id", proId);
  if (error) return { ok: false, error: error.message };
  await logEvent(admin, { proId, actorId: gate.adminId, action: next ? "featured_on" : "featured_off", targetType: "professional" });
  revalidatePath("/admin/professionals");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// CUSTOMER identity verification (KYC-lite, customer_profiles from 0006/0028).
// Verdicts run on the service-role client (bypasses the 0028 owner guards) and
// are audit-logged. The ID document is deleted once a verdict lands — it exists
// only to be reviewed, never stored long-term (same policy as pro IDs).
// ---------------------------------------------------------------------------

async function purgeCustomerIdDocument(admin: Admin, userId: string): Promise<void> {
  const { data } = await admin.from("customer_profiles").select("id_document_url").eq("user_id", userId).maybeSingle();
  const path = (data as { id_document_url?: string | null } | null)?.id_document_url;
  if (path) await admin.storage.from("verification-docs").remove([path]).catch(() => {});
}

export async function approveCustomerIdAction(userId: string): Promise<AdminResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const admin = createAdminClient();
  const { error } = await admin
    .from("customer_profiles")
    .update({ is_id_verified: true, verification_status: "approved" })
    .eq("user_id", userId)
    .eq("verification_status", "pending");
  if (error) return { ok: false, error: error.message };
  await purgeCustomerIdDocument(admin, userId);
  await admin.from("customer_profiles").update({ id_document_url: null }).eq("user_id", userId);
  await writeAudit({ actorId: gate.adminId, action: "verification.customer_id_approve", entity: "user", entityId: userId });
  revalidatePath("/admin/applications");
  return { ok: true };
}

export async function rejectCustomerIdAction(userId: string): Promise<AdminResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const admin = createAdminClient();
  const { error } = await admin
    .from("customer_profiles")
    .update({ is_id_verified: false, verification_status: "rejected" })
    .eq("user_id", userId)
    .eq("verification_status", "pending");
  if (error) return { ok: false, error: error.message };
  await purgeCustomerIdDocument(admin, userId);
  await admin.from("customer_profiles").update({ id_document_url: null }).eq("user_id", userId);
  await writeAudit({ actorId: gate.adminId, action: "verification.customer_id_reject", entity: "user", entityId: userId });
  revalidatePath("/admin/applications");
  return { ok: true };
}
