import { notFound } from "next/navigation";
import Image from "next/image";
import { Shell } from "@/components/marketplace/Shell";
import { ProfessionalGrid } from "@/components/marketplace/ProfessionalGrid";
import { SortSelect } from "@/components/marketplace/Filters";
import { TrackView } from "@/components/marketplace/TrackView";
import { listCategories, getProfessionalsByCategory } from "@/lib/data/professionals";
import { getFavoriteProfessionalIds } from "@/lib/data/favorites";
import type { CategorySlug } from "@/lib/data/model";

export const dynamic = "force-dynamic";

const VALID: CategorySlug[] = ["hair", "makeup", "lashes", "nails", "stylist"];

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!VALID.includes(slug as CategorySlug)) notFound();
  const category = slug as CategorySlug;

  const [categories, pros, favoritedIds] = await Promise.all([
    listCategories(),
    getProfessionalsByCategory(category),
    getFavoriteProfessionalIds(),
  ]);
  const cat = categories.find((c) => c.slug === category);
  if (!cat) notFound();

  return (
    <Shell wide>
      <TrackView event="category_viewed" props={{ category }} />
      <div className="relative mb-6 aspect-[16/6] w-full overflow-hidden rounded-[16px] border border-border">
        {cat.imageUrl && <Image src={cat.imageUrl} alt="" fill sizes="100vw" className="object-cover" priority />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        <div className="absolute bottom-0 p-6">
          <h1 className="font-display text-3xl font-bold">{cat.name}</h1>
          <p className="mt-1 max-w-lg text-sm text-ink-secondary">{cat.description}</p>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink-muted">{pros.length} professionals</p>
        <SortSelect />
      </div>

      <ProfessionalGrid
        pros={pros}
        favoritedIds={favoritedIds}
        emptyTitle={`No ${cat.name.toLowerCase()} pros yet`}
        emptyBody="Check back soon — we're adding professionals across LA every week."
      />
    </Shell>
  );
}
