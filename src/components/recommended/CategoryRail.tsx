"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/format";
import type { CategorySlug } from "@/lib/data/model";

type IconProps = { className?: string };
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const AllIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" width={16} height={16} {...stroke} className={p.className} aria-hidden>
    <path d="M4 6c5-2.5 11-2.5 16 0M4 12c5-2.5 11-2.5 16 0M4 18c5-2.5 11-2.5 16 0" />
  </svg>
);
const MakeupIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" width={16} height={16} {...stroke} className={p.className} aria-hidden>
    <path d="m14.5 3.5 6 6-9.5 9.5a2.6 2.6 0 0 1-1.6.75l-4 .35.35-4a2.6 2.6 0 0 1 .75-1.6L16 5" />
    <path d="m13 5 6 6" />
  </svg>
);
const HairIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" width={16} height={16} {...stroke} className={p.className} aria-hidden>
    <path d="M12 3c-4 0-6.5 3-6.5 6.6 0 2.6.9 3.7.6 6C5.8 18 5 19.5 5 21h14c0-1.5-.8-3-1.1-5.4-.3-2.3.6-3.4.6-6C18.5 6 16 3 12 3Z" />
    <path d="M9.5 21c0-3 .5-5.5 2.5-8 2 2.5 2.5 5 2.5 8" />
  </svg>
);
const NailsIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" width={16} height={16} {...stroke} className={p.className} aria-hidden>
    <path d="M9 9h6v11a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V9Z" />
    <path d="M10 9V5a2 2 0 0 1 4 0v4M8 3.5 9 5m7-1.5L15 5" />
  </svg>
);
const LashesIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" width={16} height={16} {...stroke} className={p.className} aria-hidden>
    <path d="M3 12c2.8-3.8 6-5.7 9-5.7S18.2 8.2 21 12" />
    <path d="M6 13.5 5 16m4.5-1.5-.6 2.6M13 15l.5 2.6M17.6 13.7l1 2.4" />
  </svg>
);
const StylistIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" width={16} height={16} {...stroke} className={p.className} aria-hidden>
    <circle cx="6.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" />
    <path d="m8.6 15.9 9-11.4M15.4 15.9l-9-11.4" />
  </svg>
);

const ICONS: Record<string, (p: IconProps) => React.ReactElement> = {
  all: AllIcon, makeup: MakeupIcon, hair: HairIcon, nails: NailsIcon, lashes: LashesIcon, stylist: StylistIcon,
};

export function CategoryRail({ categories }: { categories: Array<{ slug: CategorySlug; name: string }> }) {
  const sp = useSearchParams();
  const current = sp.get("category") ?? "all";

  const tiles = [{ slug: "all", name: "All" }, ...categories];

  const hrefFor = (slug: string) => {
    const next = new URLSearchParams(sp.toString());
    if (slug === "all") next.delete("category");
    else next.set("category", slug);
    next.delete("limit"); // reset pagination when switching categories
    const qs = next.toString();
    return qs ? `/recommended?${qs}` : "/recommended";
  };

  return (
    <div role="tablist" aria-label="Service category" className="scrollbar-none -mx-5 flex gap-2.5 overflow-x-auto px-5 py-1">
      {tiles.map((t) => {
        const active = current === t.slug || (t.slug === "all" && !sp.get("category"));
        const Icon = ICONS[t.slug] ?? AllIcon;
        return (
          <Link
            key={t.slug}
            href={hrefFor(t.slug)}
            role="tab"
            aria-selected={active}
            scroll={false}
            className="flex flex-none flex-col items-center gap-1 active:scale-95"
          >
            {/* Circular icon chip with the label beneath — matches the design mock. */}
            <span
              className={cn(
                "grid h-12 w-12 place-items-center rounded-full border transition-[border-color,box-shadow] duration-200",
                active
                  ? "fab-gold border-transparent shadow-[0_5px_14px_rgba(215,160,143,0.35)]"
                  : "border-rose/20 bg-surface hover:border-rose/45",
              )}
            >
              <Icon className={active ? "text-[#2A1712]" : "text-rose"} />
            </span>
            <span className={cn("text-[10.5px] font-semibold leading-none", active ? "font-bold text-rose" : "text-ink-secondary")}>{t.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
