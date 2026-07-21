import Image from "next/image";
import type { ReviewRow } from "@/lib/data/model";
import { Rating } from "@/components/ui/Rating";
import { VerifiedIcon } from "@/components/ui/icons";

export function ReviewCard({ review }: { review: ReviewRow }) {
  const date = new Date(review.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return (
    <figure className="card-luxe p-4">
      <div className="flex items-center justify-between">
        <figcaption className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-bg-elevated text-sm font-bold text-rose">
            {review.author.charAt(0)}
          </span>
          <span>
            <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-ink">
              {review.author}
              {review.verifiedBooking && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[10px] font-semibold text-success">
                  <VerifiedIcon width={10} height={10} /> Verified booking
                </span>
              )}
            </span>
            <span className="mt-0.5 block text-[11px] text-ink-muted">
              {review.serviceName ? `${review.serviceName} · ` : ""}
              {date}
            </span>
          </span>
        </figcaption>
        <Rating average={review.rating} showCount={false} />
      </div>

      {review.body && <blockquote className="mt-3 text-sm text-ink-secondary">{review.body}</blockquote>}

      {review.photos && review.photos.length > 0 && (
        <div className="mt-3 flex gap-2">
          {review.photos.map((src, i) => (
            <div key={i} className="relative h-16 w-16 flex-none overflow-hidden rounded-[10px] border border-border">
              <Image src={src} alt={`Review photo ${i + 1}`} fill sizes="64px" className="object-cover" />
            </div>
          ))}
        </div>
      )}

      {review.professionalResponse && (
        <div className="mt-3 rounded-[12px] border border-border bg-bg-elevated p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-rose">Response</p>
          <p className="mt-1 text-sm text-ink-secondary">{review.professionalResponse}</p>
        </div>
      )}
    </figure>
  );
}
