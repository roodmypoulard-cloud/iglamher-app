import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";
import { Shell } from "@/components/marketplace/Shell";
import { NotificationList } from "@/components/notifications/NotificationList";

export const metadata = { title: "Notifications · iGlamHer" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  if (isLiveSupabase()) {
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) redirect("/signin?next=/notifications");
  }
  return (
    <Shell>
      <h1 className="mb-1 font-display text-3xl font-bold leading-tight">Notifications</h1>
      <p className="mb-6 text-sm text-ink-muted">Bookings, messages and offers.</p>
      <NotificationList />
    </Shell>
  );
}
