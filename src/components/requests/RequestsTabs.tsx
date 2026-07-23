"use client";
import { useState } from "react";
import { RequestCard } from "./RequestCard";
import { EmptyState } from "@/components/ui/states";
import { cn } from "@/lib/format";
import type { JobRequest } from "@/lib/requests/schema";

/** Browse / Mine segmented feed. Both lists arrive server-rendered; switching is instant. */
export function RequestsTabs({ open, mine }: { open: JobRequest[]; mine: JobRequest[] }) {
  const [tab, setTab] = useState<"browse" | "mine">("browse");
  // One clock reading for every card (lazy init keeps the render pure).
  const [now] = useState(() => Date.now());

  const seg = (key: "browse" | "mine", label: string, count: number) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === key}
      onClick={() => setTab(key)}
      className={cn(
        "relative flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold transition-colors duration-200",
        tab === key ? "rose-gradient text-[#2A1712]" : "text-ink-secondary hover:text-ink",
      )}
    >
      {tab === key && <span className="tab-shine" aria-hidden />}
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 py-px text-[10.5px] font-bold",
          tab === key ? "bg-[#2A1712]/10" : "bg-border/60",
        )}
      >
        {count}
      </span>
    </button>
  );

  const list = tab === "browse" ? open : mine;

  return (
    <div>
      <div role="tablist" aria-label="Job requests" className="flex gap-1 rounded-full border border-border bg-surface p-1">
        {seg("browse", "Latest requests", open.length)}
        {seg("mine", "My requests", mine.length)}
      </div>

      <div className="mt-3 space-y-2.5">
        {list.length === 0 ? (
          <EmptyState
            title={tab === "browse" ? "No open requests right now" : "You haven't posted a request yet"}
            body={
              tab === "browse"
                ? "New requests from the community will appear here."
                : "Tap “Create a job” above and tell pros what you need — it takes under a minute."
            }
          />
        ) : (
          list.map((r) => <RequestCard key={r.id} req={r} now={now} />)
        )}
      </div>
    </div>
  );
}
