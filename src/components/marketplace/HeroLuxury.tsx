"use client";
import { useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";
import { addRecentSearch } from "@/lib/search/recent";
import styles from "./HeroLuxury.module.css";

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

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    addRecentSearch(trimmed);
    track("search_submitted", { hasQuery: trimmed.length > 0 });
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
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
        sizes="100vw"
        quality={82}
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

      <div className={styles.trustRow} aria-label="Platform benefits">
        <Benefit icon="sparkle" label="Trusted Pros" />
        <Benefit icon="calendar" label="Easy Booking" />
        <Benefit icon="heart" label="Real Reviews" />
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

function Benefit({ icon, label }: { icon: "sparkle" | "calendar" | "heart"; label: string }) {
  return (
    <div className={styles.benefit}>
      {icon === "sparkle" && (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z" />
          <path d="m19 14 .7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14Z" />
        </svg>
      )}
      {icon === "calendar" && (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4M16 3v4M4 10h16" />
        </svg>
      )}
      {icon === "heart" && (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 20s-7-4.6-7-10a3.8 3.8 0 0 1 7-2.3A3.8 3.8 0 0 1 19 10c0 5.4-7 10-7 10Z" />
        </svg>
      )}
      <span>{label}</span>
    </div>
  );
}
