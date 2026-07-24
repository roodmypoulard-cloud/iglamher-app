import { Suspense } from "react";
import Link from "next/link";
import { Shell } from "@/components/marketplace/Shell";
import { SearchBar } from "@/components/marketplace/SearchBar";
import { MobileFilterSheet } from "@/components/marketplace/Filters";
import { CategoryRail } from "@/components/recommended/CategoryRail";
import { AreaControl } from "@/components/recommended/AreaControl";
import { RecommendedProCard } from "@/components/recommended/RecommendedProCard";
import { RecommendedTopbar } from "@/components/recommended/RecommendedTopbar";
import { GridSkeleton } from "@/components/ui/states";
import { getRecommendedProfessionals, listCategories } from "@/lib/data/professionals";
import { getFavoriteProfessionalIds } from "@/lib/data/favorites";
import { parseSearchParams } from "@/lib/marketplace/params";
import { nextOpeningLabel } from "@/lib/recommend/next-opening";
import { categoryLabelForSlug } from "@/lib/recommend/copy";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Find Your Glam · iGlamHer",
  description: "Discover trusted beauty professionals selected for quality, reliability, and client care.",
};

type RawSearchParams = Record<string, string | string[] | undefined>;

const PAGE_SIZE = 10;

async function Results({ raw }: { raw: RawSearchParams }) {
  const params = parseSearchParams(raw);
  const limitRaw = Number(typeof raw.limit === "string" ? raw.limit : PAGE_SIZE);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 60) : PAGE_SIZE;

  const [{ pros, total }, favoritedIds] = await Promise.all([
    getRecommendedProfessionals(params, limit),
    getFavoriteProfessionalIds(),
  ]);

  const hasQueryOrFilters = Boolean(
    params.q || params.minRating || params.minPriceCents || params.maxPriceCents ||
    params.verifiedOnly || params.instantOnly || (params.location && params.location !== "all") || params.distanceMi,
  );

  // Situation-specific empty states — never one generic message.
  if (total === 0) {
    const catLabel = params.category ? categoryLabelForSlug(params.category) : null;
    const clearQs = params.category ? `?category=${params.category}` : "";
    return (
      <div className="rounded-[20px] border border-border bg-surface px-6 py-12 text-center">
        {hasQueryOrFilters ? (
          <>
            <p className="font-display text-lg font-bold text-ink">No professionals match your search and filters.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2.5">
              <Link href={`/recommended${clearQs}`} className="flex min-h-[44px] items-center rounded-full rose-gradient px-5 text-[13px] font-bold text-[#2A1712]">
                Clear filters
              </Link>
              <Link href="/recommended" className="flex min-h-[44px] items-center rounded-full border border-border px-5 text-[13px] font-semibold text-ink-secondary hover:border-rose/50">
                Edit search
              </Link>
            </div>
          </>
        ) : catLabel ? (
          <>
            <p className="font-display text-lg font-bold text-ink">
              No recommended {catLabel.toLowerCase()} professionals are available in this area yet.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2.5">
              {params.distanceMi ? (
                <Link href={`/recommended?category=${params.category}`} className="flex min-h-[44px] items-center rounded-full rose-gradient px-5 text-[13px] font-bold text-[#2A1712]">
                  Expand search area
                </Link>
              ) : null}
              <Link href={`/search?category=${params.category}`} className="flex min-h-[44px] items-center rounded-full border border-rose/50 px-5 text-[13px] font-semibold text-rose hover:bg-rose/10">
                Browse all professionals
              </Link>
              <Link href="/recommended" className="flex min-h-[44px] items-center rounded-full border border-border px-5 text-[13px] font-semibold text-ink-secondary hover:border-rose/50">
                Choose another category
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="font-display text-lg font-bold text-ink">Recommendations are on the way</p>
            <p className="mx-auto mt-1.5 max-w-[36ch] text-[13px] leading-relaxed text-ink-secondary">
              We&apos;re approving our first recommended professionals now. Browse everyone on Discover in the meantime.
            </p>
            <Link href="/discover" className="mt-4 inline-flex min-h-[44px] items-center rounded-full rose-gradient px-5 text-[13px] font-bold text-[#2A1712]">
              Browse all professionals
            </Link>
          </>
        )}
      </div>
    );
  }

  const now = new Date();
  return (
    <>
      {/* No count/sort chrome above the list — the mock goes straight to cards. */}
      <div className="space-y-2.5">
        {pros.map((p) => (
          <RecommendedProCard key={p.userId} pro={p} favorited={favoritedIds.includes(p.userId)} nextOpening={nextOpeningLabel(p, now)} />
        ))}
      </div>
      {total > pros.length && (
        <div className="mt-4 text-center">
          <Link
            href={`/recommended?${new URLSearchParams({ ...Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === "string") as [string, string][]), limit: String(limit + PAGE_SIZE) }).toString()}`}
            scroll={false}
            className="inline-flex min-h-[44px] items-center rounded-full border border-rose/40 px-6 text-[13px] font-semibold text-rose transition-colors hover:bg-rose/10"
          >
            Show more ({total - pros.length} remaining)
          </Link>
        </div>
      )}
    </>
  );
}

export default async function RecommendedPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const raw = await searchParams;
  const q = typeof raw.q === "string" ? raw.q : "";
  const categories = await listCategories();

  return (
    <Shell header={false}>
      {/* One compact top bar (Back · brand · bell + menu) — matches the mock */}
      <RecommendedTopbar />

      {/* Header — serif, centered, editorial */}
      <div className="-mt-1 text-center">
        <h1 className="font-display text-[23px] font-bold leading-tight text-rose-light">Find Your Glam</h1>
        <p className="mx-auto mt-0.5 max-w-[48ch] text-[11px] leading-snug text-ink-secondary">
          Discover trusted beauty professionals selected for quality, reliability, and client care.
        </p>
      </div>

      {/* Info card — thin gold border like the mock */}
      <div className="mt-2.5 flex items-center gap-2 rounded-[12px] border border-gold/40 bg-gold/[0.05] px-3 py-1.5">
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="flex-none text-rose" aria-hidden>
          <path d="m12 3 2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 16.8 6.4 20l1.3-6.2L3 9.5l6.3-.7L12 3Z" />
        </svg>
        <p className="text-[10.5px] leading-snug text-ink-secondary">
          Choose the type of glam you need to see recommended professionals available near you.
        </p>
      </div>

      {/* Category selector */}
      <div className="mt-2.5">
        <Suspense>
          <CategoryRail categories={categories.map((c) => ({ slug: c.slug, name: c.name, imageUrl: c.imageUrl }))} />
        </Suspense>
      </div>

      {/* Search + filters */}
      <div className="mt-2 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <SearchBar initial={q} basePath="/recommended" placeholder="Search recommended professionals" />
        </div>
        <Suspense>
          {/* Same visual height + pill shape as the search field beside it. */}
          <MobileFilterSheet triggerClassName="inline-flex min-h-[56px] items-center gap-2 rounded-full border border-rose/40 bg-white/[0.05] px-4 text-sm font-semibold backdrop-blur-2xl" />
        </Suspense>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <Suspense>
          <AreaControl />
        </Suspense>
      </div>
      <div className="mt-3">
        <Suspense fallback={<GridSkeleton />}>
          <Results raw={raw} />
        </Suspense>
      </div>
    </Shell>
  );
}
