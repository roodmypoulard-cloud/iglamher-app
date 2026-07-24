// Shared types, constants, and validation for the "Become a Pro" application.
// Pure — safe to import from client or server.
import {
  PRO_AGREEMENTS, PRO_AGREEMENT_KEYS, HOME_STUDIO_QUESTIONS,
  needsHomeStudioAnswers, missingRequiredHomeStudioAnswers,
  type LocationCompliance, type ProAgreementKey,
} from "./compliance";

export type ReviewStatus = "draft" | "pending_review" | "under_review" | "approved" | "rejected" | "needs_more_info";

export const APPLICATION_SECTIONS = ["basics", "portfolio", "social", "location", "documents", "identity"] as const;
export type ApplicationSection = (typeof APPLICATION_SECTIONS)[number];
export const SECTION_LABELS: Record<ApplicationSection, string> = {
  basics: "Basics (category, city, experience, school, bio)",
  portfolio: "Portfolio photos / link",
  social: "Social & website links",
  location: "Service location & compliance",
  documents: "Diplomas & certificates",
  identity: "ID (verification only — not stored)",
};

// ---- Document upload constraints (correction #5) ---------------------------
export const DOC_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
export type DocMime = (typeof DOC_MIME_TYPES)[number];
export const DOC_EXT: Record<DocMime, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
// PDF, JPG/JPEG, PNG only. Magic-byte signatures to defeat spoofed MIME types.
export const DOC_MAGIC: Record<DocMime, number[][]> = {
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
};
export const DOC_MAX_BYTES = 10 * 1024 * 1024; // 10 MB per file
export const DOC_MAX_COUNT = 8; // per kind

export const PORTFOLIO_MIN = 3;
export const PORTFOLIO_MAX = 10;

// ---- Approval gating (single source of truth) ------------------------------
// An application may be APPROVED only when every rule below is satisfied by a
// document whose review_status is 'verified'. Edit here to change requirements.
export const DOC_REVIEW_STATUSES = ["pending", "verified", "flagged"] as const;
export type DocReviewStatus = (typeof DOC_REVIEW_STATUSES)[number];
export type DocKind =
  | "certification" | "license" | "id_document"
  | "diploma" | "certificate" | "insurance" | "portfolio_photo" | "other";

// government ID + at least one credential (diploma / license / certificate).
export const REQUIRED_IDENTITY_KINDS: DocKind[] = ["id_document"];
export const REQUIRED_CREDENTIAL_KINDS: DocKind[] = ["certification", "license", "diploma", "certificate"];

/** True when a document kind counts as a professional credential (cert/license/diploma/certificate). */
export function isCredentialKind(kind: string): boolean {
  return (REQUIRED_CREDENTIAL_KINDS as string[]).includes(kind);
}

export interface DocForApproval { kind: string; review_status?: string | null }
/** Returns the list of unmet approval requirements (empty array = ready to approve). */
export function unmetApprovalRequirements(docs: DocForApproval[]): string[] {
  const verified = (kinds: DocKind[]) =>
    docs.some((d) => (kinds as string[]).includes(d.kind) && d.review_status === "verified");
  const missing: string[] = [];
  if (!verified(REQUIRED_IDENTITY_KINDS)) missing.push("A verified government ID");
  if (!verified(REQUIRED_CREDENTIAL_KINDS)) missing.push("A verified diploma, license, or certificate");
  return missing;
}

// ---- Format validators -----------------------------------------------------
const HANDLE_RE = /^@?[A-Za-z0-9._]{1,30}$/;

export function isValidHandle(v: string): boolean {
  return HANDLE_RE.test(v.trim());
}

export function normalizeHandle(v: string): string {
  return v.trim().replace(/^@+/, "").toLowerCase();
}

