import "server-only";
// Admin-only reads for the verification review panel. Uses the service-role client
// (the pages are already admin-gated by requireAdminPage). Document files are private:
// they are exposed ONLY as short-expiry signed URLs minted here, never public URLs.
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";
import { unmetApprovalRequirements, type ReviewStatus } from "@/lib/pro/application";

export type AccountStatus = "active" | "suspended" | "banned";

const BUCKET = "verification-docs";
const SIGNED_URL_TTL = 90; // seconds — short-lived per correction #4

export interface PendingApplication {
  userId: string;
  businessName: string;
  primarySpecialty: string;
  city: string;
  status: ReviewStatus;
  accountStatus?: AccountStatus;
  submittedAt: string | null;
  portfolioCount: number;
  documentCount: number;
}

export async function getPendingApplications(): Promise<PendingApplication[]> {
  if (!isLiveSupabase()) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("professional_profiles")
    .select("user_id,business_name,primary_specialty,city,review_status,submitted_at,professional_portfolio_items(id),professional_documents(id)")
    .in("review_status", ["pending_review", "under_review"])
    .eq("is_demo", false)
    .order("submitted_at", { ascending: true });
  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map((r) => ({
    userId: r.user_id as string,
    businessName: (r.business_name as string) ?? "Unnamed",
    primarySpecialty: (r.primary_specialty as string) ?? "—",
    city: (r.city as string) ?? "—",
    status: (r.review_status as ReviewStatus) ?? "pending_review",
    submittedAt: (r.submitted_at as string) ?? null,
    portfolioCount: ((r.professional_portfolio_items as unknown[]) ?? []).length,
    documentCount: ((r.professional_documents as unknown[]) ?? []).length,
  }));
}

// ---- Tabbed applications list ----------------------------------------------
export type AppTab = "awaiting" | "changes" | "approved" | "rejected";
const TAB_STATUSES: Record<AppTab, ReviewStatus[]> = {
  awaiting: ["pending_review", "under_review"],
  changes: ["needs_more_info"],
  approved: ["approved"],
  rejected: ["rejected"],
};

export interface ApplicationCounts { awaiting: number; changes: number; approved: number; rejected: number }

export async function getApplicationCounts(): Promise<ApplicationCounts> {
  if (!isLiveSupabase()) return { awaiting: 0, changes: 0, approved: 0, rejected: 0 };
  const admin = createAdminClient();
  const count = async (statuses: ReviewStatus[]) => {
    const { count: c } = await admin
      .from("professional_profiles")
      .select("user_id", { count: "exact", head: true })
      .in("review_status", statuses)
      .eq("is_demo", false);
    return c ?? 0;
  };
  const [awaiting, changes, approved, rejected] = await Promise.all([
    count(TAB_STATUSES.awaiting), count(TAB_STATUSES.changes), count(TAB_STATUSES.approved), count(TAB_STATUSES.rejected),
  ]);
  return { awaiting, changes, approved, rejected };
}

export async function getApplicationsByTab(tab: AppTab): Promise<PendingApplication[]> {
  if (!isLiveSupabase()) return [];
  const admin = createAdminClient();
  // Awaiting = oldest first (fairness); decided tabs = most recent first.
  const oldestFirst = tab === "awaiting" || tab === "changes";
  const { data, error } = await admin
    .from("professional_profiles")
    .select("user_id,business_name,primary_specialty,city,review_status,submitted_at,professional_portfolio_items(id),professional_documents(id)")
    .in("review_status", TAB_STATUSES[tab])
    .eq("is_demo", false)
    .order("submitted_at", { ascending: oldestFirst, nullsFirst: false })
    .limit(200);
  if (error || !data) return [];
  // account_status (0024) fetched best-effort so the list works pre-migration too.
  const acct = new Map<string, string>();
  const { data: arows } = await admin.from("professional_profiles").select("user_id,account_status").in("review_status", TAB_STATUSES[tab]).eq("is_demo", false);
  for (const a of (arows as Array<{ user_id: string; account_status: string | null }> | null) ?? []) if (a.account_status) acct.set(a.user_id, a.account_status);
  return (data as Array<Record<string, unknown>>).map((r) => ({
    userId: r.user_id as string,
    businessName: (r.business_name as string) ?? "Unnamed",
    primarySpecialty: (r.primary_specialty as string) ?? "—",
    city: (r.city as string) ?? "—",
    status: (r.review_status as ReviewStatus) ?? "pending_review",
    accountStatus: (acct.get(r.user_id as string) as AccountStatus) ?? "active",
    submittedAt: (r.submitted_at as string) ?? null,
    portfolioCount: ((r.professional_portfolio_items as unknown[]) ?? []).length,
    documentCount: ((r.professional_documents as unknown[]) ?? []).length,
  }));
}

