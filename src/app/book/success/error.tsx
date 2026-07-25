"use client";
import { useEffect } from "react";
import Link from "next/link";

export default function BookSuccessError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-xl font-bold text-ink">We couldn&apos;t load your confirmation.</h1>
      <p className="mt-1.5 text-[13px] text-ink-secondary">
        Your payment may still have gone through — check your bookings before paying again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 flex min-h-[46px] items-center rounded-full rose-gradient px-6 text-[13.5px] font-bold text-[#2A1712] active:scale-[0.98]"
      >
        Try again
      </button>
      <Link href="/bookings" className="mt-3 text-[13px] font-semibold text-ink underline-offset-4 hover:underline">
        View my bookings
      </Link>
    </main>
  );
}
