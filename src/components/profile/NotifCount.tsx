"use client";
import { useNotifications } from "@/lib/notifications/provider";

/** Live subtitle for the Notifications tile — "N new" or "Up to date". Renders a
 *  neutral placeholder until hydrated so there's no layout shift and no fake count. */
export function NotifCount() {
  const { unreadCount, hydrated } = useNotifications();
  const text = !hydrated ? "Notifications" : unreadCount > 0 ? `${unreadCount} new` : "Up to date";
  return <span className="text-[11.5px] text-ink-muted">{text}</span>;
}
