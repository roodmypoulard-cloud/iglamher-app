"use server";
// Applicant-side actions for the "Become a Pro" application: autosave draft, submit,
// and document upload/remove. All run with the user's own session so RLS enforces
// ownership. Edits are blocked once submitted unless an admin set needs_more_info
// (and then only the flagged sections). Files go to the PRIVATE verification-docs bucket.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
import {
  DOC_MIME_TYPES, DOC_EXT, DOC_MAX_BYTES, DOC_MAX_COUNT, magicBytesMatch,
  normalizeHandle, normalizeUrl, isValidHandle, isValidUrl, validateForSubmit, isCredentialKind,
  sectionEditable,
  type ReviewStatus, type ApplicationSection, type DocMime, type AcceptedAgreement,
} from "./application";
import type { LocationCompliance } from "./compliance";

const BUCKET = "verification-docs";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function gate(): Promise<{ error: string } | { supabase: ServerClient; user: User }> {
  if (!isLiveSupabase()) return { error: "Applications require a connected Supabase project." };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Please sign in." };
  return { supabase, user: data.user };
}

// Not exported: "use server" modules may only export async functions.
const BANNED_MESSAGE =
  "This account has been banned and can no longer apply to become a pro. Contact support@iglamher.com if you believe this is a mistake.";
const SUSPENDED_MESSAGE =
  "This account is temporarily suspended, so your application can't be edited or submitted right now. Contact support@iglamher.com.";

/** Refusal message when the applicant's account may not write (banned or
 *  suspended), or null when writes are allowed. Both states must be refused
 *  HERE with honest copy: 0037's RLS restricts owner writes to active accounts,
 *  and an RLS-filtered update matches zero rows without erroring — which the UI
 *  would otherwise show as success. review_status alone doesn't say (a rejected
 *  pro may also be banned; 0024's ban doesn't touch review_status). Best-effort:
 *  pre-0024 the column doesn't exist and this reports writable. */
async function accountWriteBlock(supabase: ServerClient, userId: string): Promise<string | null> {
  const { data } = await supabase.from("professional_profiles").select("account_status").eq("user_id", userId).maybeSingle();
  const status = (data as { account_status?: string } | null)?.account_status;
  if (status === "banned") return BANNED_MESSAGE;
  if (status === "suspended") return SUSPENDED_MESSAGE;
  return null;
}

export interface MyApplication {
  exists: boolean;
  status: ReviewStatus;
  businessName: string;
  primarySpecialty: string;
  city: string;
  yearsExperience: number | null;
  school: string;
  bio: string;
  instagramHandle: string;
  tiktokHandle: string;
  websiteUrl: string;
  portfolioUrl: string;
  portfolioCount: number;
  documents: { id: string; kind: string; fileName: string; createdAt: string }[];
  needsInfoNote: string;
  needsInfoSections: string[];
  rejectionReason: string;
  submittedAt: string | null;
  /** Legal prerequisites (migration 0032) — mirrored into the wizard so the
   *  review step shows the same blockers the server enforces on submit. */
  serviceLocations: string[];
  locationCompliance: LocationCompliance;
  acceptedAgreements: AcceptedAgreement[];
}

const EMPTY_COMPLIANCE = { serviceLocations: [] as string[], locationCompliance: {} as LocationCompliance, acceptedAgreements: [] as AcceptedAgreement[] };

