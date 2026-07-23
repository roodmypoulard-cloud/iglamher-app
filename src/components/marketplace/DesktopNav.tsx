"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/format";

// Primary marketplace navigation for desktop (md+). On mobile the BottomNav handles
// this, so these links are hidden below the md breakpoint.
const LINKS = [
  { href: "/discover", label: "Discover" },
  { href: "/bookings", label: "Bookings" },
  { href: "/messages", label: "Messages" },
  { href: "/account/favorites", label: "Favorites" },
];

export function DesktopNav({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`) || (href === "/discover" && pathname === "/");

  return (
    <nav aria-label="Main" className={cn("hidden items-center gap-1 md:flex", className)}>
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={isActive(l.href) ? "page" : undefined}
          className={cn(
            "rounded-full px-3.5 py-2 text-sm font-semibold transition-colors duration-200",
            isActive(l.href) ? "text-rose" : "text-ink-secondary hover:text-ink",
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
