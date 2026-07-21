import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getStylist } from "@/lib/mock-data";
import { formatPrice, formatRating } from "@/lib/format";
import { ChevronLeft, LockIcon } from "@/components/ui/icons";
import { LinkButton } from "@/components/ui/Button";

// Static booking summary screen (Phase 1, mock). Interactive calendar +
// availability + Stripe come in Phase 4.
export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ stylist?: string }>;
}) {
  const { stylist: stylistId } = await searchParams;
  const stylist = stylistId ? getStylist(stylistId) : undefined;
  if (!stylist) notFound();
  const service = stylist.services[0];

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[440px] pb-28 md:max-w-lg">
      <div className="flex items-center gap-3 px-4 pt-4">
        <Link
          href={`/pro/${stylist.id}`}
          aria-label="Back"
          className="grid h-9 w-9 place-items-center rounded-[11px] border border-border bg-surface"
        >
          <ChevronLeft width={18} height={18} />
        </Link>
        <h1 className="font-display text-[15px] font-bold tracking-wide">BOOK APPOINTMENT</h1>
      </div>

      <div className="mx-5 mt-3 flex items-center gap-3.5 rounded-[16px] border border-border bg-surface p-4">
        <Image src={stylist.avatarUrl} alt={stylist.name} width={52} height={52} className="h-13 w-13 rounded-[14px] object-cover" />
        <div>
          <p className="font-display font-bold">{stylist.name}</p>
          <p className="text-xs text-ink-muted">
            <span className="font-semibold text-rose">★ {formatRating(stylist.ratingAvg)} ({stylist.ratingCount})</span>{" "}
            · {service.name}
          </p>
        </div>
      </div>

      <p className="mx-5 mt-5 text-xs font-semibold uppercase tracking-wide text-ink-muted">Select date</p>
      <div className="mx-5 mt-2.5 rounded-[16px] border border-border bg-surface p-6 text-center text-sm text-ink-muted">
        Interactive availability calendar arrives in Phase 4 (booking engine).
      </div>

      <p className="mx-5 mt-5 text-xs font-semibold uppercase tracking-wide text-ink-muted">Total</p>
      <div className="mx-5 mt-2.5 flex items-center justify-between border-t border-dashed border-border pt-4">
        <span className="text-sm text-ink-muted">{service.name}</span>
        <span className="font-display text-2xl font-bold">
          {formatPrice(service.priceCents, { from: service.priceIsFrom })}
        </span>
      </div>

      <div
        className="fixed bottom-0 left-1/2 z-30 w-full max-w-[440px] -translate-x-1/2 bg-gradient-to-t from-bg to-transparent px-5 pt-4"
        style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}
      >
        <LinkButton href="/bookings" full>
          Confirm booking · {formatPrice(service.priceCents, { from: service.priceIsFrom })}
        </LinkButton>
        <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] text-ink-muted">
          <LockIcon width={13} height={13} className="text-rose" /> Secure booking · free cancellation up to 24h before
        </p>
      </div>
    </div>
  );
}