export async function getMyApplicationAction(): Promise<MyApplication | null> {
  const g = await gate();
  if ("error" in g) return null;
  const { supabase, user } = g;
  const { data } = await supabase
    .from("professional_profiles")
    .select("business_name,primary_specialty,city,years_experience,bio,instagram_handle,tiktok_handle,website_url,portfolio_url,review_status,needs_info_note,needs_info_sections,rejection_reason,submitted_at,professional_portfolio_items(id),professional_documents(id,kind,file_name,created_at)")
    .eq("user_id", user.id)
    .maybeSingle();
  // school is from migration 0024 — read best-effort so a missing column never breaks the wizard.
  const { data: schoolRow } = await supabase.from("professional_profiles").select("school").eq("user_id", user.id).maybeSingle();
  const school = (schoolRow as { school?: string } | null)?.school ?? "";
  if (!data) return { exists: false, status: "draft", businessName: "", primarySpecialty: "", city: "", yearsExperience: null, school: "", bio: "", instagramHandle: "", tiktokHandle: "", websiteUrl: "", portfolioUrl: "", portfolioCount: 0, documents: [], needsInfoNote: "", needsInfoSections: [], rejectionReason: "", submittedAt: null, ...EMPTY_COMPLIANCE };
  // Compliance + agreements are from migration 0032 — read best-effort in their own
  // queries so a missing column/table degrades to "not accepted yet" (which the
  // review step reports as a blocker) instead of breaking the whole wizard.
  const compliance = await readComplianceBestEffort(supabase, user.id);
  const r = data as Record<string, unknown>;
  const docs = (r.professional_documents as Array<{ id: string; kind: string; file_name: string; created_at: string }> | null) ?? [];
  const portfolio = (r.professional_portfolio_items as Array<{ id: string }> | null) ?? [];
  return {
    exists: true,
    status: (r.review_status as ReviewStatus) ?? "draft",
    businessName: (r.business_name as string) ?? "",
    primarySpecialty: (r.primary_specialty as string) ?? "",
    city: (r.city as string) ?? "",
    yearsExperience: (r.years_experience as number) ?? null,
    school,
    bio: (r.bio as string) ?? "",
    instagramHandle: (r.instagram_handle as string) ?? "",
    tiktokHandle: (r.tiktok_handle as string) ?? "",
    websiteUrl: (r.website_url as string) ?? "",
    portfolioUrl: (r.portfolio_url as string) ?? "",
    portfolioCount: portfolio.length,
    documents: docs.map((d) => ({ id: d.id, kind: d.kind, fileName: d.file_name, createdAt: d.created_at })),
    needsInfoNote: (r.needs_info_note as string) ?? "",
    needsInfoSections: (r.needs_info_sections as string[]) ?? [],
    rejectionReason: (r.rejection_reason as string) ?? "",
    submittedAt: (r.submitted_at as string) ?? null,
    ...compliance,
  };
}

/** Read-only view of the 0032 compliance state; never throws, never blocks. */
async function readComplianceBestEffort(supabase: ServerClient, userId: string): Promise<ComplianceForSubmit> {
  const result = await readComplianceForSubmit(supabase, userId);
  return "error" in result ? { ...EMPTY_COMPLIANCE } : result;
}

/** Ensure the applicant has a professional_profiles row + professional role BEFORE
 *  the wizard renders, so portfolio/document uploads (which require a pro row + role)
 *  never fail on a race with the first autosave. Safe to call repeatedly. */
