"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/format";

type SVGProps = { className?: string };
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const I = {
  dashboard: (p: SVGProps) => <svg viewBox="0 0 24 24" width={17} height={17} {...stroke} className={p.className} aria-hidden><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="5" rx="2" /><rect x="13" y="10" width="8" height="11" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /></svg>,
  applications: (p: SVGProps) => <svg viewBox="0 0 24 24" width={17} height={17} {...stroke} className={p.className} aria-hidden><path d="M9 3h6l1 3h3v15H5V6h3l1-3Z" /><path d="M9 12h6M9 16h4" /></svg>,
  verifications: (p: SVGProps) => <svg viewBox="0 0 24 24" width={17} height={17} {...stroke} className={p.className} aria-hidden><path d="M12 2 4 6v6c0 5 8 10 8 10s8-5 8-10V6l-8-4Z" /><path d="m9 12 2 2 4-4" /></svg>,
  recommendations: (p: SVGProps) => <svg viewBox="0 0 24 24" width={17} height={17} {...stroke} className={p.className} aria-hidden><path d="M4 17h16l-1-7.5-3.6 2.8L12 6l-3.4 6.3L5 9.5 4 17Z" /><path d="M4 19.4h16" /></svg>,
  disputes: (p: SVGProps) => <svg viewBox="0 0 24 24" width={17} height={17} {...stroke} className={p.className} aria-hidden><path d="M12 3 2 21h20L12 3Z" /><path d="M12 10v5M12 18v.5" /></svg>,
  analytics: (p: SVGProps) => <svg viewBox="0 0 24 24" width={17} height={17} {...stroke} className={p.className} aria-hidden><path d="M4 20V10M10 20V4M16 20v-9M21 20H3" /></svg>,
  integrations: (p: SVGProps) => <svg viewBox="0 0 24 24" width={17} height={17} {...stroke} className={p.className} aria-hidden><path d="M9 3v4a2 2 0 0 1-2 2H3M15 21v-4a2 2 0 0 1 2-2h4M3 15h4a2 2 0 0 1 2 2v4M21 9h-4a2 2 0 0 1-2-2V3" /></svg>,
  professionals: (p: SVGProps) => <svg viewBox="0 0 24 24" width={17} height={17} {...stroke} className={p.className} aria-hidden><circle cx="9" cy="8" r="3.4" /><path d="M3 20c0-3.3 2.7-5.6 6-5.6s6 2.3 6 5.6" /><path d="M16.5 8.5 18 10l3-3" /></svg>,
  customers: (p: SVGProps) => <svg viewBox="0 0 24 24" width={17} height={17} {...stroke} className={p.className} aria-hidden><circle cx="8.5" cy="8" r="3.2" /><circle cx="16.5" cy="9.5" r="2.6" /><path d="M2.5 20c0-3 2.6-5.3 6-5.3 2 0 3.7.8 4.8 2M13 20c.3-2.4 2-4 4.3-4 2 0 3.7 1.3 4.2 3.2" /></svg>,
  settings: (p: SVGProps) => <svg viewBox="0 0 24 24" width={17} height={17} {...stroke} className={p.className} aria-hidden><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.5a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.5h4l.4-2.5a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z" /></svg>,
  audit: (p: SVGProps) => <svg viewBox="0 0 24 24" width={17} height={17} {...stroke} className={p.className} aria-hidden><path d="M6 3h9l4 4v14H6V3Z" /><path d="M15 3v4h4M9 12h6M9 16h6" /></svg>,
  help: (p: SVGProps) => <svg viewBox="0 0 24 24" width={17} height={17} {...stroke} className={p.className} aria-hidden><circle cx="12" cy="12" r="9" /><path d="M9.5 9.3a2.6 2.6 0 0 1 5 .9c0 1.6-2.3 2-2.3 3.3M12 17v.4" /></svg>,
};

