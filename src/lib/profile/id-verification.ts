"use server";
// Customer identity verification (KYC-lite). The customer uploads a government
// ID to the PRIVATE verification-docs bucket under their own {uid}/customer-id/
// folder (storage RLS from 0023 scopes owners to their folder) and the row
// moves unsubmitted|rejected -> pending. The verdict (is_id_verified /
// approved / rejected) is admin-only — enforced server-side AND by the 0028
// column guards, so a direct PostgREST PATCH cannot self-verify.
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";
import {
  DOC_MIME_TYPES,
  DOC_EXT,
  DOC_MAX_BYTES,
  magicBytesMatch,
  type DocMime,
} from "@/lib/pro/application";

const BUCKET = "verification-docs";

export type IdVerificationStatus = "unsubmitted" | "pending" | "approved" | "rejected";
export type IdVerificationState = {
  status: IdVerificationStatus;
  isVerified: boolean;
  hasDocument: boolean;
};

export async function getMyIdVerificationAction(): Promise<IdVerificationState | null> {
  if (!isLiveSupabase()) return null;
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data } = await supabase
    .from("customer_profiles")
    .select("is_id_verified, verification_status, id_document_url")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  const row = data as { is_id_verified: boolean | null; verification_status: string | null; id_document_url: string | null } | null;
  return {
    status: (row?.verification_status ?? "unsubmitted") as IdVerificationStatus,
    isVerified: Boolean(row?.is_id_verified),
    hasDocument: Boolean(row?.id_document_url),
  };
}

export async function uploadIdDocumentAction(
  formData: FormData,
): Promise<{ ok: true; state: IdVerificationState } | { ok: false; error: string }> {
  if (!isLiveSupabase()) return { ok: false, error: "Verification is unavailable right now." };
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Please sign in first." };
  const userId = auth.user.id;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No file selected." };
  if (!DOC_MIME_TYPES.includes(file.type as DocMime)) {
    return { ok: false, error: "Only PDF, JPG, JPEG, or PNG files are allowed." };
  }
  if (file.size > DOC_MAX_BYTES) return { ok: false, error: "File too large (max 10 MB)." };
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!magicBytesMatch(file.type, head)) {
    return { ok: false, error: "That file's contents don't match its type." };
  }

  // Already approved or under review — nothing to upload.
  const current = await getMyIdVerificationAction();
  if (current?.status === "approved") return { ok: false, error: "Your identity is already verified." };
  if (current?.status === "pending") return { ok: false, error: "Your ID is already under review." };

  const ext = DOC_EXT[file.type as DocMime];
  const path = `${userId}/customer-id/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { ok: false, error: upErr.message };

  // unsubmitted|rejected -> pending is the one transition the 0028 guard allows.
  const { data: row, error } = await supabase
    .from("customer_profiles")
    .upsert(
      { user_id: userId, id_document_url: path, verification_status: "pending" },
      { onConflict: "user_id" },
    )
    .select("verification_status")
    .maybeSingle();
  if (error || !row) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { ok: false, error: error?.message ?? "Couldn't submit your ID. Please try again." };
  }

  revalidatePath("/profile/settings");
  revalidatePath("/profile");
  return { ok: true, state: { status: "pending", isVerified: false, hasDocument: true } };
}
