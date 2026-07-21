import type { ReactNode } from "react";
import Link from "next/link";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { ChevronRight } from "@/components/ui/icons";
import { cn } from "@/lib/format";

/** Standard customer-facing page frame: header, constrained main, bottom nav. */
export function Shell({
  children,
  wide = false,
  bottomNav = true,
  header = true,
}: {
  children: ReactNode;
  wide?: boolean;
  bottomNav?: boolean;
  header?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex min-h-dvh w-full flex-col",
        wide ? "max-w-[1280px]" : "max-w-[440px] md:max-w-3xl lg:max-w-5xl",
      )}
    >
      {header && <AppHeader />}
      {/* Bottom padding clears the fixed BottomNav + the iPhone safe-area inset so
          content is never hidden behind it (nav is mobile-only → md:pb-12). */}
      <main
        className={cn("page-enter flex-1 px-5 pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:px-8 md:pb-12", header ? "pt-4" : "pt-0")}
      >
        {children}
      </main>
      {bottomNav && <BottomNav />}
    </div>
  );
}

export function SectionHeader({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex items-end justify-between first:mt-0">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      {aside && <div className="text-xs text-ink-muted">{aside}</div>}
    </div>
  );
}

/**
 * Soft Luxe section label — small uppercase, letter-spaced, with an optional
 * rose "See all" link. Matches the approved mockups (CATEGORIES, POPULAR NEAR YOU…).
 */
export function SectionLabel({ label, seeAllHref }: { label: string; seeAllHref?: string }) {
  return (
    <div className="mb-3 mt-7 flex items-center justify-between first:mt-2">
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-secondary">{label}</h2>
      {seeAllHref && (
        <Link href={seeAllHref} className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-rose hover:underline">
          See all
          <ChevronRight width={13} height={13} />
        </Link>
      )}
    </div>
  );
}