export function isValidUrl(v: string): boolean {
  const s = v.trim();
  if (!s) return false;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

export function normalizeUrl(v: string): string {
  const s = v.trim();
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

export interface SocialInput {
  instagramHandle?: string | null;
  tiktokHandle?: string | null;
  websiteUrl?: string | null;
  portfolioUrl?: string | null;
}

/** Correction #5: at least one of Instagram, TikTok, website, or portfolio URL. */
export function hasAtLeastOneLink(s: SocialInput): boolean {
  return Boolean(
    (s.instagramHandle && s.instagramHandle.trim()) ||
      (s.tiktokHandle && s.tiktokHandle.trim()) ||
      (s.websiteUrl && s.websiteUrl.trim()) ||
      (s.portfolioUrl && s.portfolioUrl.trim()),
  );
}

/** An agreement acceptance already on file, as stored in `professional_agreements`. */
export interface AcceptedAgreement { agreement_key: string; version: string }

/** The acceptance set a pro has once they accept every agreement as it stands
 *  today — what the client can optimistically record after a successful save. */
export function currentAgreementAcceptances(): AcceptedAgreement[] {
  return PRO_AGREEMENT_KEYS.map((k) => ({ agreement_key: k, version: PRO_AGREEMENTS[k].version }));
}

/** Agreement keys whose CURRENT version has no acceptance on file. Acceptances
 *  of a superseded version don't count — the pro must accept what's live now. */
export function missingAgreementKeys(accepted: readonly AcceptedAgreement[]): ProAgreementKey[] {
  const have = new Set((accepted ?? []).map((a) => `${a.agreement_key}@${a.version}`));
  return PRO_AGREEMENT_KEYS.filter((k) => !have.has(`${k}@${PRO_AGREEMENTS[k].version}`));
}

export interface ApplicationForValidation extends SocialInput {
  primarySpecialty?: string | null;
  city?: string | null;
  yearsExperience?: number | null;
  school?: string | null;
  bio?: string | null;
  portfolioCount?: number;
  hasIdDocument?: boolean;
  hasCredentialDocument?: boolean;
  /** Declared service locations (`SERVICE_LOCATIONS` keys). Must be non-empty. */
  serviceLocations?: readonly string[];
  /** Home-studio answers; every required one must be answered when home-based. */
  locationCompliance?: LocationCompliance;
  /** Rows read from `professional_agreements` for this user. */
  acceptedAgreements?: readonly AcceptedAgreement[];
}

/** Full pre-submit validation. Returns a list of human-readable errors (empty = ok). */
export function validateForSubmit(a: ApplicationForValidation): string[] {
  const errors: string[] = [];
  if (!a.primarySpecialty?.trim()) errors.push("Choose your main service category.");
  if (!a.city?.trim()) errors.push("Enter your city / service area.");
  if (a.yearsExperience == null || a.yearsExperience < 0) errors.push("Enter your years of experience.");
  if (!a.school?.trim()) errors.push("Enter the school or program where you trained.");
  if (!a.bio?.trim() || a.bio.trim().length < 30) errors.push("Write a short bio (at least 30 characters).");

  // Portfolio: 3–10 photos OR a portfolio link
  const hasPhotos = (a.portfolioCount ?? 0) >= PORTFOLIO_MIN;
  const hasPortfolioLink = Boolean(a.portfolioUrl && a.portfolioUrl.trim());
  if (!hasPhotos && !hasPortfolioLink) errors.push(`Add ${PORTFOLIO_MIN}–${PORTFOLIO_MAX} portfolio photos, or a portfolio link.`);

  // At least one social/portfolio link, and each provided one must be well-formed
  if (!hasAtLeastOneLink(a)) errors.push("Add at least one link: Instagram, TikTok, website, or portfolio.");
  if (a.instagramHandle?.trim() && !isValidHandle(a.instagramHandle)) errors.push("Instagram handle looks invalid.");
  if (a.tiktokHandle?.trim() && !isValidHandle(a.tiktokHandle)) errors.push("TikTok handle looks invalid.");
  if (a.websiteUrl?.trim() && !isValidUrl(a.websiteUrl)) errors.push("Website URL looks invalid.");
  if (a.portfolioUrl?.trim() && !isValidUrl(a.portfolioUrl)) errors.push("Portfolio URL looks invalid.");

  // Credentials: at least one certification / license / diploma / certificate.
  // This mirrors the approval gate (unmetApprovalRequirements) so an application
  // can't enter the queue with nothing for an admin to verify.
  if (!a.hasCredentialDocument) errors.push("Upload at least one certification, license, diploma, or certificate.");

  // Identity: manual ID upload required for this version
  if (!a.hasIdDocument) errors.push("Upload a government ID for identity verification.");

  // Service location: at least one declared place of work. Required so we know
  // what to verify — an application with no location has nothing to review.
  const locations = a.serviceLocations ?? [];
  if (locations.length === 0) {
    errors.push("Choose where you provide services.");
  } else if (needsHomeStudioAnswers(locations)) {
    // Home-based work: every legally-required question needs an explicit answer.
    const missing = missingRequiredHomeStudioAnswers(a.locationCompliance ?? {});
    if (missing.length > 0) {
      const first = HOME_STUDIO_QUESTIONS.find((q) => q.key === missing[0]);
      errors.push(
        missing.length === 1 && first
          ? `Answer the required home studio question: “${first.label}”`
          : `Answer all ${missing.length} remaining required home studio questions.`,
      );
    }
  }

  // Legal agreements: both, at the version currently in force.
  if (missingAgreementKeys(a.acceptedAgreements ?? []).length > 0) {
    errors.push("Accept both professional agreements before submitting.");
  }

  return errors;
}

/** Anti-spoof: confirm the file's real magic bytes match its declared MIME. */
export function magicBytesMatch(mime: string, head: Uint8Array): boolean {
  const sigs = DOC_MAGIC[mime as DocMime];
  if (!sigs) return false;
  return sigs.some((sig) => sig.every((b, i) => head[i] === b));
}
