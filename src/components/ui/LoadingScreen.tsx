"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/marketplace/Shell";

/**
 * Route loading fallback with a hard backstop. Renders the app chrome (header +
 * bottom nav) around a content skeleton so navigation never flashes a full-screen
 * dark screen. If the destination hasn't finished after `timeoutMs`, it swaps the
 * skeleton for a recoverable error state — so a hung request can NEVER leave the
 * user staring at a skeleton forever. Next.js unmounts this the instant the real
 * page is ready, so on a healthy load the backstop never fires.
 */
export function LoadingScreen({ children, timeoutMs = 10000 }: { children: ReactNode; timeoutMs?: number }) {
  const [stuck, setStuck] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => setStuck(true), timeoutMs);
    return () => clearTimeout(t);
  }, [timeoutMs]);

  if (stuck) {
    return (
      <Shell>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="font-display text-xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-ink-secondary">This is taking longer than usual. Check your connection and try again.</p>
          <div className="mt-1 flex gap-3">
            <button
              type="button"
              onClick={() => { setStuck(false); router.refresh(); }}
              className="rounded-full rose-gradient px-6 py-2.5 text-sm font-semibold text-[#2A1712] active:scale-[0.98]"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => router.push("/discover")}
              className="rounded-full border border-border px-6 py-2.5 text-sm font-semibold text-ink active:scale-[0.98]"
            >
              Back to Home
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  return <Shell>{children}</Shell>;
}
