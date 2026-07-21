import Image from "next/image";
import { SearchBar } from "./SearchBar";
import { SparkleIcon, CalendarIcon, HeartIcon } from "@/components/ui/icons";

const BADGES = [
  { Icon: SparkleIcon, label: "Trusted Pros" },
  { Icon: CalendarIcon, label: "Easy Booking" },
  { Icon: HeartIcon, label: "Real Reviews" },
] as const;

/**
 * Discover home hero — full-bleed cinematic beauty image blended into the dark
 * palette, luxury serif headline, rose-gold trust badges, and a glassmorphism
 * search bar as the primary CTA. Breaks out of the Shell's padded main.
 */
export function DiscoverHero() {
  return (
    <section className="relative -mx-5 -mt-4 md:-mx-8">
      <div className="relative overflow-hidden rounded-b-[40px]">
        {/* Cinematic background — layered radial gradients blend the model into the
            palette with a warm bloom and vignette; no hard edge sits on the UI. */}
        <div className="absolute inset-0">
          <div className="ken-burns absolute inset-0">
            <Image
              src="/brand/hero-discover.jpg"
              alt=""
              fill
              priority
              sizes="100vw"
              className="img-luxe object-cover object-[82%_top]"
            />
          </div>
          {/* Warm champagne bloom near the subject */}
          <div className="absolute inset-0 bg-[radial-gradient(52%_44%_at_74%_38%,rgba(231,201,146,0.12),transparent_72%)]" />
          {/* Left blend for headline legibility — clears the right side so she stays bright */}
          <div className="absolute inset-0 bg-[linear-gradient(100deg,#0B0909_5%,rgba(11,9,9,0.80)_27%,rgba(11,9,9,0.22)_50%,transparent_64%)]" />
          {/* Gentle bottom transition into the page — bottom portion only */}
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-bg via-bg/25 to-transparent" />
          {/* Whisper-soft vignette for depth (keeps the subject bright) */}
          <div className="absolute inset-0 bg-[radial-gradient(130%_106%_at_50%_36%,transparent_66%,rgba(11,9,9,0.30)_100%)]" />
          {/* Soft top scrim under the header */}
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-bg/80 to-transparent" />
        </div>

        {/* Curved transition under the header, traced with a rose-gold rim light */}
        <svg
          aria-hidden
          viewBox="0 0 390 42"
          preserveAspectRatio="none"
          className="absolute inset-x-0 top-0 z-[1] h-11 w-full"
        >
          <path d="M0 0 H390 V4 Q195 42 0 4 Z" fill="#0B0909" />
          <path d="M390 4 Q195 42 0 4" fill="none" stroke="url(#heroRim)" strokeWidth="1.6" />
          <defs>
            <linearGradient id="heroRim" x1="0" y1="0" x2="390" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#D7A08F" stopOpacity="0" />
              <stop offset="0.5" stopColor="#F0C0B4" stopOpacity="0.95" />
              <stop offset="1" stopColor="#D7A08F" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        {/* Rose-gold curved rim accent along the bottom transition */}
        <div aria-hidden className="absolute inset-x-10 bottom-[2px] h-px bg-gradient-to-r from-transparent via-rose/55 to-transparent" />

        <div className="relative px-5 pb-8 pt-9 md:px-8">
          <p className="fade-up-1 text-[12px] font-semibold uppercase tracking-[0.26em] text-rose-light/90">
            Find Your Perfect
          </p>
          <h1 className="fade-up-2 mt-3 font-display text-[46px] font-medium italic leading-[0.95] tracking-[-0.015em] text-ink [text-shadow:0_2px_20px_rgba(11,9,9,0.55)]">
            Beauty
            <br />
            Professional
          </h1>
          <p className="fade-up-3 mt-4 max-w-[72%] text-[13.5px] leading-[1.6] text-ink-secondary">
            Book trusted beauty experts for hair, makeup, lashes, nails, skincare and styling—
            <span className="font-display italic text-ink">wherever you are.</span>
          </p>
          <span aria-hidden className="fade-up-3 mt-5 block h-px w-28 bg-gradient-to-r from-rose to-transparent" />

          {/* Trust chips — frosted glass, thin rose-gold rim, lift + glow on interaction */}
          <div className="fade-up-4 mt-6 flex gap-2.5">
            {BADGES.map(({ Icon, label }) => (
              <span
                key={label}
                className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border border-rose/30 bg-white/[0.06] px-2 py-2.5 text-[11px] font-medium text-ink shadow-[0_2px_10px_rgba(0,0,0,0.22)] backdrop-blur-md transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-rose/55 hover:shadow-[0_10px_22px_rgba(215,160,143,0.24)] [will-change:transform]"
              >
                <Icon width={13} height={13} className="flex-none text-rose" />
                <span className="whitespace-nowrap">{label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Primary CTA — layered slightly over the hero base */}
      <div className="fade-up-5 relative z-10 -mt-5 px-5 md:px-8">
        <SearchBar variant="cta" placeholder="Search services or professionals…" />
      </div>
    </section>
  );
}
