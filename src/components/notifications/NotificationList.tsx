"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { useNotifications } from "@/lib/notifications/provider";
import { NOTIFICATION_META, timeAgo } from "@/lib/notifications/model";
import { EmptyState, ListSkeleton } from "@/components/ui/states";
import { BellIcon } from "@/components/ui/icons";
import { cn } from "@/lib/format";

export function NotificationList() {
  const { notifications, isRead, markRead, markAllRead, unreadCount, hydrated } = useNotifications();

  // Mark everything read the first time the page is opened (once feed has loaded).
  const markedOnOpen = useRef(false);
  useEffect(() => {
    if (hydrated && !markedOnOpen.current && unreadCount > 0) {
      markedOnOpen.current = true;
      markAllRead();
    }
  }, [hydrated, unreadCount, markAllRead]);

  if (!hydrated) return <ListSkeleton count={4} />;

  if (notifications.length === 0) {
    return <EmptyState icon={<BellIcon width={26} height={26} />} title="You're all caught up" body="Notifications about bookings, messages and offers will appear here." action={{ label: "Discover", href: "/discover" }} />;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink-muted">{unreadCount > 0 ? `${unreadCount} unread` : "All read"}</p>
        {unreadCount > 0 && (
          <button type="button" onClick={markAllRead} className="text-sm font-semibold text-rose hover:underline">
            Mark all read
          </button>
        )}
      </div>
      <ul className="stagger space-y-2.5">
        {notifications.map((n) => {
          const meta = NOTIFICATION_META[n.kind];
          const read = isRead(n.id);
          return (
            <li key={n.id}>
              <Link
                href={n.href ?? "/notifications"}
                onClick={() => markRead(n.id)}
                className={cn(
                  "flex gap-3 rounded-[16px] border p-4 transition-colors",
                  read ? "border-border bg-surface" : "border-rose/30 bg-rose/[0.06]",
                )}
              >
                <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-bg-elevated text-lg" aria-hidden>
                  {meta.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-semibold text-ink">{n.title}</p>
                    <span className="flex-none text-[11px] text-ink-muted">{timeAgo(n.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-ink-secondary">{n.body}</p>
                  <span className={cn("mt-1.5 inline-block text-[10px] font-semibold uppercase tracking-wide", meta.tone)}>
                    {meta.label}
                  </span>
                </div>
                {!read && <span className="mt-1 h-2 w-2 flex-none rounded-full bg-rose" aria-label="Unread" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