export async function ensureApplicationRowAction(): Promise<ActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const { supabase, user } = g;
  // Existence check on user_id ONLY — a column that always exists — so this never
  // depends on migration 0024's account_status being present yet.
  const { data: existing } = await supabase.from("professional_profiles").select("user_id").eq("user_id", user.id).maybeSingle();
  if (existing) {
    // Best-effort moderation check: harmless no-op until account_status exists
    // (0024). Suspended is refused too — 0037's RLS makes every owner write a
    // silent zero-row no-op for non-active accounts, so rendering the wizard
    // would be a page of fake-success inputs.
    const blocked = await accountWriteBlock(supabase, user.id);
    if (blocked) return { ok: false, error: blocked };
    await supabase.from("profiles").update({ role: "professional" }).eq("id", user.id).eq("role", "customer");
    // Align with onboarding: an applying customer becomes account_type 'both' in
    // professional mode. Without this the mode switcher never rendered for pros
    // who joined via /pro/apply (account_type stayed 'customer').
    await supabase.from("profiles").update({ account_type: "both", active_mode: "professional" }).eq("id", user.id).eq("account_type", "customer");
    return { ok: true };
  }
  const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const name = (prof as { full_name?: string } | null)?.full_name?.trim() || "My studio";
  await supabase.from("profiles").update({ role: "professional" }).eq("id", user.id);
  await supabase.from("profiles").update({ account_type: "both", active_mode: "professional" }).eq("id", user.id).eq("account_type", "customer");
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}-${user.id.slice(0, 8)}`;
  const { error } = await supabase.from("professional_profiles").insert({ user_id: user.id, business_name: name, slug });
  if (error && !/duplicate|unique/i.test(error.message)) return { ok: false, error: error.message };
  return { ok: true };
}

const draftSchema = z.object({
  businessName: z.string().max(120).optional(),
  primarySpecialty: z.string().max(60).optional(),
  city: z.string().max(120).optional(),
  // null = explicit clear (the input was emptied); absent = untouched.
  yearsExperience: z.union([z.null(), z.coerce.number().int().min(0).max(70)]).optional(),
  school: z.string().max(160).optional(),
  bio: z.string().max(2000).optional(),
  instagramHandle: z.string().max(40).optional(),
  tiktokHandle: z.string().max(40).optional(),
  websiteUrl: z.string().max(300).optional(),
  portfolioUrl: z.string().max(300).optional(),
});

/** Autosave the editable fields. Silently ignores fields whose section is locked.
 *  Sent-but-empty strings are explicit clears (saved as such); a cleared
 *  business name resolves to the profile name, returned in `data` so the client
 *  can reflect what was actually stored. */
export async function saveApplicationDraftAction(input: unknown): Promise<ActionResult<{ businessName?: string }>> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const { supabase, user } = g;
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const v = parsed.data;

  const blocked = await accountWriteBlock(supabase, user.id);
  if (blocked) return { ok: false, error: blocked };

  // Ensure a profile row exists (mark role professional).
  const { data: existing } = await supabase.from("professional_profiles").select("review_status,needs_info_sections").eq("user_id", user.id).maybeSingle();
  const status = ((existing as { review_status?: ReviewStatus } | null)?.review_status ?? "draft") as ReviewStatus;
  const flagged = ((existing as { needs_info_sections?: string[] } | null)?.needs_info_sections ?? []) as string[];
  // Same lifecycle rule as sectionEditable: draft, needs_more_info (per-section,
  // enforced below) and rejected (fix + resubmit, 0037) may write; in-flight and
  // approved applications are locked.
  if (status !== "draft" && status !== "needs_more_info" && status !== "rejected") {
    return { ok: false, error: "This application is locked while under review." };
  }

  // Field-level format checks (reject clearly-bad values; empty is allowed for autosave)
  if (v.instagramHandle && v.instagramHandle.trim() && !isValidHandle(v.instagramHandle)) return { ok: false, error: "Instagram handle looks invalid." };
  if (v.tiktokHandle && v.tiktokHandle.trim() && !isValidHandle(v.tiktokHandle)) return { ok: false, error: "TikTok handle looks invalid." };
  if (v.websiteUrl && v.websiteUrl.trim() && !isValidUrl(v.websiteUrl)) return { ok: false, error: "Website URL looks invalid." };
  if (v.portfolioUrl && v.portfolioUrl.trim() && !isValidUrl(v.portfolioUrl)) return { ok: false, error: "Portfolio URL looks invalid." };

  const patch: Record<string, unknown> = {};
  const setIf = (section: ApplicationSection, apply: () => void) => { if (sectionEditable(status, flagged, section)) apply(); };
  setIf("basics", () => {
    // Business name is optional. "" (cleared) is resolved to the applicant's own
    // profile name below — the admin queue and public profile rely on
    // business_name always having a value, and the placeholder promises that
    // leaving it blank uses their own name.
    if (v.businessName !== undefined) patch.business_name = v.businessName.trim();
    if (v.primarySpecialty !== undefined) patch.primary_specialty = v.primarySpecialty.trim();
    if (v.city !== undefined) patch.city = v.city.trim();
    if (v.yearsExperience !== undefined) patch.years_experience = v.yearsExperience;
    if (v.bio !== undefined) patch.bio = v.bio.trim();
  });
  setIf("social", () => {
    if (v.instagramHandle !== undefined) patch.instagram_handle = v.instagramHandle.trim() ? normalizeHandle(v.instagramHandle) : null;
    if (v.tiktokHandle !== undefined) patch.tiktok_handle = v.tiktokHandle.trim() ? normalizeHandle(v.tiktokHandle) : null;
    if (v.websiteUrl !== undefined) patch.website_url = v.websiteUrl.trim() ? normalizeUrl(v.websiteUrl) : null;
  });
  setIf("portfolio", () => {
    if (v.portfolioUrl !== undefined) patch.portfolio_url = v.portfolioUrl.trim() ? normalizeUrl(v.portfolioUrl) : null;
  });

  if (sectionEditable(status, flagged, "basics") && v.school !== undefined) {
    patch.school = v.school.trim();
  }

  if (Object.keys(patch).length === 0) return { ok: true };

  // Cleared business name -> revert to the applicant's own profile name (same
  // default the row is created with), so "leave blank to use your own name" is
  // literally what happens — never a silent keep, never an empty display name.
  if (patch.business_name === "") {
    const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    patch.business_name = (prof as { full_name?: string } | null)?.full_name?.trim() || "My studio";
  }

  const resolvedBusinessName = typeof patch.business_name === "string" && v.businessName?.trim() === ""
    ? patch.business_name
    : undefined;

  if (existing) {
    // The status predicate closes the check-then-write race with submit: once
    // another request locks the row, this update affects zero rows.
    const { data: updated, error } = await supabase
      .from("professional_profiles")
      .update(patch)
      .eq("user_id", user.id)
      .in("review_status", ["draft", "needs_more_info", "rejected"])
      .select("user_id");
    if (error) return { ok: false, error: error.message };
    if (!updated?.length) return { ok: false, error: "This application is locked while under review." };
  } else {
    // First save creates the row. business_name defaults to the profile name.
    const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    const name = (prof as { full_name?: string } | null)?.full_name?.trim() || "My studio";
    await supabase.from("profiles").update({ role: "professional" }).eq("id", user.id);
    await supabase.from("profiles").update({ account_type: "both", active_mode: "professional" }).eq("id", user.id).eq("account_type", "customer");
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}-${user.id.slice(0, 8)}`;
    const { error } = await supabase.from("professional_profiles").insert({ user_id: user.id, business_name: name, slug, ...patch });
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true, data: resolvedBusinessName ? { businessName: resolvedBusinessName } : undefined };
}

