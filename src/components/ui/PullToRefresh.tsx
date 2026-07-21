"use client";
import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "./Spinner";

const THRESHOLD = 70;

/**
 * Touch pull-to-refresh. Only engages at scrollTop 0 and calls router.refresh()
 * (re-runs the server component). No-op with a mouse; touch devices only.
 */
export function PullToRefresh({ children }: { children: ReactNode }) {
  const router = useRouter();
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  function onTouchStart(e: React.TouchEvent) {
    if (window.scrollY <= 0 && !refreshing) startY.current = e.touches[0].clientY;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (startY.current == null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setPull(Math.min(THRESHOLD * 1.4, dy * 0.5));
  }
  function onTouchEnd() {
    if (pull >= THRESHOLD) {
      setRefreshing(true);
      setPull(THRESHOLD);
      router.refresh();
      window.setTimeout(() => {
        setRefreshing(false);
        setPull(0);
      }, 700);
    } else {
      setPull(0);
    }
    startY.current = null;
  }

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200"
        style={{ height: pull }}
        aria-hidden={!refreshing}
      >
        {(pull > 8 || refreshing) && <Spinner size={20} className={refreshing ? "" : "opacity-60"} />}
      </div>
      {children}
    </div>
  );
}
