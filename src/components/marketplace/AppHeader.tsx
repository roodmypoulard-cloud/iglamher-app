import Link from "next/link";
import Image from "next/image";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { DesktopNav } from "@/components/marketplace/DesktopNav";

export function AppHeader() {
  return (
    <header className="topbar-safe sticky top-0 z-20 flex min-h-[72px] items-center justify-between gap-3 border-b border-border/60 bg-bg px-5 md:bg-bg/85 md:px-8 md:backdrop-blur-md">
      <Link href="/discover" aria-label="iGlamHer home" className="flex min-w-0 items-center py-1">
        <span className="fade-in inline-flex flex-col items-center">
          {/* Wrapper hugs the logo so the ambient glow scopes to the mark, and never clips it. */}
          <span className="relative inline-flex items-center">
            {/* Extremely soft rose-gold ambient bloom behind the mark — quiet lighting, no harsh shadow. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10 scale-[1.3] rounded-full bg-rose/15 blur-3xl"
            />
            <Image
              src="/brand/logo-word.png"
              alt="iGlamHer"
              width={900}
              height={347}
              priority
              className="h-auto w-[53vw] min-w-[170px] max-w-[230px] object-contain"
            />
          </span>
          <span className="mt-0.5 text-[8.5px] font-semibold uppercase tracking-[0.34em] text-rose-light/80">
            Beauty on Demand
          </span>
        </span>
      </Link>
      <DesktopNav className="mx-auto" />
      <div className="flex flex-none items-center gap-4">
        <NotificationBell />
        {/* Account & settings entry — profile itself lives on the bottom-nav Profile tab. */}
        <Link
          href="/profile/settings"
          aria-label="Account settings"
          className="menu-gold grid h-11 w-11 place-items-center rounded-full border border-rose/30 bg-surface/60"
        >
          <span aria-hidden className="flex w-[18px] flex-col gap-[4.5px]">
            <span className="menu-gold-bar" />
            <span className="menu-gold-bar" />
            <span className="menu-gold-bar" />
          </span>
        </Link>
      </div>
    </header>
  );
}
