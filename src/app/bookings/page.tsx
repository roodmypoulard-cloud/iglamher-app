import Link from "next/link";
import { Shell, SectionLabel } from "@/components/marketplace/Shell";
import { EmptyState } from "@/components/ui/states";
import { ChevronRight } from "@/components/ui/icons";
import { getMyCustomerBookings, type BookingSummary } from "@/lib/booking/data";
import { formatPrice } from "@/lib/format";
import type { BookingStatus } from "@/lib/booking/status";

export const dynamic = "force-dynamic";

const UPCOMING = new Set<BookingStatus>(["pending_payment", "confirmed", "change_requested", "in_progress"]);

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

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function BookingRow({ b }: { b: BookingSummary }) {
  const meta = STATUS_META[b.status];
  return (
    <Link
      href={`/professionals/${b.professionalId}`}
      className="flex items-center gap-3 rounded-[16px] border border-border bg-surface p-4 shadow-[0_4px_16px_rgba(0,0,0,0.18)] transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-rose/50 hover:shadow-[0_14px_30px_rgba(0,0,0,0.30)]"
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2">
          <span className="truncate font-display text-[16px] font-semibold">{b.serviceName || "Appointment"}</span>
          <span className={`flex-none rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${meta.cls}`}>
            {meta.label}
          </span>
        </p>
        {b.professionalName && <p className="mt-0.5 truncate text-xs text-ink-muted">with {b.professionalName}</p>}
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11.5px] text-ink-muted">
          <span>{fmtWhen(b.startsAt)}</span>
          <span>· {formatPrice(b.totalCents)}</span>
        </p>
      </div>
      <ChevronRight width={16} height={16} className="flex-none text-ink-muted" />
    </Link>
  );
}

export default async function BookingsPage() {
  const bookings = await getMyCustomerBookings();
  const upcoming = bookings
    .filter((b) => UPCOMING.has(b.status))
    .sort((a, c) => new Date(a.startsAt).getTime() - new Date(c.startsAt).getTime());
  const past = bookings.filter((b) => !UPCOMING.has(b.status));

  return (
    <Shell>
      <h1 className="font-display text-[26px] font-bold leading-tight">Your bookings</h1>

      {bookings.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No bookings yet"
            body="When you book a beauty pro, your upcoming and past appointments show up here with reminders and receipts."
            action={{ label: "Find a pro", href: "/discover" }}
          />
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <>
              <SectionLabel label="Upcoming" />
              <div className="stagger space-y-3">
                {upcoming.map((b) => (
                  <BookingRow key={b.id} b={b} />
                ))}
              </div>
            </>
          )}
          {past.length > 0 && (
            <>
              <SectionLabel label="Past" />
              <div className="stagger space-y-3">
                {past.map((b) => (
                  <BookingRow key={b.id} b={b} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </Shell>
  );
}
