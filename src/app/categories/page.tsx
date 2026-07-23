import type { Metadata } from "next";
import { Shell } from "@/components/marketplace/Shell";
import { BackButton } from "@/components/ui/BackButton";
import { CategoryTiles } from "@/components/marketplace/CategoryTiles";
import { EmptyState } from "@/components/ui/states";
import { listCategories } from "@/lib/data/professionals";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Categories · iGlamHer" };

export default async function CategoriesPage() {
  const categories = await listCategories();

  return (
    <Shell>
      <div className="mb-5">
        <BackButton fallback="/discover" label="Home" />
      </div>

      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold">Categories</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Browse every beauty service — find the perfect pro for your look.
        </p>
      </header>

      {categories.length === 0 ? (
        <EmptyState
          title="No categories yet"
          body="We're curating our beauty categories — check back soon."
          action={{ label: "Back to home", href: "/discover" }}
        />
      ) : (
        <CategoryTiles categories={categories} />
      )}
    </Shell>
  );
}
