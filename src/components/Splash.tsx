"use client";
import { useEffect, useState } from "react";
import Image from "next/image";

/**
 * Luxury launch screen. Rendered in the initial HTML so the user never sees a bare
 * black screen, then fades into the app. Shows its full animation once per browser
 * session; on a same-session reload it dismisses instantly (no replay). Respects
 * prefers-reduced-motion (no glow/shine animation, just a quick fade).
 */
export function Splash() {
  const [phase, setPhase] = useState<"show" | "leaving" | "gone">("show");

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("iglamher-splash") === "1";
      sessionStorage.setItem("iglamher-splash", "1");
    } catch {
      /* private mode — just show it */
    }
    const hold = seen ? 0 : 1300;
    const leave = window.setTimeout(() => setPhase("leaving"), hold);
    const done = window.setTimeout(() => setPhase("gone"), hold + 460);
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(done);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[100] grid place-items-center bg-[#0B0909]"
      style={{
        transition: "opacity 440ms ease, visibility 440ms ease",
        opacity: phase === "leaving" ? 0 : 1,
        visibility: phase === "leaving" ? "hidden" : "visible",
      }}
    >
      <div className="relative splash-logo">
        {/* Soft animated rose-gold bloom behind the mark */}
        <span
          aria-hidden
          className="splash-glow pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[240px] w-[240px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose/25 blur-3xl"
        />
        <div className="relative overflow-hidden">
          <Image
            src="/brand/logo-word.png"
            alt="iGlamHer"
            width={900}
            height={347}
            priority
            className="h-auto w-[62vw] min-w-[200px] max-w-[300px] object-contain"
          />
          {/* Shimmering band of light sweeping across the wordmark */}
          <span aria-hidden className="splash-shine pointer-events-none absolute inset-0" />
        </div>
        <p className="mt-3 text-center text-[10px] font-semibold uppercase tracking-[0.36em] text-rose-light/70">
          Beauty on Demand
        </p>
      </div>
    </div>
  );
}
