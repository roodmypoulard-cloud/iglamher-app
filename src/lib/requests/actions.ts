"use server";
// Customer Job Marketplace actions: create/cancel a job request and upload
// inspiration photos. All table writes run with the user's own session so RLS +
// the 0027 column guard enforce ownership and status transitions. Photos go to
// the PUBLIC portfolio bucket under job-requests/{uid}/ via the admin client
// (same idiom as avatar upload — storage write is privileged, DB row is not).
import { revalidatePath } from "next/cache";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";
import { magicBytesMatch } from "@/lib/pro/application";
import {
  createJobRequestSchema, INSPO_MAX_BYTES, INSPO_MIMES, MAX_INSPO_PHOTOS,
  type CreateJobRequestInput, type JobPhoto,
} from "./schema";

const BUCKET = "portfolio";
const INSPO_PREFIX = "job-requests";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function gate(): Promise<{ error: string } | { supabase: ServerClient; user: User }> {
  if (!isLiveSupabase()) return { error: "Job requests need a connected account. Please try again later." };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Please sign in to post a request." };
  return { supabase, user: data.user };
}

/** Upload one inspiration photo; returns its storage path + public URL. */
export async function uploadInspoPhotoAction(formData: FormData): Promise<ActionResult<JobPhoto>> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No photo selected." };
  if (!INSPO_MIMES.includes(file.type as (typeof INSPO_MIMES)[number])) {
    return { ok: false, error: "Only JPG, PNG, or WebP photos are allowed." };
  }
  if (file.size > INSPO_MAX_BYTES) return { ok: false, error: "Photo too large (max 8 MB)." };
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!magicBytesMatch(file.type, head)) return { ok: false, error: "That file's contents don't match its type." };

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${INSPO_PREFIX}/${g.user.id}/${crypto.randomUUID()}.${ext}`;

  const admin = createAdminClient();
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { ok: false, error: "Upload failed — please try again." };
  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  return { ok: true, data: { path, url: pub.publicUrl } };
}

export async function createJobRequestAction(input: CreateJobRequestInput): Promise<ActionResult<{ id: string }>> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };

  const parsed = createJobRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your request details." };
  }
  const v = parsed.data;

  // A user may only reference photos they uploaded (path is namespaced by uid).
  if (v.photos.some((p) => !p.path.startsWith(`${INSPO_PREFIX}/${g.user.id}/`))) {
    return { ok: false, error: "Invalid photo reference." };
  }
  if (v.photos.length > MAX_INSPO_PHOTOS) return { ok: false, error: `At most ${MAX_INSPO_PHOTOS} photos.` };

  // No dates in the past (compare in UTC date-space; a same-day request is fine).
  if (v.preferredDate && v.preferredDate < new Date().toISOString().slice(0, 10)) {
    return { ok: false, error: "Pick today or a future date." };
  }

  const { data: row, error } = await g.supabase
    .from("job_requests")
    .insert({
      customer_id: g.user.id,
      category: v.category,
      title: v.title,
      description: v.description,
      photos: v.photos,
      preferred_date: v.preferredDate,
      time_window: v.timeWindow,
      location_text: v.locationText,
      is_house_call: v.isHouseCall,
      budget_cents: v.budgetDollars == null ? null : v.budgetDollars * 100,
    })
    .select("id")
    .maybeSingle();

  if (error || !row) return { ok: false, error: "Couldn't post your request — please try again." };

  revalidatePath("/requests");
  return { ok: true, data: { id: row.id } };
}

export async function cancelJobRequestAction(id: string): Promise<ActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };

  // Verify-back like switchModeAction: a no-op update (wrong id / RLS-invisible
  // row / guard rejection) must surface, not silently succeed.
  const { data: row, error } = await g.supabase
    .from("job_requests")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("customer_id", g.user.id)
    .select("status")
    .maybeSingle();

  if (error || !row || row.status !== "cancelled") {
    return { ok: false, error: "Couldn't cancel this request." };
  }

  revalidatePath("/requests");
  revalidatePath(`/requests/${id}`);
  return { ok: true };
}
