import Link from "next/link";
import { Shell, SectionLabel } from "@/components/marketplace/Shell";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import HeroLuxury from "@/components/marketplace/HeroLuxury";
import { DiscoverTopbar } from "@/components/marketplace/DiscoverTopbar";
import { CategoryTiles } from "@/components/marketplace/CategoryTiles";
import { CategoryBanner } from "@/components/marketplace/CategoryBanner";
import { ProfessionalCard } from "@/components/marketplace/ProfessionalCard";
import { EmptyState } from "@/components/ui/states";
import { listCategories, searchProfessionalViews } from "@/lib/data/professionals";
import { getFavoriteProfessionalIds } from "@/lib/data/favorites";
import { getRecommendedForYou } from "@/lib/recommend/data";

export const dynamic = "force-dynamic";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string }>;
}) {
  const { verified } = await searchParams;
  // "Trusted Pros" chip → /discover?verified=1 → show only verified providers.
  const verifiedOnly = verified === "1" || verified === "true";

  // Each fetch degrades to an empty list on failure (mirrors /explore) so one flaky
  // query — e.g. personalized recommendations for a signed-in user — can't 500 the page.
  const [categories, popularAll, favoritedIds, recommendedAll] = await Promise.all([
    listCategories().catch(() => []),
    searchProfessionalViews({ sort: "rating", ...(verifiedOnly ? { verifiedOnly: true } : {}) }).catch(() => []),
    getFavoriteProfessionalIds().catch(() => []),
    getRecommendedForYou(4).catch(() => []),
  ]);
  const favSet = new Set(favoritedIds);
  const recommended = verifiedOnly ? recommendedAll.filter((p) => p.isVerified) : recommendedAll;
  // A pro shown in "Recommended for you" must not also appear in "Popular near
  // you" — otherwise top-rated pros render twice on the page.
  const recommendedIds = new Set(recommended.map((p) => p.userId));
  const popular = popularAll.filter((p) => !recommendedIds.has(p.userId));
  // 2×2 grid of four core categories (Hair, Makeup, Nails, Stylist);
  // Lashes is featured as a full-width close-up banner beneath them.
  const gridCategories = categories.filter((c) => c.slug !== "lashes").slice(0, 4);
  const bannerCategory = categories.find((c) => c.slug === "lashes");

  return (
    <Shell header={false}>
      <PullToRefresh>
        <DiscoverTopbar />
        <div className="-mx-5 mb-2 md:-mx-8">
          <HeroLuxury />
        </div>

        {verifiedOnly && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-[14px] border border-success/40 bg-success/10 px-4 py-2.5">
            <span className="flex items-center gap-2 text-sm font-semibold text-success">
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden>
                <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Verified professionals only
            </span>
            <Link href="/discover" className="min-h-[44px] shrink-0 self-center py-2.5 text-sm font-semibold text-rose hover:underline">
              Clear
            </Link>
          </div>
        )}

        <SectionLabel label="Categories" seeAllHref="/categories" />
        <CategoryTiles categories={gridCategories} />
        {bannerCategory && <CategoryBanner category={bannerCategory} />}

        {recommended.length > 0 && (
          <>
            <SectionLabel label="Recommended for you" />
            <div className="stagger grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {recommended.map((p) => (
                <ProfessionalCard key={p.userId} pro={p} favorited={favSet.has(p.userId)} variant="list" />
              ))}
            </div>
          </>
        )}

        <SectionLabel label={verifiedOnly ? "Verified professionals" : "Popular near you"} seeAllHref="/search?sort=rating" />
        {popular.length === 0 ? (
          <EmptyState
            title="No professionals yet"
            body="We're adding trusted beauty pros across LA every week — check back soon."
            action={{ label: "Browse categories", href: "/search" }}
          />
        ) : (
          <div className="stagger grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {popular.map((p) => (
              <ProfessionalCard key={p.userId} pro={p} favorited={favSet.has(p.userId)} variant="list" />
            ))}
          </div>
        )}
      </PullToRefresh>
    </Shell>
  );
}
