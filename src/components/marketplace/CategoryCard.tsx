import Link from "next/link";
import { SmartImage } from "@/components/ui/SmartImage";
import type { Category } from "@/lib/data/model";

export function CategoryCard({ category }: { category: Category }) {
  return (
    <Link
      href={`/categories/${category.slug}`}
      className="group relative flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-[16px] border border-border"
    >
      <SmartImage
        src={category.imageUrl}
        alt=""
        fill
        sizes="(max-width: 640px) 50vw, 25vw"
        className="img-luxe object-cover transition-transform duration-500 group-hover:scale-[1.05]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
      <div className="relative p-4">
        <h3 className="font-display text-xl font-semibold text-ink">{category.name}</h3>
        <p className="mt-0.5 line-clamp-2 text-xs text-ink-secondary">{category.description}</p>
      </div>
    </Link>
  );
}
