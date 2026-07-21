"use server";
// Native push registration. The mobile app (Capacitor) registers its APNs/FCM
// token here after the user grants permission; the web PWA registers its Web
// Push subscription endpoint the same way. Tokens drive dispatchNotification().
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";

export type PushResult = { ok: true } | { ok: false; error: string };

const schema = z.object({
  token: z.string().min(8).max(4096),
  platform: z.enum(["ios", "android", "web"]),
  deviceName: z.string().max(120).optional(),
});

export async function registerDeviceTokenAction(raw: unknown): Promise<PushResult> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid device token." };
  if (!isLiveSupabase()) return { ok: false, error: "Connect the backend to register for push." };

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Please sign in." };

  const { error } = await supabase.from("device_tokens").upsert(
    {
      user_id: auth.user.id,
      token: parsed.data.token,
      platform: parsed.data.platform,
      device_name: parsed.data.deviceName ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "user_id,token" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removeDeviceTokenAction(token: string): Promise<PushResult> {
  if (!isLiveSupabase()) return { ok: false, error: "Not connected." };
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Please sign in." };
  await supabase.from("device_tokens").delete().eq("user_id", auth.user.id).eq("token", token);
  return { ok: true };
}
