import "server-only";
// Secure verification-document storage.
//
// • Private bucket (no public read). Supabase Storage encrypts objects at rest
//   (AES-256); for defence-in-depth, app-level envelope encryption can wrap the
//   bytes before upload (see PRODUCTION_SETUP.md — needs a KMS key).
// • Access is admin-only, via short-lived SIGNED URLs (never public URLs).
// • Every document view is written to the audit log (access logging).
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";
import { writeAudit } from "@/lib/audit/log";
import { UPLOAD_LIMITS, safeFilename } from "@/lib/pro/schemas";

export const DOCUMENTS_BUCKET = "verification-documents";
const DOC_MIMES = [...UPLOAD_LIMITS.mimes, "application/pdf"] as const;
const DOC_MAX_BYTES = 15 * 1024 * 1024;

export type DocResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function validateDocument(file: { type: string; size: number }): string | null {
  if (!DOC_MIMES.includes(file.type as (typeof DOC_MIMES)[number])) {
    return "Unsupported document type. Upload a JPEG, PNG, WebP, or PDF.";
  }
  if (file.size > DOC_MAX_BYTES) return `Document too large. Max ${DOC_MAX_BYTES / (1024 * 1024)} MB.`;
  return null;
}

/** Owner uploads a verification doc to their private prefix. */
export async function uploadVerificationDocument(
  kind: "id" | "license" | "insurance" | "selfie" | "certification",
  file: File,
): Promise<DocResult<string>> {
  const invalid = validateDocument(file);
  if (invalid) return { ok: false, error: invalid };
  if (!isLiveSupabase()) return { ok: false, error: "Connect Supabase Storage to upload documents." };

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Please sign in." };

  const path = `${auth.user.id}/${kind}-${crypto.randomUUID()}-${safeFilename(file.name)}`;
  const admin = createAdminClient();
  const { error } = await admin.storage.from(DOCUMENTS_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return { ok: false, error: error.message };
  await writeAudit({ actorId: auth.user.id, action: "document.upload", entity: "verification", entityId: auth.user.id, metadata: { kind, path } });
  return { ok: true, value: path };
}

/** Admin-only: mint a short-lived signed URL and log the access. */
export async function getSignedDocumentUrl(path: string, expiresInSeconds = 300): Promise<DocResult<string>> {
  if (!isLiveSupabase()) return { ok: false, error: "Storage not configured." };
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Please sign in." };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") return { ok: false, error: "Admin only." };

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(DOCUMENTS_BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error || !data) return { ok: false, error: error?.message ?? "Could not sign URL." };

  await writeAudit({ actorId: auth.user.id, action: "document.view", entity: "verification", entityId: path, metadata: { expiresInSeconds } });
  return { ok: true, value: data.signedUrl };
}
