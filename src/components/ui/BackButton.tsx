"use client";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "@/components/ui/icons";

/**
 * Consistent luxury back control for inner pages. Uses in-app history when a real
 * previous route exists; otherwise navigates to a safe fallback so a directly-opened
 * page never lands on a blank/broken screen. Do not use on root-level tabs.
 */
export function BackButton({
  fallback = "/discover",
  label,
  className = "",
}: {
  fallback?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();

  const onBack = () => {
    // history.length > 1 means we arrived here via an in-app navigation.
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(fallback);
  };

  return (
    <button
      type="button"
      onClick={onBack}
      aria-label={label ? undefined : "Go back"}
      className={
        "inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border bg-surface/80 px-3.5 py-2 text-sm font-semibold text-ink backdrop-blur transition-colors hover:border-rose/50 active:scale-[0.98] " +
        className
      }
    >
      <ChevronLeft width={18} height={18} className="text-rose" />
      {label && <span>{label}</span>}
    </button>
  );
}
