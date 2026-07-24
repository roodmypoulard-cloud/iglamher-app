import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";
import { isGateConfigured, isGateUnlocked } from "@/lib/admin/gate";

/** Role-only admin gate (no passcode). Used by the unlock page itself, which
 *  must be reachable while the passcode gate is still locked. */
export async function requireAdminRole(nextPath: string): Promise<{ isDemo: boolean; userId: string | null }> {
  if (!isLiveSupabase()) return { isDemo: true, userId: null };
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/signin?next=${nextPath}`);
  const { data } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if ((data as { role?: string } | null)?.role !== "admin") redirect("/discover");
  return { isDemo: false, userId: auth.user.id };
}

/** Full admin gate: role + passcode. Redirects to the unlock screen when a
 *  passcode is configured and this session hasn't entered it yet. */
export async function requireAdminPage(nextPath: string): Promise<{ isDemo: boolean }> {
  const { isDemo, userId } = await requireAdminRole(nextPath);
  if (isDemo || !userId) return { isDemo };

  // Second factor: passcode. If the admin hasn't set one, access is allowed
  // (never lock them out) — Settings prompts them to add one.
  if ((await isGateConfigured()) && !(await isGateUnlocked(userId))) {
    redirect(`/admin-unlock?next=${encodeURIComponent(nextPath)}`);
  }
  return { isDemo };
}
