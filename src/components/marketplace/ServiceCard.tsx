import Link from "next/link";
import type { ServiceRow } from "@/lib/data/model";
import { formatPrice, formatDuration } from "@/lib/format";
import { ChevronRight } from "@/components/ui/icons";

const LOCATION_LABEL: Record<ServiceRow["locationType"], string> = {
  in_salon: "At studio",
  mobile: "Mobile",
  both: "Studio or mobile",
};

export function ServiceCard({ service, href }: { service: ServiceRow; href?: string }) {
  const body = (
    <>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-display text-base font-semibold">
          {service.name}
          {service.instantBook && (
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success">
              Instant
            </span>
          )}
        </p>
        {service.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-ink-secondary">{service.description}</p>
        )}
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-ink-muted">
          <span>{formatDuration(service.durationMin)}</span>
          <span>· {LOCATION_LABEL[service.locationType]}</span>
        </p>
      </div>
      <div className="flex flex-none items-center gap-1 self-center">
        <span className="font-semibold text-ink">{formatPrice(service.priceCents, { from: service.priceIsFrom })}</span>
        {href && <ChevronRight width={16} height={16} className="text-ink-muted" />}
      </div>
    </>
  );

  const cls =
    "flex items-start gap-3 rounded-[16px] border border-border bg-surface p-4 shadow-[0_4px_16px_rgba(0,0,0,0.18)]";
  if (href) {
    return (
      <Link
        href={href}
        className={`${cls} transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-rose/50 hover:shadow-[0_14px_30px_rgba(0,0,0,0.30)] [will-change:transform]`}
      >
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}
