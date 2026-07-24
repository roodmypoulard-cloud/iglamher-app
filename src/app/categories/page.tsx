import type { Metadata } from "next";
import Link from "next/link";
import { Shell } from "@/components/marketplace/Shell";
import { BackButton } from "@/components/ui/BackButton";
import { SearchBar } from "@/components/marketplace/SearchBar";
import { CategoryTiles } from "@/components/marketplace/CategoryTiles";
import { ProShelf } from "@/components/marketplace/ProShelf";
import { LookbookCover } from "@/components/marketplace/LookbookCover";
import { EmptyState } from "@/components/ui/states";
import {
  listCategories, getRecommendedProfessionals, getFeaturedProfessionals, searchProfessionalViews,
} from "@/lib/data/professionals";
import { getFavoriteProfessionalIds } from "@/lib/data/favorites";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "The Lookbook · iGlamHer" };

const CrownIcon = () => (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="text-rose" aria-hidden>
    <path d="M4 17h16l-1-7.5-3.6 2.8L12 6l-3.4 6.3L5 9.5 4 17Z" /><path d="M4 19.4h16" />
  </svg>
);
const StarIcon = () => (
  <svg viewBox="0 0 24 24" width={15} height={15} fill="currentColor" className="text-gold" aria-hidden>
    <path d="m12 2 2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2l-6.1 3.4 1.4-6.8L2.2 9.1l6.9-.8L12 2Z" />
  </svg>
);

export default async function LookbookPage() {
  const [categories, recommended, featured, popular, favoritedIds] = await Promise.all([
    listCategories(),
    getRecommendedProfessionals({}, 10).then((r) => r.pros),
    getFeaturedProfessionals(6),
    searchProfessionalViews({ sort: "reviews" }).then((v) => v.slice(0, 12)),
    getFavoriteProfessionalIds(),
  ]);

  // Cover = the strongest single pro: first recommended, else top featured, else
  // most-reviewed. Everything downstream dedupes against whoever's on the cover.
  const cover = recommended[0] ?? featured[0] ?? popular[0] ?? null;

  const shownIds = new Set<string>(cover ? [cover.userId] : []);
  const recShelf = recommended.filter((p) => !shownIds.has(p.userId));
  recShelf.forEach((p) => shownIds.add(p.userId));
  const popularShelf = popular.filter((p) => !shownIds.has(p.userId)).slice(0, 8);

  return (
    <Shell>
      <div className="mb-3">
        <BackButton fallback="/bookings" label="Back" />
      </div>

      {/* Masthead — magazine, serif restraint */}
      <div className="flex items-baseline justify-between border-b border-gold/25 pb-2">
        <h1 className="font-display text-[26px] font-bold leading-none text-ink">The Lookbook</h1>
        <span className="text-[9.5px] font-semibold uppercase tracking-[0.24em] text-ink-muted">Beauty · Los Angeles</span>
      </div>
      <p className="mt-2 text-[12.5px] leading-snug text-ink-secondary">
        The month&apos;s finest looks and the artists behind them — book any of them in a tap.
      </p>

      <div className="mt-4">
        <SearchBar placeholder="Search a service, style, or artist…" />
      </div>

      {/* Cover story — full-bleed real pro photo */}
      {cover && (
        <div className="mt-5">
          <LookbookCover pro={cover} />
        </div>
      )}

      {/* Recommended shelf */}
      <ProShelf
        title="Recommended"
        subtitle="Hand-picked, approved by iGlamHer"
        icon={<CrownIcon />}
        pros={recShelf}
        favoritedIds={favoritedIds}
        seeAllHref="/recommended"
      />

      {/* Popular shelf */}
      <ProShelf
        title="Most booked"
        subtitle="The city&apos;s most-loved artists"
        icon={<StarIcon />}
        pros={popularShelf}
        favoritedIds={favoritedIds}
        seeAllHref="/search?sort=reviews"
      />

      {/* Browse by service — editorial framing over real category photography */}
      <section className="mt-9">
        <div className="mb-1 flex items-end justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose">The services</span>
          <Link href="/search" className="text-[12px] font-semibold text-rose hover:underline">All artists</Link>
        </div>
        <h2 className="mb-4 font-display text-[22px] font-semibold text-ink">Browse by craft</h2>
        {categories.length === 0 ? (
          <EmptyState
            title="No categories yet"
            body="We're curating our beauty categories — check back soon."
            action={{ label: "Back to home", href: "/discover" }}
          />
        ) : (
          <CategoryTiles categories={categories} />
        )}
      </section>
    </Shell>
  );
}
