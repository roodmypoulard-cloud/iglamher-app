import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Shell } from "@/components/marketplace/Shell";
import { BackButton } from "@/components/ui/BackButton";
import { EmptyState } from "@/components/ui/states";
import { VerifiedIcon } from "@/components/ui/icons";
import { getPublicReviews, type PublicReview } from "@/lib/reviews/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Real Reviews · iGlamHer" };

export default async function ReviewsPage() {
  const reviews = await getPublicReviews();

  return (
    <Shell>
      <div className="mb-5">
        <BackButton fallback="/discover" label="Home" />
      </div>

      <header className="mb-6">
        <h1 className="font-display text-[28px] font-bold leading-[1.12] tracking-[-0.01em]">Real Reviews</h1>
        <p className="mt-1 text-sm text-ink-secondary">Verified reviews from completed bookings.</p>
      </header>

      {reviews.length === 0 ? (
        <EmptyState
          title="No reviews yet"
          body="Once clients start leaving reviews for completed bookings, they'll shine here. Explore our pros in the meantime."
          action={{ label: "Explore pros", href: "/discover" }}
        />
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <ReviewShowcaseCard key={review.id} review={review} />
          ))}
        </div>
      )}
    </Shell>
  );
}

function ReviewShowcaseCard({ review }: { review: PublicReview }) {
  const date = new Date(review.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return (
    <figure className="card-luxe p-4">
      <div className="flex items-start justify-between gap-3">
        <figcaption className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="grid h-9 w-9 flex-none place-items-center rounded-full bg-bg-elevated text-sm font-bold text-rose"
          >
            {review.customerInitials}
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-ink">
              {review.customerName}
              {review.verified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[10px] font-semibold text-success">
                  <VerifiedIcon width={10} height={10} /> Verified Booking
                </span>
              )}
            </span>
            <span className="mt-0.5 block truncate text-[11px] text-ink-muted">
              for{" "}
              {review.providerSlug ? (
                <Link
                  href={`/professionals/${review.providerSlug}`}
                  className="inline-flex min-h-[44px] items-center font-semibold text-rose hover:underline"
                >
                  {review.providerName}
                </Link>
              ) : (
                <span className="font-semibold text-ink-secondary">{review.providerName}</span>
              )}
              {" · "}
              {date}
            </span>
          </span>
        </figcaption>
        <Stars rating={review.rating} />
      </div>

      {review.body && <blockquote className="mt-3 text-sm text-ink-secondary">{review.body}</blockquote>}

      {review.photos.length > 0 && (
        <div className="mt-3 flex gap-2">
          {review.photos.map((src, i) => (
            <div key={i} className="relative h-16 w-16 flex-none overflow-hidden rounded-[10px] border border-border">
              <Image src={src} alt={`Review photo ${i + 1}`} fill sizes="64px" className="object-cover" />
            </div>
          ))}
        </div>
      )}
    </figure>
  );
}

/** Five stars, filled up to `rating`. Single accessible label; stars are decorative. */
function Stars({ rating }: { rating: number }) {
  return (
    <span
      role="img"
      aria-label={`${rating} out of 5 stars`}
      className="flex flex-none items-center gap-0.5 text-sm leading-none"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} aria-hidden className={n <= rating ? "text-rose" : "text-border"}>
          ★
        </span>
      ))}
    </span>
  );
}
