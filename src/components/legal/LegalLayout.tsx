import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { BackButton } from "@/components/ui/BackButton";

export function LegalLayout({
  title,
  updated,
  children,
  backFallback = "/profile",
}: {
  title: string;
  updated: string;
  children: ReactNode;
  backFallback?: string;
}) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-3xl px-5 py-10 md:px-8">
      <div className="mb-8 flex items-center gap-3">
        <BackButton fallback={backFallback} label="Back" />
        <Link href="/discover" className="inline-flex items-center" aria-label="iGlamHer home">
          <Image src="/brand/logo-word.png" alt="iGlamHer" width={130} height={28} className="h-6 w-auto" priority />
        </Link>
      </div>
      <h1 className="font-display text-3xl font-bold leading-tight">{title}</h1>
      <p className="mt-1 text-sm text-ink-muted">Last updated {updated}</p>
      <div className="legal-body mt-6 space-y-5 text-[15px] leading-relaxed text-ink-secondary">{children}</div>
      <nav className="mt-12 flex flex-wrap gap-4 border-t border-border pt-6 text-sm text-ink-muted">
        <Link href="/legal/terms" className="hover:text-ink">Terms</Link>
        <Link href="/legal/privacy" className="hover:text-ink">Privacy</Link>
        <Link href="/legal/cancellation" className="hover:text-ink">Cancellation</Link>
        <Link href="/about" className="hover:text-ink">About</Link>
        <Link href="/how-it-works" className="hover:text-ink">How it works</Link>
      </nav>
    </div>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="font-display text-xl font-semibold text-ink">{children}</h2>;
}
