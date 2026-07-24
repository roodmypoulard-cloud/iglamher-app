"use client";
import { useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { parseSearchParams, buildQuery, activeFilterCount } from "@/lib/marketplace/params";
import type { SearchParams, SortKey } from "@/lib/marketplace/ranking";
import type { CategorySlug, LocationType } from "@/lib/data/model";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/format";

const CATEGORY_OPTS: { value: CategorySlug; label: string }[] = [
  { value: "hair", label: "Hair" },
  { value: "makeup", label: "Makeup" },
  { value: "lashes", label: "Lashes" },
  { value: "nails", label: "Nails" },
  { value: "stylist", label: "Stylist" },
];
const LOCATION_OPTS: { value: LocationType | "all"; label: string }[] = [
  { value: "all", label: "Any" },
  { value: "in_salon", label: "At studio" },
  { value: "mobile", label: "Mobile" },
  { value: "both", label: "Both" },
];
const SORT_OPTS: { value: SortKey; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "nearest", label: "Nearest" },
  { value: "rating", label: "Highest rated" },
  { value: "reviews", label: "Most reviewed" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "earliest", label: "Earliest availability" },
];

function useFilterState() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = parseSearchParams(Object.fromEntries(sp.entries()));

  const apply = useCallback(
    (patch: Partial<SearchParams>, event?: string) => {
      const merged = { ...current, ...patch };
      const qs = buildQuery(merged);
      const base = pathname === "/discover" ? "/search" : pathname;
      router.push(qs ? `${base}?${qs}` : base);
      if (event) track("filter_applied", { field: event });
    },
    [current, pathname, router],
  );

  return { current, apply };
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{children}</p>;
}

export function SortSelect() {
  const { current, apply } = useFilterState();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-ink-muted">Sort</span>
      <select
        value={current.sort ?? "recommended"}
        onChange={(e) => apply({ sort: e.target.value as SortKey }, "sort")}
        className="rounded-[10px] border border-border bg-surface px-3 py-2 text-ink focus:border-rose"
      >
        {SORT_OPTS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterControls() {
  const { current, apply } = useFilterState();
  const chip = (active: boolean) =>
    cn(
      "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
      active ? "border-rose bg-rose/10 text-rose" : "border-border text-ink-secondary hover:text-ink",
    );

  return (
    <div className="space-y-6">
      <div>
        <FieldLabel>Category</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_OPTS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={chip(current.category === o.value)}
              onClick={() => apply({ category: current.category === o.value ? undefined : o.value }, "category")}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <FieldLabel>Service location</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {LOCATION_OPTS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={chip((current.location ?? "all") === o.value)}
              onClick={() => apply({ location: o.value }, "location")}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <FieldLabel>Minimum rating</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {[undefined, 4, 4.5, 4.8].map((r) => (
            <button
              key={String(r)}
              type="button"
              className={chip(current.minRating === r)}
              onClick={() => apply({ minRating: r }, "rating")}
            >
              {r == null ? "Any" : `${r}★+`}
            </button>
          ))}
        </div>
      </div>

      <div>
        <FieldLabel>Max distance</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {[undefined, 5, 10, 25].map((d) => (
            <button
              key={String(d)}
              type="button"
              className={chip(current.distanceMi === d)}
              onClick={() => apply({ distanceMi: d }, "distance")}
            >
              {d == null ? "Any" : `${d} mi`}
            </button>
          ))}
        </div>
      </div>

      <div>
        <FieldLabel>Price</FieldLabel>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Min $"
            aria-label="Minimum price"
            defaultValue={current.minPriceCents != null ? current.minPriceCents / 100 : ""}
            onBlur={(e) =>
              apply({ minPriceCents: e.target.value ? Math.round(Number(e.target.value) * 100) : undefined }, "price")
            }
            className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm focus:border-rose"
          />
          <span className="text-ink-muted">–</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Max $"
            aria-label="Maximum price"
            defaultValue={current.maxPriceCents != null ? current.maxPriceCents / 100 : ""}
            onBlur={(e) =>
              apply({ maxPriceCents: e.target.value ? Math.round(Number(e.target.value) * 100) : undefined }, "price")
            }
            className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm focus:border-rose"
          />
        </div>
      </div>

      <div className="space-y-3">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-ink">Verified only</span>
          <input
            type="checkbox"
            checked={current.verifiedOnly ?? false}
            onChange={(e) => apply({ verifiedOnly: e.target.checked }, "verified")}
            className="h-5 w-5 accent-[#D7A08F]"
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-ink">Instant booking</span>
          <input
            type="checkbox"
            checked={current.instantOnly ?? false}
            onChange={(e) => apply({ instantOnly: e.target.checked }, "instant")}
            className="h-5 w-5 accent-[#D7A08F]"
          />
        </label>
      </div>

      {activeFilterCount(current) > 0 && (
        <button
          type="button"
          onClick={() =>
            apply({
              category: undefined,
              location: "all",
              minRating: undefined,
              distanceMi: undefined,
              minPriceCents: undefined,
              maxPriceCents: undefined,
              verifiedOnly: false,
              instantOnly: false,
            })
          }
          className="text-sm font-semibold text-rose hover:underline"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}

/** Desktop sidebar. */
export function FiltersSidebar() {
  return (
    <aside className="hidden w-64 flex-none lg:block">
      <div className="sticky top-24 card-luxe p-5">
        <h2 className="mb-4 font-display text-lg font-semibold">Filters</h2>
        <FilterControls />
      </div>
    </aside>
  );
}

/** Mobile bottom-sheet trigger + panel. */
export function MobileFilterSheet({ triggerClassName }: { triggerClassName?: string } = {}) {
  const [open, setOpen] = useState(false);
  const sp = useSearchParams();
  const count = activeFilterCount(parseSearchParams(Object.fromEntries(sp.entries())));
  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerClassName ?? "inline-flex items-center gap-2 rounded-[12px] border border-border bg-surface px-4 py-2.5 text-sm font-semibold"}
      >
        Filters
        {count > 0 && (
          <span className="grid h-5 w-5 place-items-center rounded-full rose-gradient text-[11px] font-bold text-[#2A1712]">
            {count}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={() => setOpen(false)}>
          <div
            className="max-h-[85vh] overflow-y-auto rounded-t-[24px] border-t border-border bg-bg-elevated p-5"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Filters</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-sm font-semibold text-rose">
                Done
              </button>
            </div>
            <FilterControls />
          </div>
        </div>
      )}
    </div>
  );
}
