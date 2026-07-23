"use server";
// Real notification feed backed by the `notifications` table (RLS: owner read +
// update). Replaces the old MOCK feed. Read/update run with the user's own session.
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";
import { withTimeout } from "@/lib/util/timeout";
import type { AppNotification, NotificationKind } from "./model";

export interface RealNotification extends AppNotification {
  read: boolean;
}

// notif_type enum: 'booking' | 'message' | 'review' | 'payout' | 'system' | 'promo'.
function mapKind(type: string): NotificationKind {
  if (type === "payout") return "system";
  if (type === "booking" || type === "message" || type === "review" || type === "promo" || type === "system") return type;
  return "system";
}

function deriveHref(type: string, data: Record<string, unknown>): string | undefined {
  if (typeof data.href === "string") return data.href;
  if (typeof data.bookingId === "string") return `/bookings/${data.bookingId}`;
  if (type === "message" && typeof data.conversationId === "string") return `/messages/${data.conversationId}`;
  return undefined;
}

/** The current user's notifications, newest first. Empty for anon / no Supabase. */
export async function fetchMyNotifications(limit = 40): Promise<RealNotification[]> {
  if (!isLiveSupabase()) return [];
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await withTimeout(supabase.auth.getUser(), 6000, "auth.getUser");
  if (!auth.user) return [];
  const { data, error } = await withTimeout(
    supabase
      .from("notifications")
      .select("id,type,title,body,data,read_at,created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(limit),
    6000,
    "notifications",
  );
  if (error || !data) return [];
  return (
    data as Array<{ id: string; type: string; title: string; body: string | null; data: Record<string, unknown> | null; read_at: string | null; created_at: string }>
  ).map((n) => ({
    id: n.id,
    kind: mapKind(n.type),
    title: n.title,
    body: n.body ?? "",
    href: deriveHref(n.type, n.data ?? {}),
    createdAt: n.created_at,
    read: n.read_at != null,
  }));
}

/** Mark every unread notification for the current user as read. */
export async function markAllNotificationsReadAction(): Promise<{ ok: boolean }> {
  if (!isLiveSupabase()) return { ok: true };
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false };
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", auth.user.id)
    .is("read_at", null);
  return { ok: !error };
}
