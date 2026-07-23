"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon, ArrowRightIcon } from "@/components/ui/icons";
import { track } from "@/lib/analytics";
import { addRecentSearch, getRecentSearches, clearRecentSearches, SEARCH_SUGGESTIONS } from "@/lib/search/recent";
import { cn } from "@/lib/format";

export function SearchBar({
  initial = "",
  autoFocus = false,
  placeholder = "Search makeup, hair, lashes, a name or city…",
  iconRight = false,
  variant = "default",
  basePath = "/search",
}: {
  initial?: string;
  autoFocus?: boolean;
  placeholder?: string;
  iconRight?: boolean;
  variant?: "default" | "cta";
  /** Route that receives the query — lets Recommended reuse the bar in place. */
  basePath?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Refresh the recent-search list from localStorage when the panel opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setRecent(getRecentSearches());
  }, [open]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function go(term: string) {
    const q = term.trim();
    addRecentSearch(q);
    track("search_submitted", { hasQuery: q.length > 0 });
    setOpen(false);
    router.push(q ? `${basePath}?q=${encodeURIComponent(q)}` : basePath);
  }

  if (variant === "cta") {
    return (
      <div ref={wrapRef} className="relative w-full">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            go(value);
          }}
          role="search"
          className="group relative flex items-center rounded-full border border-rose/40 bg-white/[0.05] p-1.5 pl-5 backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.09),inset_0_-10px_26px_rgba(0,0,0,0.28),0_18px_46px_rgba(0,0,0,0.5)] transition-[border-color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-within:-translate-y-0.5 focus-within:border-rose/70 focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-10px_26px_rgba(0,0,0,0.28),0_24px_58px_rgba(215,160,143,0.26)]"
        >
          <SearchIcon width={19} height={19} className="pointer-events-none flex-none text-rose/90" />
          <input
            type="search"
            value={value}
            autoFocus={autoFocus}
            onFocus={() => setOpen(true)}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            aria-label="Search professionals and services"
            className="min-w-0 flex-1 bg-transparent px-3 py-3 text-[14px] text-ink caret-rose placeholder:text-ink-muted focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Search"
            className="arrow-pulse grid h-11 w-11 flex-none place-items-center rounded-full rose-gradient text-[#2A1712] transition-[transform,filter] duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 active:scale-90"
          >
            <ArrowRightIcon width={19} height={19} />
          </button>
        </form>
        {open && <Suggestions recent={recent} onPick={go} onClear={() => { clearRecentSearches(); setRecent([]); }} />}
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(value);
        }}
        role="search"
      >
        <SearchIcon
          width={18}
          height={18}
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-muted",
            iconRight ? "right-4" : "left-4",
          )}
        />
        <input
          type="search"
          value={value}
          autoFocus={autoFocus}
          onFocus={() => setOpen(true)}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          aria-label="Search professionals and services"
          className={cn(
            "w-full rounded-[14px] border border-border bg-surface py-3.5 text-[15px] text-ink caret-rose placeholder:text-ink-muted",
            "transition-[box-shadow,border-color,transform] duration-200 ease-out",
            "focus:border-rose/80 focus:shadow-[0_8px_24px_rgba(215,160,143,0.14)] focus:outline-none focus:-translate-y-px",
            iconRight ? "pl-4 pr-11" : "pl-11 pr-4",
          )}
        />
      </form>

      {open && <Suggestions recent={recent} onPick={go} onClear={() => { clearRecentSearches(); setRecent([]); }} />}
    </div>
  );
}

function Suggestions({ recent, onPick, onClear }: { recent: string[]; onPick: (t: string) => void; onClear: () => void }) {
  return (
    <div className="slide-up absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-[16px] border border-border bg-bg-elevated shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
      {recent.length > 0 && (
        <div className="border-b border-border/60 p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Recent</span>
            <button type="button" onClick={onClear} className="text-[11px] font-semibold text-rose">
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recent.map((r) => (
              <Chip key={r} label={r} onClick={() => onPick(r)} recent />
            ))}
          </div>
        </div>
      )}
      <div className="p-3">
        <span className="mb-2 block px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Popular</span>
        <div className="flex flex-wrap gap-2">
          {SEARCH_SUGGESTIONS.map((s) => (
            <Chip key={s} label={s} onClick={() => onPick(s)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Chip({ label, onClick, recent }: { label: string; onClick: () => void; recent?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
        recent ? "border-border bg-surface text-ink-secondary hover:text-ink" : "border-rose/30 text-rose hover:bg-rose/10",
      )}
    >
      {label}
    </button>
  );
}
