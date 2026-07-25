"use client";
import { useEffect } from "react";

export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-xl font-bold text-ink">This admin view failed to load.</h1>
      <p className="mt-1.5 text-[13px] text-ink-secondary">Try again, or check the server logs if it keeps happening.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 flex min-h-[46px] items-center rounded-full rose-gradient px-6 text-[13.5px] font-bold text-[#2A1712] active:scale-[0.98]"
      >
        Try again
      </button>
    </div>
  );
}
