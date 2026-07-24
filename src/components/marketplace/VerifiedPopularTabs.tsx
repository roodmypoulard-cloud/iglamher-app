"use client";
import { useState } from "react";
import { LuxeProCard } from "@/components/marketplace/LuxeProCard";
import { EmptyState } from "@/components/ui/states";
import { cn } from "@/lib/format";
import type { ProfessionalCardView } from "@/lib/data/model";

type TabKey = "recommended" | "top_rated" | "popular" | "nearby";
const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "recommended", label: "Recommended" },
  { key: "top_rated", label: "Top Rated" },
  { key: "popular", label: "Popular" },
  { key: "nearby", label: "Nearby" },
];

/** Verified & Popular (spec §10) — gold-outlined active tab, swaps the pro grid
 *  client-side (all four lists are pre-rendered server-side, so switching is
 *  instant). */
export function VerifiedPopularTabs({
  lists,
  favoritedIds,
}: {
  lists: Record<TabKey, ProfessionalCardView[]>;
  favoritedIds: string[];
}) {
  const [tab, setTab] = useState<TabKey>(
    (["recommended", "top_rated", "popular", "nearby"] as TabKey[]).find((k) => lists[k].length > 0) ?? "recommended",
  );
  const pros = lists[tab];

  return (
    <div>
      <div role="tablist" aria-label="Filter professionals" className="scrollbar-none -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.key)}
              className={cn(
                "min-h-[38px] flex-none rounded-full px-4 text-[12.5px] font-semibold transition-colors duration-200",
                on ? "border border-gold/70 bg-surface-hover text-ink shadow-[0_0_12px_rgba(201,154,75,0.2)]" : "border border-border text-ink-muted hover:text-ink-secondary",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3">
        {pros.length === 0 ? (
          <EmptyState title="No exact match yet" body="Try adjusting your service, location, or filters." action={{ label: "Browse recommended", href: "/recommended" }} />
        ) : (
          <div className="scrollbar-none -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1">
            {pros.map((p) => (
              <div key={p.userId} className="snap-start">
                <LuxeProCard pro={p} favorited={favoritedIds.includes(p.userId)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
