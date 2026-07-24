"use client";
import Link from "next/link";
import { track } from "@/lib/analytics";

/** Book Now CTA that fires `booking_started` before navigating to the book flow. */
export function TrackedBookNow({ slug, source }: { slug: string; source: string }) {
  return (
    <Link
      href={`/book/${slug}`}
      onClick={() => track("booking_started", { slug, source })}
      className="flex min-h-[44px] items-center justify-center rounded-full rose-gradient text-[12.5px] font-bold text-[#2A1712] shadow-[0_6px_16px_rgba(215,160,143,0.3)] transition-transform active:scale-[0.97]"
    >
      Book Now
    </Link>
  );
}
