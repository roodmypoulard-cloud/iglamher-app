"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { HomeIcon, CalendarIcon, ChatIcon } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/Avatar";
import { getViewerIdentityAction, type ViewerIdentity } from "@/lib/profile/identity";
import { cn } from "@/lib/format";
import { useHideOnScroll } from "@/lib/ui/useHideOnScroll";

const LEFT = [
  { href: "/discover", label: "Home", Icon: HomeIcon },
  { href: "/bookings", label: "Bookings", Icon: CalendarIcon },
];
const MESSAGES = { href: "/messages", label: "Messages", Icon: ChatIcon };

export function BottomNav() {
  const pathname = usePathname();
  const hidden = useHideOnScroll();
  const isActive = (href: string) => pathname === href || (href === "/discover" && pathname === "/");

  // Profile tab shows the signed-in customer's photo (initials fallback via Avatar).
  const [identity, setIdentity] = useState<ViewerIdentity | null>(null);
  useEffect(() => {
    let alive = true;
    getViewerIdentityAction()
      .then((id) => alive && setIdentity(id))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

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

        {/* Raised primary action — Create Job (Customer Job Marketplace) */}
        <li className="flex flex-1 flex-col items-center">
          <Link
            href="/requests"
            aria-label="Create a job request"
            aria-current={pathname.startsWith("/requests") ? "page" : undefined}
            className={cn(
              "fab-gold -mt-6 grid h-14 w-14 place-items-center rounded-full text-[#2A1712]",
              pathname.startsWith("/requests") && "ring-2 ring-rose/70 ring-offset-2 ring-offset-bg-elevated",
            )}
          >
            <span aria-hidden className="fab-gold-halo" />
            <span aria-hidden className="fab-gold-shine" />
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
            </svg>
          </Link>
          <span aria-hidden className={cn("mt-1 text-[10px] font-semibold", pathname.startsWith("/requests") ? "text-rose" : "text-ink-muted")}>
            Create
          </span>
        </li>

        {tab(MESSAGES.href, MESSAGES.label, MESSAGES.Icon)}

        {/* Profile — circular customer photo instead of a generic glyph. */}
        <li className="flex-1">
          <Link
            href="/profile"
            aria-current={isActive("/profile") ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-1 py-1 text-[10px] font-semibold transition-colors duration-200",
              isActive("/profile") ? "text-rose" : "text-ink-muted hover:text-ink-secondary",
            )}
          >
            <span
              className={cn(
                "grid h-[22px] w-[22px] place-items-center overflow-hidden rounded-full",
                isActive("/profile") && "ring-2 ring-rose",
              )}
            >
              <Avatar name={identity?.name} src={identity?.avatarUrl} size={22} />
            </span>
            Profile
          </Link>
        </li>
      </ul>
    </nav>
  );
}
