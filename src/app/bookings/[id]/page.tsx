import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/marketplace/Shell";
import { BackButton } from "@/components/ui/BackButton";
import { BookingLifecycleActions } from "@/components/booking/BookingLifecycleActions";
import { ReviewForm } from "@/components/booking/ReviewForm";
import { TipForm } from "@/components/booking/TipForm";
import { ChevronRight } from "@/components/ui/icons";
import { getBookingDetail } from "@/lib/booking/data";
import { formatPrice } from "@/lib/format";
import type { BookingStatus } from "@/lib/booking/status";

export const dynamic = "force-dynamic";

const STATUS_META: Record<BookingStatus, { label: string; cls: string }> = {
  pending_payment: { label: "Awaiting payment", cls: "border-gold/40 bg-gold/10 text-gold" },
  confirmed: { label: "Confirmed", cls: "border-rose/40 bg-rose/10 text-rose" },
  change_requested: { label: "Change requested", cls: "border-gold/40 bg-gold/10 text-gold" },
  in_progress: { label: "In progress", cls: "border-rose/40 bg-rose/10 text-rose" },
  completed: { label: "Completed", cls: "border-success/40 bg-success/10 text-success" },
  cancelled_customer: { label: "Cancelled", cls: "border-border bg-surface text-ink-muted" },
  cancelled_professional: { label: "Cancelled by pro", cls: "border-border bg-surface text-ink-muted" },
  refunded: { label: "Refunded", cls: "border-border bg-surface text-ink-muted" },
  disputed: { label: "Disputed", cls: "border-rose/50 bg-rose/10 text-rose" },
  no_show: { label: "No-show", cls: "border-border bg-surface text-ink-muted" },
};

const PAYMENT_LABEL: Record<string, string> = {
  paid: "Paid",
  succeeded: "Paid",
  requires_payment: "Awaiting payment",
  processing: "Processing",
  failed: "Failed",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
  unpaid: "Awaiting payment",
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}
function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="text-right text-sm font-medium text-ink">{value}</span>
    </div>
  );
}

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await getBookingDetail(id);
  if (!b) notFound();

  const status = STATUS_META[b.status];
  const timeRange = b.endsAt ? `${fmtTime(b.startsAt)} – ${fmtTime(b.endsAt)}` : fmtTime(b.startsAt);
  const payLabel = PAYMENT_LABEL[b.paymentStatus] ?? b.paymentStatus;

  return (
    <Shell>
      <div className="mb-4">
        <BackButton fallback="/bookings" label="Bookings" />
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold leading-tight">{b.serviceName || "Appointment"}</h1>
          {b.professionalName && <p className="mt-1 text-sm text-ink-muted">with {b.professionalName}</p>}
        </div>
        <span className={`flex-none rounded-full border px-3 py-1 text-[11px] font-semibold ${status.cls}`}>{status.label}</span>
      </div>

      <section className="mt-6 overflow-hidden rounded-[16px] border border-border bg-surface divide-y divide-border/60">
        <Row label="Date" value={fmtDate(b.startsAt)} />
        <Row label="Time" value={timeRange} />
        <Row label="Professional" value={b.professionalName ?? "—"} />
        <Row label="Service" value={b.serviceName || "Appointment"} />
      </section>

      <section className="mt-4 overflow-hidden rounded-[16px] border border-border bg-surface divide-y divide-border/60">
        <Row label="Total" value={formatPrice(b.totalCents)} />
        {b.amountDueNowCents > 0 && b.amountDueNowCents !== b.totalCents && (
          <Row label="Deposit paid" value={formatPrice(b.amountDueNowCents)} />
        )}
        <Row label="Payment status" value={payLabel} />
        <Row label="Booking status" value={status.label} />
      </section>

      <BookingLifecycleActions bookingId={b.id} status={b.status} viewerRole={b.viewerRole} />

      {b.status === "completed" && (
        <section className="mt-6 space-y-4">
          {b.viewerRole === "customer" && !b.tipped && <TipForm bookingId={b.id} baseCents={b.subtotalCents} />}
          {!b.reviewedByViewer && (
            <ReviewForm bookingId={b.id} direction={b.viewerRole === "customer" ? "customer_to_pro" : "pro_to_customer"} />
          )}
          {b.reviewedByViewer && (
            <p className="rounded-[14px] border border-success/30 bg-success/10 px-4 py-3 text-sm font-semibold text-success">
              Thanks — your review has been posted.
            </p>
          )}
        </section>
      )}

      {b.professionalSlug && b.viewerRole === "customer" && (
        <Link
          href={`/professionals/${b.professionalSlug}`}
          className="mt-4 flex items-center justify-between rounded-[16px] border border-border bg-surface px-4 py-4 transition-colors hover:border-rose/50"
        >
          <span className="text-sm font-semibold text-ink">View provider profile</span>
          <ChevronRight width={16} height={16} className="text-ink-muted" />
        </Link>
      )}
    </Shell>
  );
}
