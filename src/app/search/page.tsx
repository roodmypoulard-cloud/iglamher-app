import { Suspense } from "react";
import { Shell } from "@/components/marketplace/Shell";
import { SearchBar } from "@/components/marketplace/SearchBar";
import { FiltersSidebar, MobileFilterSheet, SortSelect } from "@/components/marketplace/Filters";
import { ProfessionalGrid } from "@/components/marketplace/ProfessionalGrid";
import { GridSkeleton } from "@/components/ui/states";
import { searchProfessionalViews } from "@/lib/data/professionals";
import { getFavoriteProfessionalIds } from "@/lib/data/favorites";
import { parseSearchParams } from "@/lib/marketplace/params";
import { parseNaturalQuery } from "@/lib/search/parse";

export const dynamic = "force-dynamic";

type RawSearchParams = Record<string, string | string[] | undefined>;

async function Results({ raw }: { raw: RawSearchParams }) {
  const params = parseSearchParams(raw);
  // Natural-language understanding: "natural glam under $150" → category + price
  // filters, without the user touching the filter controls. Explicit filters win.
  if (params.q) {
    const nl = parseNaturalQuery(params.q);
    if (nl.category && !params.category) params.category = nl.category;
    if (nl.maxPriceCents && params.maxPriceCents == null) params.maxPriceCents = nl.maxPriceCents;
  }
  const [pros, favoritedIds] = await Promise.all([
    searchProfessionalViews(params),
    getFavoriteProfessionalIds(),
  ]);
  return (
    <>
      <p className="mb-4 text-sm text-ink-muted">
        {pros.length} {pros.length === 1 ? "professional" : "professionals"}
        {params.q ? ` for “${params.q}”` : ""}
      </p>
      <ProfessionalGrid
        pros={pros}
        favoritedIds={favoritedIds}
        emptyTitle={params.q ? `No matches for “${params.q}”` : "No professionals match those filters"}
        emptyBody="Try a broader search, a larger distance, or removing a filter."
      />
    </>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const q = typeof raw.q === "string" ? raw.q : "";

  return (
    <Shell wide>
      <div className="mb-5">
        <SearchBar initial={q} />
      </div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <MobileFilterSheet />
        <SortSelect />
      </div>
      <div className="flex gap-8">
        <FiltersSidebar />
        <div className="min-w-0 flex-1">
          <Suspense fallback={<GridSkeleton />}>
            <Results raw={raw} />
          </Suspense>
        </div>
      </div>
    </Shell>
  );
}
