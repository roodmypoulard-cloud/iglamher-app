"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/format";
import { useNotifications } from "@/lib/notifications/provider";
import { DesktopNav } from "./DesktopNav";
import styles from "./HeroLuxury.module.css";

/**
 * Sticky top bar for the Discover screen — logo + notifications + profile.
 * Sits transparently over the hero at the top of the page and gains a soft
 * blurred background once the user scrolls, staying fixed the whole way down.
 */
export function DiscoverTopbar({ logoSrc = "/brand/logo-word.png" }: { logoSrc?: string }) {
  const [scrolled, setScrolled] = useState(false);
  const { unreadCount } = useNotifications();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={cn(styles.stickybar, scrolled && styles.stickybarSolid)}>
      <header className={styles.topbar}>
        <Link href="/discover" className={styles.logoWrap} aria-label="iGlamHer home">
          <div className={styles.logoGlow} aria-hidden="true" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.logo} src={logoSrc} alt="iGlamHer" />
          <span className={styles.tagline}>Beauty on Demand</span>
        </Link>

        <DesktopNav className="ml-auto mr-4" />
        <div className={styles.actions}>
          <Link
            href="/notifications"
            className={styles.iconButton}
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M10 21h4" />
            </svg>
            {unreadCount > 0 && <span className={styles.badge}>{unreadCount > 9 ? "9+" : unreadCount}</span>}
          </Link>
          {/* Account & settings entry — rose-gold menu; profile lives on the bottom-nav Profile tab. */}
          <Link
            href="/profile/settings"
            aria-label="Account settings menu"
            className="menu-gold grid h-[34px] w-[34px] flex-none place-items-center rounded-full border border-rose/30 bg-surface/60"
          >
            <span aria-hidden className="flex w-[16px] flex-col gap-[4px]">
              <span className="menu-gold-bar" />
              <span className="menu-gold-bar" />
              <span className="menu-gold-bar" />
            </span>
          </Link>
        </div>
      </header>
    </div>
  );
}
