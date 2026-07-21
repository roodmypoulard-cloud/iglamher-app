"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/format";
import styles from "./HeroLuxury.module.css";

/**
 * Sticky top bar for the Discover screen — logo + notifications + profile.
 * Sits transparently over the hero at the top of the page and gains a soft
 * blurred background once the user scrolls, staying fixed the whole way down.
 */
export function DiscoverTopbar({ logoSrc = "/brand/logo-word.png" }: { logoSrc?: string }) {
  const [scrolled, setScrolled] = useState(false);

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

        <div className={styles.actions}>
          <Link href="/notifications" className={styles.iconButton} aria-label="Notifications">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M10 21h4" />
            </svg>
            <span className={styles.badge}>5</span>
          </Link>
          <Link href="/profile" className={styles.avatar} aria-label="Open profile">
            R
          </Link>
        </div>
      </header>
    </div>
  );
}
