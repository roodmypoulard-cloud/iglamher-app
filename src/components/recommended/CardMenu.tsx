"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** ⋯ overflow menu on a recommendation card: View profile + Share/Copy link.
 *  Small, dependency-free popover; closes on outside tap or Escape. */
export function CardMenu({ slug, name }: { slug: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const profileUrl = `/professionals/${slug}`;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function share() {
    const url = `${location.origin}${profileUrl}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${name} · iGlamHer`, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }
    } catch {
      /* user dismissed the share sheet */
    }
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative flex-none">
      <button
        type="button"
        aria-label={`More options for ${name}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid h-7 w-7 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
      >
        <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden>
          <circle cx="12" cy="5" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="12" cy="19" r="1.7" />
        </svg>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-8 z-20 w-40 overflow-hidden rounded-[14px] border border-border bg-bg-elevated shadow-luxe">
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); router.push(profileUrl); }}
            className="block w-full px-3.5 py-2.5 text-left text-[12.5px] font-semibold text-ink hover:bg-surface-hover"
          >
            View profile
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={share}
            className="block w-full border-t border-border/50 px-3.5 py-2.5 text-left text-[12.5px] font-semibold text-ink hover:bg-surface-hover"
          >
            {copied ? "Link copied ✓" : "Share"}
          </button>
        </div>
      )}
    </div>
  );
}
