"use client";
import Link from "next/link";
import { BellIcon } from "@/components/ui/icons";
import { useNotifications } from "@/lib/notifications/provider";

export function NotificationBell() {
  const { unreadCount } = useNotifications();
  return (
    <Link
      href="/notifications"
      aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
      className="relative text-ink-muted transition-colors duration-200 hover:text-ink"
    >
      <BellIcon />
      {unreadCount > 0 && (
        <span className="absolute -right-1.5 -top-1.5 grid h-[15px] min-w-[15px] place-items-center rounded-full rose-gradient px-[3px] text-[9px] font-bold text-[#2A1712]">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