/** Upload one document to the PRIVATE bucket after validating type/size/magic-bytes. */
export async function uploadDocumentAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const { supabase, user } = g;

  const blocked = await accountWriteBlock(supabase, user.id);
  if (blocked) return { ok: false, error: blocked };

  const kind = z.enum(["certification", "license", "id_document"]).safeParse(formData.get("kind"));
  if (!kind.success) return { ok: false, error: "Invalid document type." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No file selected." };

  // editability
  const { data: prof } = await supabase.from("professional_profiles").select("review_status,needs_info_sections").eq("user_id", user.id).maybeSingle();
  const status = ((prof as { review_status?: ReviewStatus } | null)?.review_status ?? "draft") as ReviewStatus;
  const flagged = ((prof as { needs_info_sections?: string[] } | null)?.needs_info_sections ?? []) as string[];
  const section: ApplicationSection = kind.data === "id_document" ? "identity" : "documents";
  if (!sectionEditable(status, flagged, section)) return { ok: false, error: "This section is locked right now." };

  // type + size (correction #5)
  if (!DOC_MIME_TYPES.includes(file.type as DocMime)) return { ok: false, error: "Only PDF, JPG, JPEG, or PNG files are allowed." };
  if (file.size > DOC_MAX_BYTES) return { ok: false, error: "File too large (max 10 MB)." };
  // anti-spoof: verify real magic bytes match declared MIME
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!magicBytesMatch(file.type, head)) return { ok: false, error: "That file's contents don't match its type." };

  // per-kind count cap
  const { count } = await supabase.from("professional_documents").select("id", { count: "exact", head: true }).eq("professional_id", user.id).eq("kind", kind.data);
  if ((count ?? 0) >= DOC_MAX_COUNT) return { ok: false, error: `You can upload up to ${DOC_MAX_COUNT} of these.` };

  const ext = DOC_EXT[file.type as DocMime];
  const path = `${user.id}/${kind.data}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { ok: false, error: upErr.message };

  const { data: row, error: insErr } = await supabase
    .from("professional_documents")
    .insert({ professional_id: user.id, kind: kind.data, file_path: path, file_name: file.name.slice(0, 200), mime_type: file.type, size_bytes: file.size })
    .select("id")
    .single();
  if (insErr) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { ok: false, error: insErr.message };
  }
  revalidatePath("/pro/application");
  return { ok: true, data: { id: (row as { id: string }).id } };
}

export async function removeDocumentAction(documentId: string): Promise<ActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const { supabase, user } = g;
  const blocked = await accountWriteBlock(supabase, user.id);
  if (blocked) return { ok: false, error: blocked };
  const { data: doc } = await supabase.from("professional_documents").select("file_path,kind").eq("id", documentId).eq("professional_id", user.id).maybeSingle();
  if (!doc) return { ok: false, error: "Document not found." };
  const { data: prof } = await supabase.from("professional_profiles").select("review_status,needs_info_sections").eq("user_id", user.id).maybeSingle();
  const status = ((prof as { review_status?: ReviewStatus } | null)?.review_status ?? "draft") as ReviewStatus;
  const flagged = ((prof as { needs_info_sections?: string[] } | null)?.needs_info_sections ?? []) as string[];
  const section: ApplicationSection = (doc as { kind: string }).kind === "id_document" ? "identity" : "documents";
  if (!sectionEditable(status, flagged, section)) return { ok: false, error: "This section is locked right now." };
  await supabase.storage.from(BUCKET).remove([(doc as { file_path: string }).file_path]);
  await supabase.from("professional_documents").delete().eq("id", documentId).eq("professional_id", user.id);
  revalidatePath("/pro/application");
  return { ok: true };
}

interface ComplianceForSubmit {
  serviceLocations: string[];
  locationCompliance: LocationCompliance;
  acceptedAgreements: AcceptedAgreement[];
}

/** Read the legal prerequisites for submit straight from the DB.
 *
 *  Fails CLOSED: if the 0032 columns/table aren't there yet, or the read errors,
 *  we cannot prove the pro accepted the agreements or declared a location — so
 *  we refuse the submit rather than waving through an unverifiable application. */
async function readComplianceForSubmit(
  supabase: ServerClient,
  userId: string,
): Promise<ComplianceForSubmit | { error: string }> {
  const BLOCKED = { error: "We can't verify your legal agreements right now. Please try again in a few minutes or contact support@iglamher.com." };

  const { data: profile, error: profileErr } = await supabase
    .from("professional_profiles")
    .select("service_locations,location_compliance")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileErr || !profile) {
    console.error("[application.submit] compliance read failed", profileErr?.message ?? "no profile row");
    return BLOCKED;
  }

  const { data: agreements, error: agreementsErr } = await supabase
    .from("professional_agreements")
    .select("agreement_key,version")
    .eq("user_id", userId);
  if (agreementsErr) {
    console.error("[application.submit] agreements read failed", agreementsErr.message);
    return BLOCKED;
  }

  const row = profile as { service_locations?: unknown; location_compliance?: unknown };
  return {
    serviceLocations: Array.isArray(row.service_locations)
      ? row.service_locations.filter((l): l is string => typeof l === "string")
      : [],
    locationCompliance: (row.location_compliance ?? {}) as LocationCompliance,
    acceptedAgreements: (agreements ?? []) as AcceptedAgreement[],
  };
}

/** Submit (or resubmit after needs_more_info / rejected). Validates, locks, writes an immutable event. */
export async function submitApplicationAction(): Promise<ActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const { supabase, user } = g;

  const { data: acct } = await supabase.from("professional_profiles").select("account_status,resubmission_count").eq("user_id", user.id).maybeSingle();
  const accountStatus = (acct as { account_status?: string } | null)?.account_status;
  if (accountStatus === "banned") {
    return { ok: false, error: "This account has been banned and can no longer apply. Contact support@iglamher.com if you believe this is a mistake." };
  }
  // Suspension blocks pro features, including re-entering the review queue —
  // an admin lifts it via Reactivate, which is the moment resubmission opens up.
  if (accountStatus === "suspended") {
    return { ok: false, error: "This account is temporarily suspended, so the application can't be submitted right now. Contact support@iglamher.com." };
  }

  const app = await getMyApplicationAction();
  if (!app || !app.exists) return { ok: false, error: "Fill out your application first." };
  // Rejected applicants may fix things and resubmit (0037 permits the transition);
  // banned accounts were already turned away above.
  if (app.status !== "draft" && app.status !== "needs_more_info" && app.status !== "rejected") {
    return { ok: false, error: "Your application is already submitted." };
  }

  // Legal gate (C1): service locations, home-studio answers, and both current
  // agreement versions are read from the DB — never trusted from the client.
  const compliance = await readComplianceForSubmit(supabase, user.id);
  if ("error" in compliance) return { ok: false, error: compliance.error };

  const errors = validateForSubmit({
    primarySpecialty: app.primarySpecialty, city: app.city, yearsExperience: app.yearsExperience, school: app.school, bio: app.bio,
    instagramHandle: app.instagramHandle, tiktokHandle: app.tiktokHandle, websiteUrl: app.websiteUrl, portfolioUrl: app.portfolioUrl,
    portfolioCount: app.portfolioCount, hasIdDocument: app.documents.some((d) => d.kind === "id_document"),
    hasCredentialDocument: app.documents.some((d) => isCredentialKind(d.kind)),
    serviceLocations: compliance.serviceLocations,
    locationCompliance: compliance.locationCompliance,
    acceptedAgreements: compliance.acceptedAgreements,
  });
  if (errors.length) return { ok: false, error: errors[0] };

  // 0037 performs the expected-state transition, resubmission count, document
  // reset and audit event in one transaction. It also requires an ACTIVE account
  // and a freshly uploaded pending ID after rejection.
  const { error } = await supabase.rpc("submit_professional_application", {
    p_expected_status: app.status,
  });
  if (error) {
    // The RPC ships in migration 0037; in this repo code deploys ahead of the
    // SQL (Boss applies APPLY_PENDING files). First-time submission worked
    // before 0037 and must not break while the migration is pending: fall back
    // to the pre-0037 direct-update path for the transitions the OLD trigger
    // permits (draft / needs_more_info). Rejected-resubmit genuinely requires
    // 0037 — the old trigger refuses that transition — so it fails honestly.
    // Never leak PostgREST/SQL internals either way.
    const migrationMissing =
      error.code === "PGRST202"
      || error.code === "42883"
      || /submit_professional_application|schema cache|could not find the function/i.test(error.message);
    if (!migrationMissing) return { ok: false, error: error.message };
    if (app.status === "rejected") {
      return { ok: false, error: "Resubmitting after a rejection isn't available just yet. Your work is saved — please try again later or contact support@iglamher.com." };
    }
    const legacy = await legacySubmitFallback(supabase, user.id, app.status);
    if (!legacy.ok) return legacy;
  }
  revalidatePath("/pro/application");
  revalidatePath("/admin/applications");
  return { ok: true };
}

/** Pre-0037 submit path (draft / needs_more_info only): the same non-atomic
 *  sequence that shipped before the RPC existed. Runs ONLY when the RPC is
 *  missing — i.e. against the old trigger, which permits exactly these
 *  transitions — so a pending migration never takes down first-time submits. */
async function legacySubmitFallback(
  supabase: ServerClient,
  userId: string,
  status: "draft" | "needs_more_info",
): Promise<ActionResult> {
  const resubmit = status === "needs_more_info";
  const { data: acct } = await supabase.from("professional_profiles").select("resubmission_count").eq("user_id", userId).maybeSingle();
  const nextCount = ((acct as { resubmission_count?: number } | null)?.resubmission_count ?? 0) + 1;
  const { data: updated, error } = await supabase
    .from("professional_profiles")
    .update({ review_status: "pending_review", submitted_at: new Date().toISOString(), needs_info_note: null, needs_info_sections: [], rejection_reason: null })
    .eq("user_id", userId)
    .eq("review_status", status)
    .select("user_id");
  if (error) return { ok: false, error: error.message };
  if (!updated?.length) return { ok: false, error: "Application state changed; refresh and try again." };
  const admin = createAdminClient();
  if (resubmit) {
    // Counter increment + flagged-doc reset, same best-effort semantics as the
    // pre-0037 code. Doc reset uses the service role: owners deliberately have
    // no UPDATE policy on professional_documents.
    await supabase.from("professional_profiles").update({ resubmission_count: nextCount }).eq("user_id", userId);
    await admin.from("professional_documents").update({ review_status: "pending", flag_reason: null }).eq("professional_id", userId).eq("review_status", "flagged");
  }
  // Applicants have no insert policy on verification_events (they must never be
  // able to forge audit rows) — the event is written with the service role.
  const { error: eventErr } = await admin
    .from("verification_events")
    .insert({ professional_id: userId, actor_id: userId, action: resubmit ? "resubmitted" : "submitted", visible_to_applicant: false });
  if (eventErr && !/does not exist|schema cache|could not find/i.test(eventErr.message)) {
    console.error("[application.submit] audit event insert failed", eventErr.message);
  }
  return { ok: true };
}
