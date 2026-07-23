import Image from "next/image";
import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";
import { ProfessionalCard } from "@/components/marketplace/ProfessionalCard";
import { CategoryTiles } from "@/components/marketplace/CategoryTiles";
import { CategoryBanner } from "@/components/marketplace/CategoryBanner";
import { listCategories, searchProfessionalViews } from "@/lib/data/professionals";

export const dynamic = "force-dynamic";

const STEPS = [
  { n: "01", title: "Browse", body: "Explore trusted local beauty pros, portfolios and real reviews — no account needed." },
  { n: "02", title: "Book", body: "Pick your service, date and time. A small deposit reserves your spot." },
  { n: "03", title: "Get glammed", body: "Your pro comes to you or hosts you. Pay securely, then tip and review." },
];

export default async function LandingPage() {
  const [categories, featured] = await Promise.all([
    listCategories().catch(() => []),
    // Real top-rated pros — the section hides itself if none exist yet.
    searchProfessionalViews({ sort: "rating" }).then((p) => p.slice(0, 4)).catch(() => []),
  ]);
  // Same organization as the inside Discover screen: 2×2 core tiles + Lashes banner.
  const gridCategories = categories.filter((c) => c.slug !== "lashes").slice(0, 4);
  const bannerCategory = categories.find((c) => c.slug === "lashes");

  return (
    <main className="relative flex min-h-dvh flex-col overflow-x-hidden">
      {/* ---------- HERO ---------- */}
      <section className="relative flex min-h-dvh flex-col">
        <div className="absolute inset-0 -z-10">
          <Image src="/brand/hero.jpg" alt="" fill priority sizes="100vw" className="object-cover object-top md:object-[75%_center]" />
          {/* Mobile: bottom fade. Desktop: left→right fade so left-aligned copy stays legible over the portrait. */}
          <div className="absolute inset-0 bg-gradient-to-b from-bg/45 via-bg/65 to-bg md:bg-gradient-to-r md:from-bg md:via-bg/75 md:to-bg/10" />
        </div>

        {/* Desktop-only marketing top nav — mobile keeps the current app-style entry */}
        <header className="absolute inset-x-0 top-0 z-10 hidden items-center justify-between px-[6vw] py-6 md:flex">
          <Image src="/brand/logo-word.png" alt="iGlamHer" width={160} height={34} priority className="h-8 w-auto" />
          <nav className="flex items-center gap-7 text-sm font-semibold text-ink-secondary">
            <Link href="/explore" className="transition-colors hover:text-ink">Explore</Link>
            <a href="#how-it-works" className="transition-colors hover:text-ink">How it works</a>
            <Link href="/signin" className="transition-colors hover:text-ink">Sign in</Link>
            <LinkButton href="/signup" className="!w-auto px-6 py-2.5 text-sm">Get started</LinkButton>
          </nav>
        </header>

        <div className="flex flex-1 flex-col items-center justify-end px-6 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] text-center md:items-start md:justify-center md:px-[6vw] md:pb-0 md:text-left">
          {/* 20% smaller on mobile as one unit (bottom-anchored); full size + left-aligned on desktop */}
          <div className="w-full origin-bottom scale-[0.8] md:scale-100">
            <div className="fade-in mx-auto flex max-w-md flex-col items-center md:mx-0 md:max-w-xl md:items-start">
              <Image src="/brand/logo-clear.png" alt="iGlamHer" width={420} height={230} priority className="w-[80%] max-w-[340px] md:w-full md:max-w-[400px]" />
              <p className="mt-4 max-w-xs text-sm text-ink-secondary md:mt-6 md:max-w-lg md:text-xl md:leading-relaxed">
                Book trusted hair, makeup, lash and styling pros — luxury beauty that comes to you.
              </p>
              <div className="mt-9 w-full max-w-xs space-y-3 md:mt-9 md:max-w-md">
                <LinkButton href="/signup" full>
                  Get started
                </LinkButton>
                <LinkButton href="/explore" variant="ghost" full>
                  Browse without an account
                </LinkButton>
                <p className="text-sm text-ink-muted">
                  Already have an account?{" "}
                  <Link href="/signin" className="font-semibold text-rose">
                    Sign in
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- SERVICES (same organization as the inside Discover screen) ---------- */}
      {gridCategories.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-5 py-16 md:px-8 md:py-24">
          <p className="text-center text-[12px] font-semibold uppercase tracking-[0.28em] text-rose">What we offer</p>
          <h2 className="mb-8 mt-2 text-center font-display text-3xl font-bold md:mb-12 md:text-5xl">Every look, on demand</h2>
          <CategoryTiles categories={gridCategories} />
          {bannerCategory && <CategoryBanner category={bannerCategory} />}
        </section>
      )}

      {/* ---------- HOW IT WORKS ---------- */}
      <section id="how-it-works" className="scroll-mt-20 bg-bg-elevated/60 py-16 md:py-24">
        <div className="mx-auto w-full max-w-4xl px-5 md:px-8">
          <p className="text-center text-[12px] font-semibold uppercase tracking-[0.28em] text-rose">How it works</p>
          <h2 className="mt-2 text-center font-display text-3xl font-bold md:text-4xl">Booked in three taps</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-[20px] border border-border bg-surface p-6 text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-full rose-gradient font-display text-lg font-bold text-[#2A1712]">
                  {s.n}
                </span>
                <h3 className="mt-4 font-display text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-ink-secondary">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- FEATURED PROS ---------- */}
      {featured.length > 0 && (
        <section className="mx-auto w-full max-w-5xl px-5 py-16 md:px-8">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.28em] text-rose">Featured</p>
              <h2 className="mt-2 font-display text-3xl font-bold md:text-4xl">Top-rated pros</h2>
            </div>
            <Link href="/explore" className="hidden text-sm font-semibold text-rose hover:underline sm:block">
              See all
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((pro) => (
              <ProfessionalCard key={pro.userId} pro={pro} variant="grid" />
            ))}
          </div>
          <div className="mt-8 text-center">
            <LinkButton href="/explore" variant="outline">
              Explore all pros
            </LinkButton>
          </div>
        </section>
      )}

      {/* ---------- CTA ---------- */}
      <section className="mx-auto w-full max-w-3xl px-5 pb-4 pt-6 text-center md:px-8">
        <h2 className="font-display text-3xl font-bold md:text-4xl">Ready to glow?</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-secondary">Join iGlamHer and book your first appointment in minutes.</p>
        <div className="mx-auto mt-6 flex max-w-xs flex-col gap-3">
          <LinkButton href="/signup" full>
            Get started
          </LinkButton>
          <LinkButton href="/explore" variant="ghost" full>
            Keep browsing
          </LinkButton>
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer className="mt-12 border-t border-border/60 px-5 py-10 md:px-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 text-center">
          <Image src="/brand/logo-word.png" alt="iGlamHer" width={150} height={32} className="h-7 w-auto opacity-90" />
          <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-secondary">
            <Link href="/explore" className="hover:text-ink">Explore</Link>
            <Link href="/signup" className="hover:text-ink">Get started</Link>
            <Link href="/signin" className="hover:text-ink">Sign in</Link>
            <Link href="/terms" className="hover:text-ink">Terms</Link>
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/legal/cancellation" className="hover:text-ink">Cancellation</Link>
          </nav>
          <p className="text-[12px] text-ink-muted">© {new Date().getFullYear()} iGlamHer. Luxury beauty services, on demand.</p>
        </div>
      </footer>
    </main>
  );
}
