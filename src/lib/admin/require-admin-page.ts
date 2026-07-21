import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";

/** Page-level admin gate. Returns { isDemo } or redirects. */
export async function requireAdminPage(nextPath: string): Promise<{ isDemo: boolean }> {
  if (!isLiveSupabase()) return { isDemo: true };
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/signin?next=${nextPath}`);
  const { data } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if ((data as { role?: string } | null)?.role !== "admin") redirect("/discover");
  return { isDemo: false };
}
