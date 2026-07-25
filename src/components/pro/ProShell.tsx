import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/format";
import { SparkleIcon, CalendarIcon, CreditCardIcon, UserIcon } from "@/components/ui/icons";
import { BackButton } from "@/components/ui/BackButton";
import { enterCustomerModeAction } from "@/lib/profile/mode-actions";

const NAV = [
  { href: "/pro/services", label: "Services", Icon: SparkleIcon },
  { href: "/pro/availability", label: "Availability", Icon: CalendarIcon },
  { href: "/pro/earnings", label: "Earnings", Icon: CreditCardIcon },
  { href: "/pro/profile", label: "Profile", Icon: UserIcon },
];

export function ProShell({
  active,
  isDemo = false,
  children,
}: {
  active: string;
  isDemo?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1100px] flex-col">
      <header className="topbar-safe sticky top-0 z-20 flex items-center gap-2 border-b border-border/60 bg-bg/85 px-3 backdrop-blur-md md:px-8">
        {/* Real back control — history-aware; when there's nowhere to go back to it
            returns to the customer account page. */}
        <BackButton fallback="/account" label="Back" className="flex-none" />
        <Link href="/pro/services" className="flex flex-none items-center" aria-label="iGlamHer pro">
          <Image src="/brand/logo-word.png" alt="iGlamHer" width={120} height={26} className="h-[22px] w-auto" priority />
          <span className="gold-glossy ml-2 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide">Pro</span>
        </Link>
        {/* Always-visible way out of professional mode — switches active_mode back to
            customer and lands on the customer profile, so pros never get stuck in /pro/*. */}
        <form action={enterCustomerModeAction} className="ml-auto flex-none">
          <button
            type="submit"
            className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-rose hover:text-rose"
          >
            Customer mode
          </button>
        </form>
      </header>

      {/* Folder-tab navigation — equal-width tabs that always fit the screen (no
          horizontal scroll). The selected tab is a raised gold folder. */}
      <nav className="flex items-stretch gap-1 border-b border-border px-2 pt-2 md:gap-1.5 md:px-6" aria-label="Professional dashboard">
        {NAV.map((n) => {
          const isActive = active === n.href;
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 overflow-hidden rounded-t-[10px] border border-b-0 px-1 text-center transition-all",
                isActive
                  ? "gold-metallic gold-edge -mb-px py-2 font-bold text-[#2a1c08] shadow-[0_-3px_14px_rgba(201,154,75,0.4)]"
                  : "border-border/50 bg-surface/50 py-1.5 text-ink-muted hover:bg-surface hover:text-ink",
              )}
            >
              {isActive && <span aria-hidden className="tab-shine" />}
              <n.Icon width={17} height={17} className={cn("relative", isActive ? "text-[#2a1c08]" : "text-ink-muted")} />
              <span className={cn("relative w-full truncate text-[11px] font-semibold leading-none sm:text-[12px]", isActive && "tab-label-pop font-bold")}>{n.label}</span>
            </Link>
          );
        })}
      </nav>

      <main id="main-content" className="flex-1 px-5 py-6 md:px-8 md:py-8">
        {isDemo && (
          <div className="mb-6 rounded-[12px] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-ink-secondary">
            Preview mode — showing a demo professional. Connect Supabase and sign in as a pro to manage a real account.
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
