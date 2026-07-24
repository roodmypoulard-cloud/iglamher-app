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

/** The patch that wipes every filter field (search text and sort survive). */
const CLEARED: Partial<SearchParams> = {
  category: undefined,
  location: "all",
  minRating: undefined,
  distanceMi: undefined,
  minPriceCents: undefined,
  maxPriceCents: undefined,
  verifiedOnly: false,
  instantOnly: false,
};

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

/** Filter fields. Uncontrolled (default) commits straight to the URL — used by
 *  the desktop sidebar. Pass `value` + `onChange` for draft mode: the mobile
 *  sheet stages edits and commits them only on Apply, so chip taps never thrash
 *  navigation. */
export function FilterControls({
  value,
  onChange,
}: {
  value?: SearchParams;
  onChange?: (patch: Partial<SearchParams>, event?: string) => void;
} = {}) {
  const { current, apply } = useFilterState();
  const state = value ?? current;
  const set = onChange ?? apply;
  const chip = (active: boolean) =>
    cn(
      "min-h-[44px] rounded-full border px-4 text-sm font-medium transition-[color,border-color,background-color,transform] active:scale-[0.97]",
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
              aria-pressed={state.category === o.value}
              className={chip(state.category === o.value)}
              onClick={() => set({ category: state.category === o.value ? undefined : o.value }, "category")}
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
              aria-pressed={(state.location ?? "all") === o.value}
              className={chip((state.location ?? "all") === o.value)}
              onClick={() => set({ location: o.value }, "location")}
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
              aria-pressed={state.minRating === r}
              className={chip(state.minRating === r)}
              onClick={() => set({ minRating: r }, "rating")}
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
              aria-pressed={state.distanceMi === d}
              className={chip(state.distanceMi === d)}
              onClick={() => set({ distanceMi: d }, "distance")}
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
            key={`min-${state.minPriceCents ?? ""}`}
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Min $"
            aria-label="Minimum price"
            defaultValue={state.minPriceCents != null ? state.minPriceCents / 100 : ""}
            onBlur={(e) =>
              set({ minPriceCents: e.target.value ? Math.round(Number(e.target.value) * 100) : undefined }, "price")
            }
            className="w-full rounded-[10px] border border-border bg-surface px-3 py-2.5 text-sm focus:border-rose"
          />
          <span className="text-ink-muted">–</span>
          <input
            key={`max-${state.maxPriceCents ?? ""}`}
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Max $"
            aria-label="Maximum price"
            defaultValue={state.maxPriceCents != null ? state.maxPriceCents / 100 : ""}
            onBlur={(e) =>
              set({ maxPriceCents: e.target.value ? Math.round(Number(e.target.value) * 100) : undefined }, "price")
            }
            className="w-full rounded-[10px] border border-border bg-surface px-3 py-2.5 text-sm focus:border-rose"
          />
        </div>
      </div>

      <div className="space-y-3">
        <label className="flex min-h-[44px] items-center justify-between gap-3 text-sm">
          <span className="text-ink">Verified only</span>
          <input
            type="checkbox"
            checked={state.verifiedOnly ?? false}
            onChange={(e) => set({ verifiedOnly: e.target.checked }, "verified")}
            className="h-5 w-5 accent-[#D7A08F]"
          />
        </label>
        <label className="flex min-h-[44px] items-center justify-between gap-3 text-sm">
          <span className="text-ink">Instant booking</span>
          <input
            type="checkbox"
            checked={state.instantOnly ?? false}
            onChange={(e) => set({ instantOnly: e.target.checked }, "instant")}
            className="h-5 w-5 accent-[#D7A08F]"
          />
        </label>
      </div>

      {/* Draft mode gets Clear All in the sheet footer instead. */}
      {!onChange && activeFilterCount(state) > 0 && (
        <button type="button" onClick={() => apply(CLEARED)} className="min-h-[44px] text-sm font-semibold text-rose hover:underline">
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

/** Mobile bottom-sheet trigger + panel. Edits are staged in a draft and only
 *  committed to the URL on Apply (Soft Luxe: no navigation thrash per chip). */
export function MobileFilterSheet({ triggerClassName }: { triggerClassName?: string } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = parseSearchParams(Object.fromEntries(sp.entries()));
  const count = activeFilterCount(current);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SearchParams>(current);

  function openSheet() {
    setDraft(current); // re-seed from the URL each open so stale drafts never leak
    setOpen(true);
  }

  const patchDraft = useCallback((patch: Partial<SearchParams>, event?: string) => {
    setDraft((d) => ({ ...d, ...patch }));
    if (event) track("filter_applied", { field: `draft_${event}` });
  }, []);

  function applyDraft() {
    const qs = buildQuery(draft);
    const base = pathname === "/discover" ? "/search" : pathname;
    router.push(qs ? `${base}?${qs}` : base);
    track("filter_applied", { field: "apply", active: activeFilterCount(draft) });
    setOpen(false);
  }

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={openSheet}
        className={triggerClassName ?? "inline-flex min-h-[44px] items-center gap-2 rounded-[12px] border border-border bg-surface px-4 text-sm font-semibold transition-[border-color,transform] hover:border-rose/50 active:scale-[0.97]"}
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
            className="flex max-h-[85vh] flex-col rounded-t-[24px] border-t border-border bg-bg-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 pb-4">
              <h2 className="font-display text-xl font-semibold">Filters</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close filters"
                className="grid h-11 w-11 place-items-center rounded-full text-ink-muted transition-colors hover:text-ink"
              >
                <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
              <FilterControls value={draft} onChange={patchDraft} />
            </div>
            <div
              className="flex items-center gap-3 border-t border-border/60 bg-bg-elevated p-4 px-5"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
            >
              <button
                type="button"
                onClick={() => setDraft((d) => ({ ...d, ...CLEARED }))}
                className="min-h-[48px] flex-1 rounded-full border border-border text-sm font-semibold text-ink-secondary transition-[color,border-color,transform] hover:border-rose/50 hover:text-ink active:scale-[0.97]"
              >
                Clear All
              </button>
              <button
                type="button"
                onClick={applyDraft}
                className="min-h-[48px] flex-[1.6] rounded-full rose-gradient text-sm font-bold text-[#2A1712] shadow-[0_8px_20px_rgba(215,160,143,0.3)] transition-transform active:scale-[0.97]"
              >
                Apply{activeFilterCount(draft) > 0 ? ` (${activeFilterCount(draft)})` : ""}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
