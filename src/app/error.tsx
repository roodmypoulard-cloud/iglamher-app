"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-2xl font-bold">Something went wrong</h1>
      <p className="text-sm text-ink-secondary">
        We hit an unexpected error loading this page. Please try again.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset} className="!w-auto px-8">
          Try again
        </Button>
        <button
          type="button"
          onClick={() => router.push("/discover")}
          className="rounded-full border border-border px-6 py-3 text-sm font-semibold text-ink active:scale-[0.98]"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}
