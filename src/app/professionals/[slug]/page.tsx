import { notFound } from "next/navigation";
import Image from "next/image";
import type { Metadata } from "next";
import { AppHeader } from "@/components/marketplace/AppHeader";
import { BackButton } from "@/components/ui/BackButton";
import { ServiceCard } from "@/components/marketplace/ServiceCard";
import { ReviewCard } from "@/components/marketplace/ReviewCard";
import { RatingBreakdown } from "@/components/marketplace/RatingBreakdown";
import { FavoriteButton } from "@/components/marketplace/FavoriteButton";
import { AvailabilityPreview } from "@/components/marketplace/AvailabilityPreview";
import { TrackView } from "@/components/marketplace/TrackView";
import { Rating } from "@/components/ui/Rating";
import { TrustBadges, professionalBadges } from "@/components/trust/TrustBadges";
import { VerifiedIcon } from "@/components/ui/icons";
import { LinkButton } from "@/components/ui/Button";
import { getProfessionalBySlug } from "@/lib/data/professionals";
import { getFavoriteProfessionalIds } from "@/lib/data/favorites";
import { publicServices, publicPortfolio, publicReviews } from "@/lib/marketplace/visibility";
import { formatPrice } from "@/lib/format";
import { BADGE_META, isVerificationBadge } from "@/lib/trust/badges";
import {
  VERIFICATION_DISCLAIMER, PROFESSIONAL_RESPONSIBILITY_NOTE,
  ADDRESS_PRIVACY_NOTE, displayAddress,
} from "@/lib/pro/compliance";

export const dynamic = "force-dynamic";

const LOCATION_LABEL: Record<string, string> = {
  in_salon: "At the studio",
  mobile: "Mobile — travels to you",
  both: "Studio or mobile",
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const pro = await getProfessionalBySlug(slug);
  // notFound() here (pre-stream) keeps the HTTP status a real 404 — the route's
  // loading.tsx makes the body stream, so the page body's notFound() alone
  // would ship a 200 first.
  if (!pro) notFound();
  return {
    title: `${pro.displayName} · ${pro.primarySpecialty} · iGlamHer`,
    description: pro.bio.slice(0, 150),
  };
}

