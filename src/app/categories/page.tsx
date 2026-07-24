import type { Metadata } from "next";
import Link from "next/link";
import { Shell } from "@/components/marketplace/Shell";
import { BackButton } from "@/components/ui/BackButton";
import { SearchBar } from "@/components/marketplace/SearchBar";
import { CategoryTiles } from "@/components/marketplace/CategoryTiles";
import { ProShelf } from "@/components/marketplace/ProShelf";
import { EmptyState } from "@/components/ui/states";
import {
  listCategories, getRecommendedProfessionals, searchProfessionalViews,
} from "@/lib/data/professionals";
import { getFavoriteProfessionalIds } from "@/lib/data/favorites";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New booking · iGlamHer" };

const CrownIcon = () => (
  <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="text-rose" aria-hidden>
    <path d="M4 17h16l-1-7.5-3.6 2.8L12 6l-3.4 6.3L5 9.5 4 17Z" /><path d="M4 19.4h16" />
  </svg>
);
const FireIcon = () => (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="text-rose" aria-hidden>
    <path d="M12 3s5 3.5 5 8a5 5 0 0 1-10 0c0-1.2.5-2.3 1-3 .2 1 .8 1.8 1.7 2 .5-2.4-.2-4.8 2.3-7Z" />
  </svg>
);

export default async function NewBookingPage() {
  const [categories, recommended, popular, favoritedIds] = await Promise.all([
    listCategories(),
    getRecommendedProfessionals({}, 10).then((r) => r.pros),
    searchProfessionalViews({ sort: "reviews" }).then((v) => v.slice(0, 10)),
    getFavoriteProfessionalIds(),
  ]);

  // Popular = most-reviewed, minus anyone already shown in Recommended (no repeats).
  const recIds = new Set(recommended.map((p) => p.userId));
  const popularUnique = popular.filter((p) => !recIds.has(p.userId)).slice(0, 8);

  return (
    <Shell>
      <div className="mb-4">
        <BackButton fallback="/bookings" label="Back" />
      </div>

      <header className="text-center">
        <h1 className="font-display text-[30px] font-bold leading-tight text-rose-light">Book your glam</h1>
        <p className="mx-auto mt-1 max-w-[42ch] text-[13px] leading-snug text-ink-secondary">
          Pick a service, or jump straight to a recommended or popular pro near you.
        </p>
      </header>

      <div className="mt-4">
        <SearchBar placeholder="Search a service, style, or pro…" />
      </div>

      {/* Recommended — admin-approved, real availability */}
      <ProShelf
        title="Recommended"
        subtitle="Hand-picked, approved by iGlamHer"
        icon={<CrownIcon />}
        pros={recommended}
        favoritedIds={favoritedIds}
        seeAllHref="/recommended"
      />

      {/* Popular — most reviewed across the marketplace */}
      <ProShelf
        title="Popular near you"
        subtitle="Most-loved pros by review count"
        icon={<FireIcon />}
        pros={popularUnique}
        favoritedIds={favoritedIds}
        seeAllHref="/search?sort=reviews"
      />

      {/* Browse every category */}
      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-[19px] font-bold text-ink">Browse by service</h2>
          <Link href="/search" className="text-[12.5px] font-semibold text-rose hover:underline">All pros</Link>
        </div>
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
