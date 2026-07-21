"use server";
// Admin operational controls. Admin-gated, service-role writes, audit-logged.
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";
import { writeAudit } from "@/lib/audit/log";
import { appCache } from "@/lib/cache";

export type OpsResult = { ok: true } | { ok: false; error: string };

const ALLOWED_KEYS = new Set(["maintenance_mode", "bookings_paused", "payments_paused", "beta"]);

export async function setPlatformSettingAction(key: string, value: Record<string, unknown>): Promise<OpsResult> {
  if (!ALLOWED_KEYS.has(key)) return { ok: false, error: "Unknown setting." };
  if (!isLiveSupabase()) return { ok: false, error: "Connect the backend." };
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Sign in required." };
  const { data } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if ((data as { role?: string } | null)?.role !== "admin") return { ok: false, error: "Admin only." };

  const admin = createAdminClient();
  const { error } = await admin.from("platform_settings").upsert(
    { key, value, updated_by: auth.user.id, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
  if (error) return { ok: false, error: error.message };

  appCache.delete("platform:settings"); // bust the 15s cache immediately
  await writeAudit({ actorId: auth.user.id, action: `platform.setting.${key}`, entity: "platform_settings", entityId: key, metadata: value });
  revalidatePath("/admin");
  return { ok: true };
}
