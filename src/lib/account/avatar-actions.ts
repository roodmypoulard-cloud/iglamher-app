"use server";
// Customer profile-photo upload.
// • Public `avatars` bucket (avatars are shown across the app, no signing needed).
// • Storage write goes through the service-role admin client; the profiles.avatar_url
//   update goes through the user's own client so RLS ("profiles self update") enforces
//   that a user can only change their own row.
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";

const AVATARS_BUCKET = "avatars";
const AVATAR_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const EXT: Record<(typeof AVATAR_MIMES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type AvatarResult = { ok: true; url: string } | { ok: false; error: string };

let bucketReady = false;
async function ensureBucket(admin: ReturnType<typeof createAdminClient>) {
  if (bucketReady) return;
  const { error } = await admin.storage.createBucket(AVATARS_BUCKET, {
    public: true,
    fileSizeLimit: AVATAR_MAX_BYTES,
    allowedMimeTypes: [...AVATAR_MIMES],
  });
  // "already exists" is success; only cache readiness when the bucket is really there,
  // so a transient failure doesn't permanently break uploads on this instance.
  if (!error || /exist/i.test(error.message)) bucketReady = true;
  else console.error("[avatar] createBucket failed", error.message);
}

export async function updateAvatarAction(formData: FormData): Promise<AvatarResult> {
  try {
    const file = formData.get("avatar");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No image selected." };
    if (!AVATAR_MIMES.includes(file.type as (typeof AVATAR_MIMES)[number])) {
      return { ok: false, error: "Unsupported image. Use JPEG, PNG, or WebP." };
    }
    if (file.size > AVATAR_MAX_BYTES) return { ok: false, error: "Image too large. Max 5 MB." };
    if (!isLiveSupabase()) return { ok: false, error: "Connect Supabase Storage to upload a photo." };

    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { ok: false, error: "Please sign in to update your photo." };

    const admin = createAdminClient();
    await ensureBucket(admin);

    const ext = EXT[file.type as (typeof AVATAR_MIMES)[number]];
    const path = `${auth.user.id}/avatar-${crypto.randomUUID()}.${ext}`;
    // Normalise the web File to bytes — supabase-js can throw on a raw File in the
    // Node server runtime (which would trip the page error boundary).
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: upErr } = await admin.storage.from(AVATARS_BUCKET).upload(path, bytes, {
      contentType: file.type || "image/jpeg",
      upsert: true,
    });
    if (upErr) {
      console.error("[avatar] storage upload failed", upErr.message);
      return { ok: false, error: "We couldn't upload that photo. Please try again." };
    }

    const { data: pub } = admin.storage.from(AVATARS_BUCKET).getPublicUrl(path);
    const url = pub.publicUrl;

    const { error: dbErr } = await supabase
      .from("profiles")
      .update({ avatar_url: url, updated_at: new Date().toISOString() })
      .eq("id", auth.user.id);
    if (dbErr) {
      console.error("[avatar] db update failed", dbErr.message);
      return { ok: false, error: "We couldn't save that photo. Please try again." };
    }

    revalidatePath("/profile");
    return { ok: true, url };
  } catch (e) {
    console.error("[avatar] unexpected error", e instanceof Error ? e.message : e);
    return { ok: false, error: "Something interrupted the upload. Please try again." };
  }
}
