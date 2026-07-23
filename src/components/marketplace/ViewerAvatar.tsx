"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { getViewerIdentityAction, type ViewerIdentity } from "@/lib/profile/identity";

/**
 * Header avatar that links to the profile. Fetches the real viewer identity
 * (name + uploaded photo) on mount — client-side so it never blocks the server
 * render or the route loading skeleton. Until it resolves, Avatar shows the
 * gold-ring placeholder; on photo error Avatar falls back to initials itself.
 */
export function ViewerAvatar({ size = 32, className }: { size?: number; className?: string }) {
  const [identity, setIdentity] = useState<ViewerIdentity | null>(null);

  useEffect(() => {
    let alive = true;
    getViewerIdentityAction()
      .then((id) => alive && setIdentity(id))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Link
      href="/profile"
      aria-label={identity ? `${identity.name} — open profile` : "Open your profile"}
      className={`grid min-h-[44px] min-w-[44px] place-items-center rounded-full transition-transform duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 ${className ?? ""}`}
    >
      <Avatar name={identity?.name} src={identity?.avatarUrl} size={size} priority />
    </Link>
  );
}
