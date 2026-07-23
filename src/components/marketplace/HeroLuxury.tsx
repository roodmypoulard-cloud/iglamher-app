"use client";
import { useState, useTransition, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";
import { addRecentSearch } from "@/lib/search/recent";
import styles from "./HeroLuxury.module.css";

function haptic() {
  try {
    navigator.vibrate?.(10);
  } catch {
    /* unsupported */
  }
}

export type HeroLuxuryProps = {
  /** High-resolution portrait with the subject on the right. */
  heroImageSrc?: string;
};

/**
 * Home hero — editorial copy, frosted trust chips, and a glassmorphism search
 * that routes into /search. The sticky topbar is rendered separately as
 * <DiscoverTopbar /> so it stays fixed while scrolling.
 */
export default function HeroLuxury({
  heroImageSrc = "/brand/hero-discover.jpg",
}: HeroLuxuryProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    addRecentSearch(trimmed);
    track("search_submitted", { hasQuery: trimmed.length > 0 });
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
  }

  // Navigate from a trust chip with haptic feedback + a per-chip loading state.
  function goFromChip(href: string, key: string) {
    if (isPending) return; // block duplicate taps mid-navigation
    haptic();
    setPendingKey(key);
    startTransition(() => router.push(href));
  }

  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.ambientGlow} aria-hidden="true" />
      <Image
        className={styles.heroImage}
        src={heroImageSrc}
        alt=""
        fill
        priority
        fetchPriority="high"
        // LCP element. The hero lives inside the Shell's constrained column
        // (max-w-[440px] mobile, ~768px md, ~1024px lg), so cap the requested
        // width here instead of letting sizes="100vw" pull the 3840px source.
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 768px, 1024px"
        quality={80}
      />
      <div className={styles.imageBlend} aria-hidden="true" />
      <svg className={styles.rim} viewBox="0 0 390 44" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 6 Q195 44 390 6" fill="none" stroke="url(#heroRim)" strokeWidth="1.5" />
        <defs>
          <linearGradient id="heroRim" x1="0" y1="0" x2="390" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#e3a28f" stopOpacity="0.12" />
            <stop offset="0.55" stopColor="#f4c1b4" stopOpacity="0.95" />
            <stop offset="1" stopColor="#f4c1b4" stopOpacity="0.5" />
          </linearGradient>
        </defs>
      </svg>

      <div className={styles.copy}>
        <p className={styles.eyebrow}>Find your perfect</p>
        <h1 id="hero-title" className={styles.title}>
          Beauty
          <br />
          Professional
        </h1>
        <p className={styles.description}>
          Book trusted beauty experts for{" "}
          <span className={styles.cats}>Hair, Makeup, Lashes, Nails</span> and{" "}
          <span className={styles.cats}>Styling</span>.
          <em> Wherever you are.</em>
        </p>
        <div className={styles.accentLine} aria-hidden="true" />
      </div>

      <div className={styles.trustRow} role="group" aria-label="Platform benefits">
        <Benefit
          icon="sparkle"
          label="Trusted Pros"
          pending={isPending && pendingKey === "verified"}
          onClick={() => goFromChip("/discover?verified=1", "verified")}
        />
        <Benefit
          icon="crown"
          label="Recommended"
          pending={isPending && pendingKey === "recommended"}
          onClick={() => goFromChip("/recommended", "recommended")}
        />
        <Benefit
          icon="heart"
          label="Real Reviews"
          pending={isPending && pendingKey === "reviews"}
          onClick={() => goFromChip("/reviews", "reviews")}
        />
      </div>

      <form className={styles.search} onSubmit={submitSearch} role="search">
        <svg className={styles.searchIcon} viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.7-3.7" />
        </svg>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search services or professionals..."
          aria-label="Search services or professionals"
        />
        <button type="submit" aria-label="Submit search">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14" />
            <path d="m13 6 6 6-6 6" />
          </svg>
        </button>
      </form>
    </section>
  );
}

function Benefit({
  icon,
  label,
  onClick,
  pending = false,
}: {
  icon: "sparkle" | "crown" | "heart";
  label: string;
  onClick: () => void;
  pending?: boolean;
}) {
  return (
    <button
      type="button"
      className={styles.benefit}
      onClick={onClick}
      aria-label={label}
      aria-busy={pending || undefined}
      disabled={pending}
    >
      {icon === "sparkle" && (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z" />
          <path d="m19 14 .7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14Z" />
        </svg>
      )}
      {icon === "crown" && (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 17h16l-1-7.5-3.6 2.8L12 6l-3.4 6.3L5 9.5 4 17Z" />
          <path d="M4 19.4h16" />
        </svg>
      )}
      {icon === "heart" && (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 20s-7-4.6-7-10a3.8 3.8 0 0 1 7-2.3A3.8 3.8 0 0 1 19 10c0 5.4-7 10-7 10Z" />
        </svg>
      )}
      <span>{label}</span>
    </button>
  );
}