export interface AppDocument { id: string; kind: string; fileName: string; mimeType: string; signedUrl: string | null; reviewStatus: string; flagReason: string | null; createdAt: string }
export interface AppEvent { id: string; action: string; body: string | null; actorId: string | null; actorName: string; visibleToApplicant: boolean; createdAt: string }
export interface ApplicationDetail {
  userId: string;
  email: string | null;
  businessName: string;
  slug: string;
  primarySpecialty: string;
  city: string;
  yearsExperience: number | null;
  school: string | null;
  bio: string;
  instagramHandle: string | null;
  tiktokHandle: string | null;
  websiteUrl: string | null;
  portfolioUrl: string | null;
  status: ReviewStatus;
  accountStatus: AccountStatus;
  banReason: string | null;
  resubmissionCount: number;
  submittedAt: string | null;
  reviewedAt: string | null;
  needsInfoNote: string | null;
  needsInfoSections: string[];
  rejectionReason: string | null;
  stripeIdentitySessionId: string | null;
  /** Empty array = every approval requirement met (Approve may be enabled). */
  unmetRequirements: string[];
  portfolio: { id: string; url: string | null; caption: string | null }[];
  documents: AppDocument[];
  events: AppEvent[];
}

// ---- Audit log (read-only) --------------------------------------------------
export interface AuditEntry {
  id: string;
  action: string;
  actorName: string;
  targetType: string;
  targetName: string;
  body: string | null;
  createdAt: string;
}

/** Reverse-chron admin audit trail. `action` optionally filters to one action type. */
export async function getAuditLog(action?: string): Promise<AuditEntry[]> {
  if (!isLiveSupabase()) return [];
  const admin = createAdminClient();
  let q = admin
    .from("verification_events")
    .select("id,action,body,actor_id,professional_id,created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  if (action && action !== "all") q = q.eq("action", action);
  const { data } = await q;
  const rows = (data as Array<Record<string, unknown>> | null) ?? [];

  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean) as string[])];
  const proIds = [...new Set(rows.map((r) => r.professional_id).filter(Boolean) as string[])];
  const actorNames = new Map<string, string>();
  const proNames = new Map<string, string>();
  if (actorIds.length) {
    const { data: a } = await admin.from("profiles").select("id,full_name").in("id", actorIds);
    for (const p of (a as Array<{ id: string; full_name: string | null }> | null) ?? []) actorNames.set(p.id, p.full_name ?? "Admin");
  }
  if (proIds.length) {
    const { data: p } = await admin.from("professional_profiles").select("user_id,business_name").in("user_id", proIds);
    for (const r of (p as Array<{ user_id: string; business_name: string | null }> | null) ?? []) proNames.set(r.user_id, r.business_name ?? "Unnamed");
  }
  return rows.map((r) => ({
    id: r.id as string,
    action: r.action as string,
    actorName: r.actor_id ? actorNames.get(r.actor_id as string) ?? "Admin" : "Applicant / system",
    targetType: (r.target_type as string) ?? "application",
    targetName: proNames.get(r.professional_id as string) ?? "—",
    body: (r.body as string) ?? null,
    createdAt: r.created_at as string,
  }));
}

