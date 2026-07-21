"use client";
import { useEffect } from "react";
import { track, type AnalyticsEvent, type AnalyticsProps } from "@/lib/analytics";
import { recordProfessionalViewAction } from "@/lib/marketplace/favorites-actions";

/**
 * Fires a view analytics event once on mount. For professional views it also
 * records server-side recently-viewed (authed users) and persists a local
 * recently-viewed list for guests.
 */
export function TrackView({
  event,
  props = {},
  recordProfessionalId,
}: {
  event: AnalyticsEvent;
  props?: AnalyticsProps;
  recordProfessionalId?: string;
}) {
  useEffect(() => {
    track(event, props);
    if (recordProfessionalId) {
      void recordProfessionalViewAction(recordProfessionalId);
      persistLocalRecent(recordProfessionalId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function persistLocalRecent(id: string) {
  try {
    const key = "iglamher:recently-viewed";
    const prev = JSON.parse(localStorage.getItem(key) ?? "[]") as string[];
    const next = [id, ...prev.filter((x) => x !== id)].slice(0, 12);
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // ignore storage failures (private mode, etc.)
  }
}
