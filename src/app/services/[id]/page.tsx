import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Shell } from "@/components/marketplace/Shell";
import { ServiceCard } from "@/components/marketplace/ServiceCard";
import { TrackView } from "@/components/marketplace/TrackView";
import { Rating } from "@/components/ui/Rating";
import { LinkButton } from "@/components/ui/Button";
import { VerifiedIcon } from "@/components/ui/icons";
import { getServiceWithProfessional } from "@/lib/data/professionals";
import { formatPrice, formatDuration } from "@/lib/format";

export const dynamic = "force-dynamic";

const LOCATION_LABEL: Record<string, string> = {
  in_salon: "At the studio",
  mobile: "Mobile — travels to you",
  both: "Studio or mobile",
};

export default async function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getServiceWithProfessional(id);
  if (!result) notFound();
  const { service, professional: pro } = result;
  const addons = pro.addons.filter((a) => a.isActive);

  return (
    <Shell back="/discover">
      <TrackView event="service_viewed" props={{ service: service.id, professional: pro.slug }} />

      <nav className="mb-4 text-sm text-ink-muted">
        <Link href={`/professionals/${pro.slug}`} className="text-rose hover:underline">
          ← {pro.displayName}
        </Link>
      </nav>

      <h1 className="font-display text-3xl font-bold leading-tight">{service.name}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
        <span className="font-semibold text-ink">{formatPrice(service.priceCents, { from: service.priceIsFrom })}</span>
        <span>· {formatDuration(service.durationMin)}</span>
        <span>· {LOCATION_LABEL[service.locationType]}</span>
        {service.instantBook && <span className="text-success">· Instant booking</span>}
      </div>

      {service.images[0] && (
        <div className="relative mt-5 aspect-[16/9] w-full overflow-hidden rounded-[16px] border border-border">
          <Image src={service.images[0]} alt={service.name} fill sizes="100vw" className="object-cover" />
        </div>
      )}

      {service.description && (
        <p className="mt-5 text-[15px] leading-relaxed text-ink-secondary">{service.description}</p>
      )}

      {addons.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-xl font-semibold">Add-ons</h2>
          <div className="space-y-2">
            {addons.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-[12px] border border-border bg-surface px-4 py-3">
                <span className="text-sm text-ink">{a.name}</span>
                <span className="text-sm font-semibold text-ink">+{formatPrice(a.priceCents)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 font-display text-xl font-semibold">Your professional</h2>
        <Link
          href={`/professionals/${pro.slug}`}
          className="flex items-center gap-3.5 rounded-[16px] border border-border bg-surface p-4 hover:border-rose/50"
        >
          <Image src={pro.avatarUrl} alt={pro.displayName} width={56} height={56} className="h-14 w-14 rounded-[14px] object-cover" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 font-display text-lg font-semibold">
              {pro.displayName}
              {pro.isVerified && <VerifiedIcon width={14} height={14} className="text-rose" />}
            </p>
            <p className="text-xs text-ink-muted">{pro.primarySpecialty}</p>
            <Rating average={pro.ratingAverage} count={pro.reviewCount} className="mt-1 text-[12px]" />
          </div>
        </Link>
      </section>

      <div className="mt-8">
        <LinkButton href={`/book/${pro.slug}?service=${service.id}`} full>
          Book this service
        </LinkButton>
        <p className="mt-2 text-center text-[11px] text-ink-muted">Deposit &amp; payment handled securely in the app.</p>
      </div>

      {pro.services.filter((s) => s.isActive && !s.isArchived && s.id !== service.id).length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-xl font-semibold">More from {pro.displayName}</h2>
          <div className="space-y-3">
            {pro.services
              .filter((s) => s.isActive && !s.isArchived && s.id !== service.id)
              .map((s) => (
                <ServiceCard key={s.id} service={s} href={`/services/${s.id}`} />
              ))}
          </div>
        </section>
      )}
    </Shell>
  );
}
