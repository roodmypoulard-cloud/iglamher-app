import "server-only";
// Platform runtime settings — the operational kill-switches. Read from
// platform_settings (cached briefly) so admin can pause bookings/payments or
// enter maintenance without a redeploy. Safe defaults (everything ON) when the
// backend isn't connected.
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";
import { appCache, getOrSet } from "@/lib/cache";

export interface MaintenanceSetting { enabled: boolean; message?: string }
export interface ToggleSetting { enabled: boolean }
export interface BetaSetting { enabled: boolean; invite_only: boolean; capacity: number | null }

async function readSettings(): Promise<Record<string, unknown>> {
  if (!isLiveSupabase()) return {};
  return getOrSet(appCache, "platform:settings", 15_000, async () => {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from("platform_settings").select("key, value");
    const map: Record<string, unknown> = {};
    for (const row of (data as unknown as Array<{ key: string; value: unknown }>) ?? []) map[row.key] = row.value;
    return map;
  });
}

export async function isMaintenanceMode(): Promise<MaintenanceSetting> {
  const s = (await readSettings()).maintenance_mode as MaintenanceSetting | undefined;
  return { enabled: Boolean(s?.enabled), message: s?.message };
}
export async function isBookingsPaused(): Promise<boolean> {
  return Boolean((((await readSettings()).bookings_paused) as ToggleSetting | undefined)?.enabled);
}
export async function isPaymentsPaused(): Promise<boolean> {
  return Boolean((((await readSettings()).payments_paused) as ToggleSetting | undefined)?.enabled);
}
export async function getBetaConfig(): Promise<BetaSetting> {
  const s = (await readSettings()).beta as BetaSetting | undefined;
  return { enabled: Boolean(s?.enabled), invite_only: Boolean(s?.invite_only), capacity: s?.capacity ?? null };
}
