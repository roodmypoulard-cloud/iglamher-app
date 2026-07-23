import Link from "next/link";
import { SmartImage } from "@/components/ui/SmartImage";
import { formatPrice, cn } from "@/lib/format";
import { categoryLabel, timeAgo, type JobRequest } from "@/lib/requests/schema";

const STATUS_STYLES: Record<JobRequest["status"], { label: string; cls: string }> = {
  open: { label: "Open", cls: "bg-success/15 text-success" },
  matched: { label: "Matched", cls: "bg-rose/15 text-rose" },
  closed: { label: "Closed", cls: "bg-border/60 text-ink-muted" },
  cancelled: { label: "Cancelled", cls: "bg-border/60 text-ink-muted" },
  expired: { label: "Expired", cls: "bg-border/60 text-ink-muted" },
};

const PinIcon = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden>
    <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" />
  </svg>
);
const CalIcon = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden>
    <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" />
  </svg>
);

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Elegant feed card for one customer job request. */
export function RequestCard({ req, now }: { req: JobRequest; now?: number }) {
  const status = STATUS_STYLES[req.status];
  const photo = req.photos[0];
  return (
    <Link
      href={`/requests/${req.id}`}
      className="block rounded-[20px] border border-border bg-surface p-3.5 shadow-luxe transition-[transform,border-color] duration-200 hover:border-rose/50 active:scale-[0.99]"
    >
      <div className="flex gap-3">
        {photo && (
          <SmartImage
            src={photo.url}
            alt=""
            width={64}
            height={64}
            className="h-16 w-16 flex-none rounded-[14px] object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="rounded-full bg-rose/[0.12] px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-rose">
              {categoryLabel(req.category)}
            </span>
            <span className={cn("flex-none rounded-full px-2.5 py-0.5 text-[10.5px] font-bold", status.cls)}>
              {status.label}
            </span>
          </div>
          <h3 className="mt-1.5 truncate text-[15px] font-bold leading-snug text-ink">{req.title}</h3>
          <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-ink-secondary">{req.description}</p>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/50 pt-2 text-[11.5px] text-ink-muted">
        <span className="flex items-center gap-1"><PinIcon className="flex-none" />{req.locationText}{req.isHouseCall ? " · House call" : ""}</span>
        {req.preferredDate && <span className="flex items-center gap-1"><CalIcon className="flex-none" />{prettyDate(req.preferredDate)}</span>}
        {req.budgetCents != null && <span className="font-semibold text-ink-secondary">{formatPrice(req.budgetCents)} budget</span>}
        <span className="ml-auto">{timeAgo(req.createdAt, now)}</span>
      </div>
    </Link>
  );
}
