"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Uber-style auto-hiding chrome. Hides on a sustained downward scroll, reveals
 * immediately on upward scroll, and re-reveals shortly after scrolling stops or
 * near the top. Passive listener + rAF; only reads scrollY (no layout thrash).
 *
 * `locked` keeps it visible regardless (e.g. while a modal/sheet/input is open).
 */
export function useHideOnScroll(opts?: { threshold?: number; topGuard?: number; idleMs?: number; locked?: boolean }): boolean {
  const threshold = opts?.threshold ?? 10; // ignore tiny/accidental moves
  const topGuard = opts?.topGuard ?? 80; // always visible near the top
  const idleMs = opts?.idleMs ?? 200; // reveal ~200ms after scrolling stops
  const locked = opts?.locked ?? false;

  const [scrollHidden, setScrollHidden] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (locked) return; // no listener while locked; return value forces visible
    lastY.current = window.scrollY;

    const evaluate = () => {
      const y = window.scrollY;
      const dy = y - lastY.current;

      if (y <= topGuard) setScrollHidden(false);
      else if (dy > threshold) setScrollHidden(true); // sustained scroll down → hide
      else if (dy < -threshold) setScrollHidden(false); // scroll up → reveal immediately
      lastY.current = y;

      // Reveal again shortly after scrolling stops.
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setScrollHidden(false), idleMs);

      ticking.current = false;
    };

    const onScroll = () => {
      if (!ticking.current) {
        ticking.current = true;
        requestAnimationFrame(evaluate);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [threshold, topGuard, idleMs, locked]);

  return locked ? false : scrollHidden;
}
