import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminPage } from "@/lib/admin/require-admin-page";
import { getApplicationCounts } from "@/lib/admin/verification-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";

export const dynamic = "force-dynamic";

/** Admin chrome: fixed luxury sidebar + top header around every admin page.
 *  Auth lives here AND on each page (defense in depth — pages keep their own
 *  requireAdminPage gates). */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdminPage("/admin");

  let adminName = "Admin";
  let adminAvatarUrl: string | null = null;
  if (isLiveSupabase()) {
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      const { data: p } = await supabase
        .from("profiles")
        .select("first_name, last_name, avatar_url")
        .eq("id", auth.user.id)
        .maybeSingle();
      const name = `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim();
      if (name) adminName = name;
      adminAvatarUrl = p?.avatar_url ?? null;
    }
  }

  const counts = await getApplicationCounts();

  return (
    <AdminShell adminName={adminName} adminAvatarUrl={adminAvatarUrl} pendingCount={counts.awaiting}>
      {children}
    </AdminShell>
  );
}
