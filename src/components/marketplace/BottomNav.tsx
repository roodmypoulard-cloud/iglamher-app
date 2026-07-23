"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, CalendarIcon, ChatIcon, UserIcon } from "@/components/ui/icons";
import { cn } from "@/lib/format";
import { useHideOnScroll } from "@/lib/ui/useHideOnScroll";

const LEFT = [
  { href: "/discover", label: "Home", Icon: HomeIcon },
  { href: "/bookings", label: "Bookings", Icon: CalendarIcon },
];
const RIGHT = [
  { href: "/messages", label: "Messages", Icon: ChatIcon },
  { href: "/profile", label: "Profile", Icon: UserIcon },
];

export function BottomNav() {
  const pathname = usePathname();
  const hidden = useHideOnScroll();
  const isActive = (href: string) => pathname === href || (href === "/discover" && pathname === "/");

  const tab = (href: string, label: string, Icon: typeof HomeIcon) => (
    <li key={href} className="flex-1">
      <Link
        href={href}
        aria-current={isActive(href) ? "page" : undefined}
        className={cn(
          "flex flex-col items-center gap-1 py-1 text-[10px] font-semibold transition-colors duration-200",
          isActive(href) ? "text-rose" : "text-ink-muted hover:text-ink-secondary",
        )}
      >
        <Icon width={22} height={22} />
        {label}
      </Link>
    </li>
  );

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed bottom-0 left-1/2 z-30 w-full max-w-[440px] -translate-x-1/2 border-t border-border bg-bg-elevated md:hidden",
        "transition-[transform,opacity] duration-300 ease-out will-change-transform motion-reduce:transition-none",
        hidden ? "translate-y-[135%] opacity-0" : "translate-y-0 opacity-100",
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-end px-2 pb-2 pt-2">
        {LEFT.map((t) => tab(t.href, t.label, t.Icon))}

        {/* Raised primary action — find & book */}
        <li className="flex flex-1 justify-center">
          <Link
            href="/search"
            aria-label="Find a professional"
            className="-mt-6 grid h-14 w-14 place-items-center rounded-full rose-gradient text-[#2A1712] shadow-[0_10px_26px_rgba(215,160,143,0.4)] transition-transform duration-200 active:scale-95"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
            </svg>
          </Link>
        </li>

        {RIGHT.map((t) => tab(t.href, t.label, t.Icon))}
      </ul>
    </nav>
  );
}
