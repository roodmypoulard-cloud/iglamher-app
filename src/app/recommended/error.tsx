"use client";
// Error state for the Recommended page — spec: never a dead end.
export default function RecommendedError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-xl font-bold text-ink">We couldn&apos;t load recommendations.</h1>
      <p className="mt-1.5 text-[13px] text-ink-secondary">Something went wrong on our side. Give it another try.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 flex min-h-[46px] items-center rounded-full rose-gradient px-6 text-[13.5px] font-bold text-[#2A1712] active:scale-[0.98]"
      >
        Try again
      </button>
    </main>
  );
}