const NAV: Array<{ href: string; label: string; icon: keyof typeof I; badge?: string }> = [
  { href: "/admin", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/applications", label: "Applications", icon: "applications" },
  { href: "/admin/verifications", label: "Verifications", icon: "verifications" },
  { href: "/admin/recommendations", label: "Recommendations", icon: "recommendations", badge: "New" },
  { href: "/admin/disputes", label: "Disputes", icon: "disputes" },
  { href: "/admin/analytics", label: "Analytics", icon: "analytics" },
  { href: "/admin/integrations", label: "Integrations", icon: "integrations" },
  { href: "/admin/professionals", label: "Professionals", icon: "professionals" },
  { href: "/admin/customers", label: "Customers", icon: "customers" },
  { href: "/admin/settings", label: "Settings", icon: "settings" },
  { href: "/admin/audit-log", label: "Audit Logs", icon: "audit" },
];

const TITLES: Array<[string, string, string]> = [
  ["/admin/applications", "Admin · Applications & Recommendations", "Review professional applications, verify identity, and manage paid featured recommendations."],
  ["/admin/verifications", "Admin · Customer Verifications", "Review customer identity checks and award the verified badge."],
  ["/admin/recommendations", "Admin · Featured Recommendations", "Manage the $2.99/month featured placement program and its revenue."],
  ["/admin/disputes", "Admin · Disputes & Reports", "Resolve booking disputes and moderation reports."],
  ["/admin/analytics", "Admin · Analytics", "Marketplace performance across bookings, revenue and growth."],
  ["/admin/integrations", "Admin · Integrations", "What's connected, what's waiting on configuration."],
  ["/admin/professionals", "Admin · Professionals", "Activate, feature and manage professional accounts."],
  ["/admin/customers", "Admin · Customers", "Look up customer accounts and their status."],
  ["/admin/settings", "Admin · Platform Settings", "Kill switches and operational controls."],
  ["/admin/audit-log", "Admin · Audit Logs", "Every privileged action, who did it, and when."],
  ["/admin/search", "Admin · Search", "Results across professionals and customers."],
  ["/admin", "Admin · Operations Dashboard", "Queues, metrics and platform health at a glance."],
];

export function AdminShell({
  children,
  adminName,
  adminAvatarUrl,
  pendingCount,
}: {
  children: React.ReactNode;
  adminName: string;
  adminAvatarUrl: string | null;
  pendingCount: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [q, setQ] = useState("");

  const [, title, subtitle] = TITLES.find(([p]) => (p === "/admin" ? pathname === "/admin" : pathname.startsWith(p))) ?? TITLES[TITLES.length - 1];
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const sidebar = (
    <nav aria-label="Admin sections" className="flex h-full flex-col">
      <Link href="/admin" className="flex items-center gap-2 px-5 pb-5 pt-6">
        <span className="grid h-8 w-8 place-items-center rounded-full gold-glossy" aria-hidden>
          <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M4 17h16l-1-7.5-3.6 2.8L12 6l-3.4 6.3L5 9.5 4 17Z" /></svg>
        </span>
        <span>
          <span className="block font-display text-[17px] font-bold leading-none text-ink">iGlamHer</span>
          <span className="mt-0.5 block text-[8px] font-bold uppercase tracking-[0.3em] text-rose">Admin</span>
        </span>
      </Link>

      <div className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {NAV.map((n) => {
          const Icon = I[n.icon];
          const active = isActive(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              onClick={() => setNavOpen(false)}
              className={cn(
                "flex min-h-[40px] items-center gap-2.5 rounded-[10px] px-3 text-[13px] font-semibold transition-colors",
                active ? "gold-glossy text-[#2a1c08]" : "text-ink-secondary hover:bg-surface hover:text-ink",
              )}
            >
              <Icon className={active ? "text-[#2a1c08]" : "text-rose"} />
              <span className="flex-1">{n.label}</span>
              {n.badge && !active && (
                <span className="rounded-full bg-rose/15 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-rose">{n.badge}</span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="p-4">
        <a
          href="mailto:support@iglamher.com?subject=Admin%20support"
          className="flex min-h-[40px] items-center gap-2.5 rounded-[10px] px-3 text-[13px] font-semibold text-ink-secondary transition-colors hover:bg-surface hover:text-ink"
        >
          <I.help className="text-rose" />
          Help &amp; Support
        </a>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-dvh bg-bg">
      {/* Fixed sidebar — desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[218px] border-r border-border/70 bg-bg-elevated lg:block">
        {sidebar}
      </aside>
      {/* Drawer — tablet/mobile */}
      {navOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Admin navigation">
          <div className="w-[240px] border-r border-border bg-bg-elevated">{sidebar}</div>
          <button type="button" aria-label="Close navigation" className="flex-1 bg-black/60" onClick={() => setNavOpen(false)} />
        </div>
      )}

      <div className="min-w-0 flex-1 lg:pl-[218px]">
        {/* Top header */}
        <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/90 backdrop-blur-md">
          <div className="flex items-center gap-3 px-4 py-3 md:px-6">
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              aria-label="Open navigation"
              className="grid h-9 w-9 flex-none place-items-center rounded-[10px] border border-border text-ink-secondary lg:hidden"
            >
              <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-[17px] font-bold leading-tight text-ink md:text-[19px]">{title}</h1>
              <p className="hidden truncate text-[11.5px] text-ink-muted md:block">{subtitle}</p>
            </div>

            <form
              role="search"
              className="hidden md:block"
              onSubmit={(e) => {
                e.preventDefault();
                if (q.trim()) router.push(`/admin/search?q=${encodeURIComponent(q.trim())}`);
              }}
            >
              <div className="relative">
                <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.7-3.7" /></svg>
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search professionals, customers…"
                  aria-label="Search admin records"
                  className="w-[230px] rounded-[10px] border border-border bg-surface py-2 pl-9 pr-3 text-[12.5px] text-ink placeholder:text-ink-muted focus:border-rose focus:outline-none xl:w-[280px]"
                />
              </div>
            </form>

            <Link href="/admin/applications" aria-label={`${pendingCount} items awaiting review`} className="relative grid h-9 w-9 flex-none place-items-center rounded-[10px] border border-border text-ink-secondary transition-colors hover:border-rose/50">
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
              {pendingCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 grid h-4.5 min-w-[18px] place-items-center rounded-full bg-rose px-1 text-[9.5px] font-extrabold text-[#2A1712]">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
            </Link>

            <div className="flex flex-none items-center gap-2.5">
              {adminAvatarUrl ? (
                <Image src={adminAvatarUrl} alt="" width={34} height={34} className="h-[34px] w-[34px] rounded-full object-cover ring-1 ring-rose/40" />
              ) : (
                <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-rose/15 text-[13px] font-bold text-rose ring-1 ring-rose/40" aria-hidden>
                  {adminName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="hidden text-right xl:block">
                <span className="block text-[12.5px] font-bold leading-tight text-ink">{adminName}</span>
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-rose">Admin</span>
              </span>
            </div>
          </div>
        </header>

        <main className="px-4 py-5 md:px-6">{children}</main>
      </div>
    </div>
  );
}
