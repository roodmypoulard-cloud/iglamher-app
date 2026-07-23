"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SmartImage } from "@/components/ui/SmartImage";
import { cn } from "@/lib/format";
import type { CategorySlug } from "@/lib/data/model";

/** Customer-facing display names (DB names stay canonical). */
const DISPLAY: Record<string, string> = { stylist: "Wardrobe Stylist" };

const AllIcon = () => (
  <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m12 3 2.2 4.7 5.2.6-3.9 3.5 1.1 5.1L12 14.3 7.4 16.9l1.1-5.1-3.9-3.5 5.2-.6L12 3Z" />
  </svg>
);

/** Full-width rail of real category imagery — photo circles, one row edge to
 *  edge. Every chip is a real category from the database; tapping re-queries
 *  the server. */
export function CategoryRail({
  categories,
}: {
  categories: Array<{ slug: CategorySlug; name: string; imageUrl: string }>;
}) {
  const sp = useSearchParams();
  const current = sp.get("category") ?? "all";

  const hrefFor = (slug: string) => {
    const next = new URLSearchParams(sp.toString());
    if (slug === "all") next.delete("category");
    else next.set("category", slug);
    next.delete("limit");
    const qs = next.toString();
    return qs ? `/recommended?${qs}` : "/recommended";
  };

  return (
    <div role="tablist" aria-label="Service category" className="flex w-full items-start gap-2">
      {/* All — metallic chip, same size as the photo circles */}
      <RailItem href={hrefFor("all")} label="All" active={current === "all" || !sp.get("category")}>
        <span className="fab-gold grid aspect-square w-full place-items-center rounded-full text-[#2A1712]">
          <AllIcon />
        </span>
      </RailItem>

      {categories.map((c) => {
        const active = current === c.slug;
        return (
          <RailItem key={c.slug} href={hrefFor(c.slug)} label={DISPLAY[c.slug] ?? c.name} active={active}>
            <span
              className={cn(
                "relative block aspect-square w-full overflow-hidden rounded-full ring-2 transition-shadow duration-200",
                active ? "ring-rose shadow-[0_0_18px_rgba(215,160,143,0.45)]" : "ring-rose/25",
              )}
            >
              <SmartImage src={c.imageUrl} alt="" fill sizes="64px" className="object-cover" />
            </span>
          </RailItem>
        );
      })}
    </div>
  );
}

function RailItem({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      scroll={false}
      className="flex min-w-0 flex-1 flex-col items-center gap-1 active:scale-95"
    >
      <span className="block w-full max-w-[64px]">{children}</span>
      <span
        className={cn(
          "w-full text-center text-[9px] font-semibold leading-[1.15]",
          active ? "font-bold text-rose" : "text-ink-secondary",
        )}
      >
        {label}
      </span>
    </Link>
  );
}
