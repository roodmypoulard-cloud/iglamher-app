import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Shell } from "@/components/marketplace/Shell";
import { SearchBar } from "@/components/marketplace/SearchBar";
import { LocationPill } from "@/components/marketplace/LocationPill";
import { BackButton } from "@/components/ui/BackButton";
import { MobileFilterSheet } from "@/components/marketplace/Filters";
import { CategoryCircleRail } from "@/components/marketplace/CategoryCircleRail";
import { RecommendsPanel } from "@/components/marketplace/RecommendsPanel";
import { VerifiedPopularTabs } from "@/components/marketplace/VerifiedPopularTabs";
import { LuxeProCard } from "@/components/marketplace/LuxeProCard";
import { TrendingStrip } from "@/components/marketplace/TrendingStrip";
import { EmptyState } from "@/components/ui/states";
import { listCategories, getRecommendedProfessionals, searchProfessionalViews } from "@/lib/data/professionals";
import { getFavoriteProfessionalIds, getRecentlyViewedProfessionals } from "@/lib/data/favorites";
import { isTopRated, isPopular } from "@/lib/marketplace/badges";
import { parseSearchParams } from "@/lib/marketplace/params";
import type { ProfessionalCardView } from "@/lib/data/model";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Book Your Glam · iGlamHer" };

type RawSearchParams = Record<string, string | string[] | undefined>;

function SectionHead({ title, subtitle, href, hrefLabel = "See All" }: { title: string; subtitle?: string; href?: string; hrefLabel?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-display text-[19px] font-bold leading-none text-ink">{title}</h2>
        {subtitle && <p className="mt-1 text-[12px] text-ink-muted">{subtitle}</p>}
      </div>
      {href && <Link href={href} className="flex-none text-[12.5px] font-semibold text-rose hover:underline">{hrefLabel}</Link>}
    </div>
  );
}

export default async function BookYourGlamPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const raw = await searchParams;
  const params = parseSearchParams(raw);

  const [categories, recommended, all, favoritedIds, recentlyViewed] = await Promise.all([
    listCategories(),
    getRecommendedProfessionals(params, 12).then((r) => r.pros),
    searchProfessionalViews({ ...params, sort: "recommended" }),
    getFavoriteProfessionalIds(),
    getRecentlyViewedProfessionals(6).catch(() => []),
  ]);

  // Build the four Verified & Popular tab lists from real signals.
  const byRating = [...all].sort((a, b) => b.ratingAverage - a.ratingAverage || b.reviewCount - a.reviewCount);
  const byReviews = [...all].sort((a, b) => b.reviewCount - a.reviewCount);
  const byDistance = [...all].sort((a, b) => (a.distanceMi ?? Infinity) - (b.distanceMi ?? Infinity));
  const lists: Record<"recommended" | "top_rated" | "popular" | "nearby", ProfessionalCardView[]> = {
    recommended: (recommended.length ? recommended : all).slice(0, 10),
    top_rated: byRating.filter(isTopRated).slice(0, 10),
    popular: byReviews.filter(isPopular).slice(0, 10),
    nearby: byDistance.slice(0, 10),
  };

  // Trending = most completed bookings (real "most-booked" signal).
  const trending = [...all].sort((a, b) => b.jobsCompleted - a.jobsCompleted).slice(0, 8);
  // Near You cards (portrait), distinct from the tab grid's default.
  const nearYou = byDistance.slice(0, 6);

  const activeCat = params.category ? categories.find((c) => c.slug === params.category)?.name : null;

  return (
    <Shell>
      {/* Back + working location pill (spec §2 — opens the search-area sheet;
          radius feeds the server queries via ?distance=) */}
      <div className="flex items-center justify-between gap-3">
        <BackButton fallback="/bookings" label="Back" className="!min-h-[36px] !border-0 !bg-transparent !px-0 !py-0 text-[13px] !backdrop-blur-none" />
        <Suspense>
          <LocationPill />
        </Suspense>
      </div>

      {/* Hero */}
      <header className="mt-4">
        <h1 className="font-display text-[34px] font-bold leading-[1.02] text-ink">Book Your Glam</h1>
        <p className="mt-1 text-[13.5px] text-ink-secondary">Luxury beauty, verified for you.</p>
      </header>

      {/* Search + filter */}
      <div className="mt-4 flex items-center gap-2.5">
        <div className="min-w-0 flex-1">
          <SearchBar basePath="/categories" placeholder="What service are you booking for?" />
        </div>
        <MobileFilterSheet />
      </div>

      {/* Circular category selector */}
      <div className="mt-4">
        <CategoryCircleRail categories={categories.map((c) => ({ slug: c.slug, name: c.name, imageUrl: c.imageUrl }))} />
      </div>

      {/* iGlamHer Recommends panel + shelf */}
      <div className="mt-5">
        <RecommendsPanel />
      </div>
      {recommended.length > 0 && (
        <div className="scrollbar-none -mx-5 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1">
          {recommended.slice(0, 8).map((p) => (
            <div key={p.userId} className="snap-start">
              <LuxeProCard pro={p} favorited={favoritedIds.includes(p.userId)} />
            </div>
          ))}
        </div>
      )}

      {/* Verified & Popular with tabs */}
      <section id="pros" className="mt-8 scroll-mt-4">
        <SectionHead title="Verified & Popular" subtitle={activeCat ? `Showing ${activeCat}` : "Professionals trusted and loved by clients."} href="/search" hrefLabel="See All" />
        <VerifiedPopularTabs lists={lists} favoritedIds={favoritedIds} />
      </section>

      {/* Trending This Week */}
      {trending.length > 0 && (
        <section className="mt-8">
          <SectionHead title="Trending This Week" subtitle="Most-booked professionals right now." href="/search?sort=reviews" />
          <TrendingStrip pros={trending} />
        </section>
      )}

      {/* Near You */}
      {nearYou.length > 0 && (
        <section className="mt-8">
          <SectionHead title="Near You" subtitle="Beauty professionals around Los Angeles." />
          <div className="scrollbar-none -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1">
            {nearYou.map((p) => (
              <div key={p.userId} className="snap-start">
                <LuxeProCard pro={p} favorited={favoritedIds.includes(p.userId)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recently viewed — only when the customer has history (spec §9) */}
      {recentlyViewed.length > 0 && (
        <section className="mt-8">
          <SectionHead title="Recently Viewed" subtitle="Pick up where you left off." />
          <div className="scrollbar-none -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1">
            {recentlyViewed.map((p) => (
              <div key={p.userId} className="snap-start">
                <LuxeProCard pro={p} favorited={favoritedIds.includes(p.userId)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {all.length === 0 && (
        <div className="mt-6">
          <EmptyState
            title="No exact match yet"
            body="Try adjusting your service, location, price, or availability filters."
            action={{ label: "Browse recommended", href: "/recommended" }}
          />
        </div>
      )}
    </Shell>
  );
}