export async function getApplicationDetail(userId: string): Promise<ApplicationDetail | null> {
  if (!isLiveSupabase()) return null;
  const admin = createAdminClient();
  // Main select uses only columns present since 0023 — so a pre-0024 database never
  // errors the whole query (which would 404 the review page). The 0024 fields
  // (school, account_status, ban_reason, resubmission_count, per-doc review_status /
  // flag_reason) are fetched best-effort below and default gracefully when absent.
  const { data, error } = await admin
    .from("professional_profiles")
    .select("user_id,business_name,slug,primary_specialty,city,years_experience,bio,instagram_handle,tiktok_handle,website_url,portfolio_url,review_status,submitted_at,reviewed_at,needs_info_note,needs_info_sections,rejection_reason,stripe_identity_session_id,professional_portfolio_items(id,url,caption,is_hidden),professional_documents(id,kind,file_name,mime_type,file_path,created_at)")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const r = data as Record<string, unknown>;

  // 0024 profile fields — best-effort so a missing column never 404s the page.
  const { data: sd } = await admin
    .from("professional_profiles")
    .select("school,account_status,ban_reason,resubmission_count")
    .eq("user_id", userId)
    .maybeSingle();
  const extra = (sd as { school?: string; account_status?: string; ban_reason?: string; resubmission_count?: number } | null) ?? null;
  const school = extra?.school ?? null;

  // 0024 per-document review state — best-effort; defaults to "pending" pre-migration.
  const docReview = new Map<string, { review_status: string | null; flag_reason: string | null }>();
  const { data: drows } = await admin.from("professional_documents").select("id,review_status,flag_reason").eq("professional_id", userId);
  for (const d of (drows as Array<{ id: string; review_status: string | null; flag_reason: string | null }> | null) ?? []) {
    docReview.set(d.id, { review_status: d.review_status, flag_reason: d.flag_reason });
  }

  // email
  let email: string | null = null;
  try {
    const { data: u } = await admin.auth.admin.getUserById(userId);
    email = u.user?.email ?? null;
  } catch { /* ignore */ }

  // short-expiry signed URLs for private docs
  const rawDocs = (r.professional_documents as Array<{ id: string; kind: string; file_name: string; mime_type: string; file_path: string; created_at: string }>) ?? [];
  const documents: AppDocument[] = await Promise.all(
    rawDocs.map(async (d) => {
      const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(d.file_path, SIGNED_URL_TTL);
      const rev = docReview.get(d.id);
      return { id: d.id, kind: d.kind, fileName: d.file_name ?? "document", mimeType: d.mime_type ?? "", signedUrl: signed?.signedUrl ?? null, reviewStatus: rev?.review_status ?? "pending", flagReason: rev?.flag_reason ?? null, createdAt: d.created_at };
    }),
  );
  const unmetRequirements = unmetApprovalRequirements(rawDocs.map((d) => ({ kind: d.kind, review_status: docReview.get(d.id)?.review_status ?? null })));

  // audit events + actor names
  const { data: evRows } = await admin
    .from("verification_events")
    .select("id,action,body,actor_id,visible_to_applicant,created_at")
    .eq("professional_id", userId)
    .order("created_at", { ascending: false });
  const events = (evRows as Array<Record<string, unknown>> | null) ?? [];
  const actorIds = [...new Set(events.map((e) => e.actor_id).filter(Boolean) as string[])];
  const actorNames = new Map<string, string>();
  if (actorIds.length) {
    const { data: names } = await admin.from("profiles").select("id,full_name").in("id", actorIds);
    for (const p of (names as Array<{ id: string; full_name: string | null }> | null) ?? []) actorNames.set(p.id, p.full_name ?? "Admin");
  }

  return {
    userId,
    email,
    businessName: (r.business_name as string) ?? "Unnamed",
    slug: (r.slug as string) ?? "",
    primarySpecialty: (r.primary_specialty as string) ?? "",
    city: (r.city as string) ?? "",
    yearsExperience: (r.years_experience as number) ?? null,
    school,
    bio: (r.bio as string) ?? "",
    instagramHandle: (r.instagram_handle as string) ?? null,
    tiktokHandle: (r.tiktok_handle as string) ?? null,
    websiteUrl: (r.website_url as string) ?? null,
    portfolioUrl: (r.portfolio_url as string) ?? null,
    status: (r.review_status as ReviewStatus) ?? "pending_review",
    accountStatus: (extra?.account_status as AccountStatus) ?? "active",
    banReason: extra?.ban_reason ?? null,
    resubmissionCount: extra?.resubmission_count ?? 0,
    unmetRequirements,
    submittedAt: (r.submitted_at as string) ?? null,
    reviewedAt: (r.reviewed_at as string) ?? null,
    needsInfoNote: (r.needs_info_note as string) ?? null,
    needsInfoSections: (r.needs_info_sections as string[]) ?? [],
    rejectionReason: (r.rejection_reason as string) ?? null,
    stripeIdentitySessionId: (r.stripe_identity_session_id as string) ?? null,
    portfolio: ((r.professional_portfolio_items as Array<{ id: string; url: string | null; caption: string | null; is_hidden: boolean }>) ?? [])
      .filter((p) => !p.is_hidden)
      .map((p) => ({ id: p.id, url: p.url, caption: p.caption })),
    documents,
    events: events.map((e) => ({
      id: e.id as string,
      action: e.action as string,
      body: (e.body as string) ?? null,
      actorId: (e.actor_id as string) ?? null,
      actorName: e.actor_id ? actorNames.get(e.actor_id as string) ?? "Admin" : "Applicant",
      visibleToApplicant: Boolean(e.visible_to_applicant),
      createdAt: e.created_at as string,
    })),
  };
}

// ---------------------------------------------------------------------------
// CUSTOMER ID verification queue (customer_profiles, 0006/0028).
// ---------------------------------------------------------------------------

export interface PendingCustomerId {
  userId: string;
  name: string;
  email: string;
  documentUrl: string | null; // short-expiry signed URL (private bucket)
  submittedAt: string | null;
}

/** Customers awaiting an ID verdict, with a signed URL for the uploaded document. */
export async function listPendingCustomerIds(): Promise<PendingCustomerId[]> {
  if (!isLiveSupabase()) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("customer_profiles")
    .select("user_id, id_document_url, updated_at, profiles:user_id (full_name)")
    .eq("verification_status", "pending")
    .order("updated_at", { ascending: true })
    .limit(100);
  const rows = (data ?? []) as Array<{
    user_id: string;
    id_document_url: string | null;
    updated_at: string | null;
    profiles: { full_name: string | null } | Array<{ full_name: string | null }> | null;
  }>;

  return Promise.all(
    rows.map(async (r) => {
      const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      let documentUrl: string | null = null;
      if (r.id_document_url) {
        const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(r.id_document_url, SIGNED_URL_TTL);
        documentUrl = signed?.signedUrl ?? null;
      }
      // Email lives in auth.users, not profiles — same lookup the pro flow uses.
      let email = "";
      try {
        const { data: au } = await admin.auth.admin.getUserById(r.user_id);
        email = au.user?.email ?? "";
      } catch {
        /* fine — email is informational here */
      }
      return {
        userId: r.user_id,
        name: p?.full_name ?? "Member",
        email,
        documentUrl,
        submittedAt: r.updated_at,
      };
    }),
  );
}
