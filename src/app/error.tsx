"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-2xl font-bold">Something went wrong</h1>
      <p className="text-sm text-ink-secondary">
        We hit an unexpected error loading this page. Please try again.
      </p>
      <Button onClick={reset} className="!w-auto px-8">
        Try again
      </Button>
    </div>
  );
}
