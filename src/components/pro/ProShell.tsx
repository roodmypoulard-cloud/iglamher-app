import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/format";

const NAV = [
  { href: "/pro/services", label: "Services" },
  { href: "/pro/availability", label: "Availability" },
  { href: "/pro/earnings", label: "Earnings" },
  { href: "/pro/profile", label: "Profile" },
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
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/60 bg-bg/85 px-5 py-3.5 backdrop-blur-md md:px-8">
        <Link href="/pro/services" className="flex items-center" aria-label="iGlamHer pro">
          <Image src="/brand/logo-word.png" alt="iGlamHer" width={130} height={28} className="h-[24px] w-auto" priority />
          <span className="ml-2 rounded-full border border-rose/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose">Pro</span>
        </Link>
        <Link href="/discover" className="text-sm text-ink-muted hover:text-ink">
          View marketplace →
        </Link>
      </header>

      <nav className="flex gap-1 border-b border-border px-5 md:px-8" aria-label="Professional dashboard">
        {NAV.map((n) => {
          const isActive = active === n.href;
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "border-b-2 px-4 py-3 text-sm font-semibold transition-colors",
                isActive ? "border-rose text-ink" : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>

      <main className="flex-1 px-5 py-6 md:px-8 md:py-8">
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
