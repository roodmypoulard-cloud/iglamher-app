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

export default async function DiscoverPage() {
  const [categories, popular, favoritedIds, recommended] = await Promise.all([
    listCategories(),
    searchProfessionalViews({ sort: "rating" }),
    getFavoriteProfessionalIds(),
    getRecommendedForYou(4),
  ]);
  const favSet = new Set(favoritedIds);
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

        <SectionLabel label="Categories" seeAllHref="/search" />
        <CategoryTiles categories={gridCategories} />
        {bannerCategory && <CategoryBanner category={bannerCategory} />}

        {recommended.length > 0 && (
          <>
            <SectionLabel label="Recommended for you" />
            <div className="stagger space-y-3">
              {recommended.map((p) => (
                <ProfessionalCard key={p.userId} pro={p} favorited={favSet.has(p.userId)} variant="list" />
              ))}
            </div>
          </>
        )}

        <SectionLabel label="Popular near you" seeAllHref="/search?sort=rating" />
        {popular.length === 0 ? (
          <EmptyState
            title="No professionals yet"
            body="We're adding trusted beauty pros across LA every week — check back soon."
            action={{ label: "Browse categories", href: "/search" }}
          />
        ) : (
          <div className="stagger space-y-3">
            {popular.map((p) => (
              <ProfessionalCard key={p.userId} pro={p} favorited={favSet.has(p.userId)} variant="list" />
            ))}
          </div>
        )}
      </PullToRefresh>
    </Shell>
  );
}
