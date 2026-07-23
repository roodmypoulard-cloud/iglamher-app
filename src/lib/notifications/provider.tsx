"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AppNotification } from "./model";
import { fetchMyNotifications, markAllNotificationsReadAction, type RealNotification } from "./actions";

interface NotificationsCtx {
  notifications: AppNotification[];
  unreadCount: number;
  isRead: (id: string) => boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
  hydrated: boolean;
}

const Ctx = createContext<NotificationsCtx | null>(null);

/** Loads the current user's REAL notifications once on mount. Unread state is
 *  derived from the DB `read_at`, with optimistic local marking layered on top. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<RealNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchMyNotifications()
      .then((rows) => {
        if (!alive) return;
        setNotifications(rows);
        setReadIds(new Set(rows.filter((r) => r.read).map((r) => r.id)));
      })
      .catch(() => {
        /* leave empty on failure — no fake data */
      })
      .finally(() => {
        if (alive) setHydrated(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const markRead = useCallback((id: string) => {
    setReadIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  const markAllRead = useCallback(() => {
    // Optimistic: clear the badge immediately, then persist server-side.
    setReadIds(new Set(notifications.map((n) => n.id)));
    void markAllNotificationsReadAction();
  }, [notifications]);

  const value = useMemo<NotificationsCtx>(() => {
    const unreadCount = hydrated ? notifications.filter((n) => !readIds.has(n.id)).length : 0;
    return {
      notifications,
      unreadCount,
      isRead: (id) => readIds.has(id),
      markRead,
      markAllRead,
      hydrated,
    };
  }, [notifications, readIds, hydrated, markRead, markAllRead]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications(): NotificationsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
