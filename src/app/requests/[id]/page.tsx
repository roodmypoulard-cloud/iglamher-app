import { notFound, redirect } from "next/navigation";
import { Shell } from "@/components/marketplace/Shell";
import { SmartImage } from "@/components/ui/SmartImage";
import { CancelRequestButton } from "@/components/requests/CancelRequestButton";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";
import { getJobRequest } from "@/lib/requests/data";
import { categoryLabel, timeAgo, TIME_WINDOWS } from "@/lib/requests/schema";
import { formatPrice, cn } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Job Request · iGlamHer" };

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  open: { label: "Open", cls: "bg-success/15 text-success" },
  matched: { label: "Matched", cls: "bg-rose/15 text-rose" },
  closed: { label: "Closed", cls: "bg-border/60 text-ink-muted" },
  cancelled: { label: "Cancelled", cls: "bg-border/60 text-ink-muted" },
  expired: { label: "Expired", cls: "bg-border/60 text-ink-muted" },
};

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let viewerId: string | null = null;
  if (isLiveSupabase()) {
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) redirect(`/signin?next=/requests/${id}`);
    viewerId = auth.user.id;
  }

  const req = await getJobRequest(id);
  if (!req) notFound();

  const isOwner = viewerId != null && viewerId === req.customerId;
  const status = STATUS_STYLES[req.status] ?? STATUS_STYLES.open;
  const timeLabel = TIME_WINDOWS.find((t) => t.key === req.timeWindow)?.label;

  return (
    <Shell back="/requests">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full bg-rose/[0.12] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-rose">
          {categoryLabel(req.category)}
        </span>
        <span className={cn("rounded-full px-3 py-1 text-[11px] font-bold", status.cls)}>{status.label}</span>
      </div>

      <h1 className="mt-3 font-display text-[22px] font-bold leading-tight">{req.title}</h1>
      <p className="mt-1 text-[12px] text-ink-muted">
        Posted {timeAgo(req.createdAt)} by {isOwner ? "you" : req.customerName}
      </p>

      <p className="mt-4 whitespace-pre-line text-[14px] leading-relaxed text-ink-secondary">{req.description}</p>

      {req.photos.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-secondary">Inspiration</h2>
          <div className="flex flex-wrap gap-2">
            {req.photos.map((p) => (
              <SmartImage key={p.path} src={p.url} alt="Inspiration" width={104} height={104} className="h-[104px] w-[104px] rounded-[14px] object-cover" />
            ))}
          </div>
        </section>
      )}

      <section className="mt-5 space-y-2.5 rounded-[20px] border border-border bg-surface p-4">
        <Row label="Location" value={`${req.locationText}${req.isHouseCall ? " · House call" : ""}`} />
        {req.preferredDate && <Row label="Preferred date" value={`${prettyDate(req.preferredDate)}${timeLabel ? ` · ${timeLabel}` : ""}`} />}
        {req.budgetCents != null && <Row label="Budget" value={formatPrice(req.budgetCents)} />}
      </section>

      {isOwner && req.status === "open" && (
        <div className="mt-4">
          <CancelRequestButton id={req.id} />
        </div>
      )}

      {/* Honest state: pros can browse requests, but the direct respond/offer
          flow isn't built yet — say so rather than dead-ending silently. */}
      {!isOwner && req.status === "open" && (
        <p className="mt-4 rounded-[14px] border border-border bg-surface px-4 py-3 text-[12.5px] leading-relaxed text-ink-muted">
          Responding to requests directly is coming soon. Professionals will be able to send offers right from this page.
        </p>
      )}
    </Shell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
      <span className="flex-none text-ink-muted">{label}</span>
      <span className="text-right font-semibold text-ink">{value}</span>
    </div>
  );
}
