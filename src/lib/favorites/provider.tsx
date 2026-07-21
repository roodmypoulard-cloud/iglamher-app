"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const STORAGE_KEY = "iglamher:favorites";

interface FavoritesCtx {
  ids: Set<string>;
  isFavorite: (id: string) => boolean;
  toggle: (id: string) => boolean; // returns the new favorited state
  hydrated: boolean;
}

const Ctx = createContext<FavoritesCtx | null>(null);

/**
 * Client favorites store. Persists to localStorage so saving works in seed mode
 * without a database; a live server list can seed the initial set. When a real
 * DB is connected the FavoriteButton also fires the server action.
 */
export function FavoritesProvider({
  initialIds = [],
  children,
}: {
  initialIds?: string[];
  children: ReactNode;
}) {
  const [ids, setIds] = useState<Set<string>>(new Set(initialIds));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const local = raw ? (JSON.parse(raw) as string[]) : [];
      // One-time hydration merging server-provided + locally-saved favorites.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIds(new Set([...initialIds, ...local]));
    } catch {
      /* ignore */
    }
    setHydrated(true);
    // initialIds is a server prop, stable per render tree
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = useCallback((id: string) => {
    let nowFavorited = false;
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        nowFavorited = false;
      } else {
        next.add(id);
        nowFavorited = true;
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
    return nowFavorited;
  }, []);

  const value = useMemo<FavoritesCtx>(
    () => ({ ids, isFavorite: (id) => ids.has(id), toggle, hydrated }),
    [ids, toggle, hydrated],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFavorites(): FavoritesCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}