export default async function ProfessionalProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pro = await getProfessionalBySlug(slug);
  if (!pro) notFound();

  const favoritedIds = await getFavoriteProfessionalIds();
  const favorited = favoritedIds.includes(pro.userId);

  const badges = professionalBadges(pro);
  // C3: this is a pre-booking surface, so the audience is always "public" — the
  // exact street address is never rendered here, only the approximate area.
  const location = displayAddress(
    { neighborhood: pro.neighborhood, city: pro.city, postalCode: pro.postalCode },
    { audience: "public", hideExactPin: pro.hideExactPin },
  );

  const services = publicServices(pro);
  const portfolio = publicPortfolio(pro);
  const reviews = publicReviews(pro);
  const startingCents = services.length ? Math.min(...services.map((s) => s.priceCents)) : 0;
  const shortest = services.reduce((a, b) => (b.durationMin < a.durationMin ? b : a), services[0]);

  const availabilityConfig = {
    timezone: pro.timezone,
    rules: pro.availability,
    exceptions: pro.exceptions,
    minNoticeMinutes: 120,
    maxWindowDays: 60,
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1280px] flex-col overflow-x-clip">
      <AppHeader />
      <TrackView
        event="professional_viewed"
        props={{ professional: pro.slug, verified: pro.isVerified }}
        recordProfessionalId={pro.userId}
      />

      {/* Hero — cinematic cover blended into the palette */}
      <div className="relative aspect-[16/8] w-full overflow-hidden md:aspect-[16/6] md:rounded-b-[28px]">
        <div className="absolute left-4 top-4 z-20" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <BackButton fallback="/categories" />
        </div>
        <div className="ken-burns absolute inset-0">
          <Image src={pro.coverUrl || pro.avatarUrl} alt="" fill sizes="100vw" className="img-luxe object-cover" priority />
        </div>
        {/* Warm champagne bloom */}
        <div className="absolute inset-0 bg-[radial-gradient(60%_70%_at_50%_20%,rgba(231,201,146,0.12),transparent_72%)]" />
        {/* Bottom fade so the avatar and name read cleanly */}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/45 to-transparent" />
        {/* Whisper vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(130%_100%_at_50%_30%,transparent_62%,rgba(11,9,9,0.34)_100%)]" />
        {/* Rose-gold rim along the bottom transition */}
        <div aria-hidden className="absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-rose/50 to-transparent" />
      </div>

      <div className="page-enter grid gap-8 px-5 pb-32 md:px-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:pb-12">
        {/* Main column */}
        <div className="min-w-0 space-y-8">
          <header className="flex items-end gap-4">
            <Image
              src={pro.avatarUrl}
              alt=""
              width={104}
              height={104}
              className="img-luxe -mt-16 h-26 w-26 flex-none rounded-[22px] border-2 border-bg object-cover shadow-luxe ring-1 ring-rose/40"
            />
            <div className="min-w-0 flex-1 pb-1">
              <h1 className="font-display text-[28px] font-bold leading-[1.12] tracking-[-0.01em]">
                <span className="align-middle">{pro.displayName}</span>
                {pro.isVerified && (
                  <VerifiedIcon width={18} height={18} className="ml-1.5 inline-block align-middle text-rose" />
                )}
              </h1>
              <p className="mt-0.5 text-sm text-ink-secondary">{pro.primarySpecialty}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-muted">
                <Rating average={pro.ratingAverage} count={pro.reviewCount} />
                <span>· {pro.city}</span>
                <span>· {LOCATION_LABEL[pro.locationType]}</span>
              </div>
            </div>
          </header>

          {/* Trust badges — one per admin-checked fact, never a blanket claim */}
          <TrustBadges badges={badges} />

          {/* Verification disclaimer — never claims iGlamHer authorized the pro
              to operate (spec §11). Spells out badge-by-badge what was actually
              checked, so the short labels above can't be read as a guarantee. */}
          {pro.isVerified && (
            <details className="group -mt-4 text-[11.5px] text-ink-muted">
              <summary className="cursor-pointer list-none font-medium text-ink-secondary underline-offset-2 hover:underline">What do these badges mean?</summary>
              {badges.filter(isVerificationBadge).length > 0 && (
                <ul className="mt-1.5 max-w-prose space-y-1 leading-relaxed">
                  {badges.filter(isVerificationBadge).map((b) => (
                    <li key={b}>
                      <span className="font-semibold text-ink-secondary">{BADGE_META[b].label}:</span> {BADGE_META[b].description}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-1.5 max-w-prose leading-relaxed">{VERIFICATION_DISCLAIMER}</p>
              <p className="mt-1.5 max-w-prose leading-relaxed">{PROFESSIONAL_RESPONSIBILITY_NOTE}</p>
            </details>
          )}

          {/* Meta chips — frosted glass, thin rose-gold rim */}
          <div className="flex flex-wrap gap-2.5 text-[12.5px]">
            {/* C4: "Verified pro" claimed blanket verification off one flag. The
                seal only means the application was reviewed and approved; the
                specific checks are the labeled TrustBadges above. */}
            {pro.isVerified && (
              <span
                title="iGlamHer reviewed and approved this professional's application."
                className="rounded-full border border-rose/40 bg-rose/12 px-3.5 py-1.5 font-medium text-rose backdrop-blur-sm"
              >
                Application approved
              </span>
            )}
            {pro.yearsExperience > 0 && (
              <span className="rounded-full border border-rose/20 bg-white/[0.04] px-3.5 py-1.5 text-ink-secondary shadow-[0_2px_8px_rgba(0,0,0,0.18)] backdrop-blur-sm">
                {pro.yearsExperience} yrs experience
              </span>
            )}
            {pro.jobsCompleted > 0 && (
              <span className="rounded-full border border-rose/20 bg-white/[0.04] px-3.5 py-1.5 text-ink-secondary shadow-[0_2px_8px_rgba(0,0,0,0.18)] backdrop-blur-sm">
                {pro.jobsCompleted}+ appointments
              </span>
            )}
            {pro.languages.length > 0 && (
              <span className="rounded-full border border-rose/20 bg-white/[0.04] px-3.5 py-1.5 text-ink-secondary shadow-[0_2px_8px_rgba(0,0,0,0.18)] backdrop-blur-sm">
                Speaks {pro.languages.join(", ")}
              </span>
            )}
          </div>

          {pro.bio && (
            <section>
              <h2 className="mb-2 font-display text-xl font-semibold">About</h2>
              <p className="text-[15px] leading-relaxed text-ink-secondary">{pro.bio}</p>
              {pro.specialties.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {pro.specialties.map((s) => (
                    <span key={s} className="rounded-full bg-bg-elevated px-3 py-1 text-[12px] text-ink-muted">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </section>
          )}

          {services.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-xl font-semibold">Services</h2>
              <div className="space-y-3">
                {services.map((s) => (
                  <ServiceCard key={s.id} service={s} href={`/services/${s.id}`} />
                ))}
              </div>
            </section>
          )}

          {portfolio.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-xl font-semibold">Portfolio</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {portfolio.map((item) => (
                  <div
                    key={item.id}
                    className="group relative aspect-square overflow-hidden rounded-[18px] border border-border/80 bg-bg-elevated shadow-[0_8px_24px_rgba(0,0,0,0.22)] transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(0,0,0,0.34)] [will-change:transform]"
                  >
                    {item.url ? (
                      <Image
                        src={item.url}
                        alt={item.caption ?? `${pro.displayName} work`}
                        fill
                        sizes="(max-width: 640px) 50vw, 33vw"
                        className="img-luxe object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-xs uppercase tracking-wide text-ink-muted">
                        {item.kind}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section id="availability">
            <h2 className="mb-3 font-display text-xl font-semibold">Availability</h2>
            {pro.availability.length > 0 && services.length > 0 ? (
              <AvailabilityPreview
                professionalSlug={pro.slug}
                config={availabilityConfig}
                durationMin={shortest.durationMin}
                bufferBeforeMin={shortest.bufferBeforeMin}
                bufferAfterMin={shortest.bufferAfterMin}
              />
            ) : (
              <p className="text-sm text-ink-muted">This professional hasn&apos;t published hours yet.</p>
            )}
          </section>

          {reviews.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-xl font-semibold">
                Reviews <span className="text-ink-muted">({pro.reviewCount})</span>
              </h2>
              <div className="mb-4">
                <RatingBreakdown reviews={reviews} average={pro.ratingAverage} total={pro.reviewCount} />
              </div>
              <div className="space-y-3">
                {reviews.map((r) => (
                  <ReviewCard key={r.id} review={r} />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-3 font-display text-xl font-semibold">Business info</h2>
            <div className="card-luxe divide-y divide-border/60">
              <InfoRow label="Service area" value={`${location.text} · ${pro.serviceRadiusMiles} mi radius`} />
              {!location.exact && (
                <p className="px-4 py-2.5 text-[11.5px] leading-snug text-ink-muted">{ADDRESS_PRIVACY_NOTE}</p>
              )}
              <InfoRow label="Response time" value="Usually within a few hours" />
              <InfoRow label="Booking" value={pro.instantBook ? "Instant booking available" : "Requests confirmed by pro"} />
              {pro.instagramHandle && (
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-ink-muted">Social</span>
                  <div className="flex items-center gap-3 text-sm">
                    <a
                      href={`https://instagram.com/${pro.instagramHandle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-rose hover:underline"
                    >
                      @{pro.instagramHandle}
                    </a>
                    <span className="text-ink-muted">{pro.igFollowerCount} followers</span>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-2 font-display text-xl font-semibold">Cancellation policy</h2>
            <p className="text-sm text-ink-secondary">{pro.cancellationPolicy}</p>
          </section>
        </div>

        {/* Desktop sticky booking panel */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-[24px] border border-rose/20 bg-white/[0.04] p-6 shadow-luxe backdrop-blur-xl">
            <p className="text-sm text-ink-muted">Starting from</p>
            <p className="font-display text-[34px] font-bold leading-tight">{formatPrice(startingCents)}</p>
            <div className="mt-4 space-y-3">
              <LinkButton href={`/book/${pro.slug}`} full>
                Book now
              </LinkButton>
              <FavoriteButton
                professionalId={pro.userId}
                professionalSlug={pro.slug}
                initialFavorited={favorited}
                variant="inline"
              />
            </div>
            <p className="mt-4 text-center text-[11px] text-ink-muted">Secure booking &amp; payment in the app.</p>
          </div>
        </aside>
      </div>

      {/* Mobile sticky CTA */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between gap-3 border-t border-rose/15 bg-bg/80 px-5 py-3 shadow-[0_-10px_36px_rgba(0,0,0,0.45)] backdrop-blur-2xl lg:hidden"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <div>
          <p className="text-[11px] text-ink-muted">From</p>
          <p className="font-display text-xl font-bold">{formatPrice(startingCents)}</p>
        </div>
        <div className="flex items-center gap-2">
          <FavoriteButton professionalId={pro.userId} professionalSlug={pro.slug} initialFavorited={favorited} size={44} />
          <LinkButton href={`/book/${pro.slug}`}>Book now</LinkButton>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="text-sm font-medium text-ink">{value}</span>
    </div>
  );
}
