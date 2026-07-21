"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { MOCK_NOTIFICATIONS, type AppNotification } from "./model";

const STORAGE_KEY = "iglamher:notifications-read";

interface NotificationsCtx {
  notifications: AppNotification[];
  unreadCount: number;
  isRead: (id: string) => boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
  hydrated: boolean;
}

const Ctx = createContext<NotificationsCtx | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // One-time hydration of persisted read-state from localStorage.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setReadIds(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const persist = useCallback((next: Set<string>) => {
    setReadIds(new Set(next));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  }, []);

  const markRead = useCallback(
    (id: string) => {
      setReadIds((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev).add(id);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [],
  );

  const markAllRead = useCallback(() => {
    persist(new Set(MOCK_NOTIFICATIONS.map((n) => n.id)));
  }, [persist]);

  const value = useMemo<NotificationsCtx>(() => {
    const unreadCount = hydrated ? MOCK_NOTIFICATIONS.filter((n) => !readIds.has(n.id)).length : 0;
    return {
      notifications: MOCK_NOTIFICATIONS,
      unreadCount,
      isRead: (id) => readIds.has(id),
      markRead,
      markAllRead,
      hydrated,
    };
  }, [readIds, hydrated, markRead, markAllRead]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications(): NotificationsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
