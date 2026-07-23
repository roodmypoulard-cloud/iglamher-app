import Link from "next/link";
import Image from "next/image";
import { CategoryTiles } from "@/components/marketplace/CategoryTiles";
import { ProfessionalCard } from "@/components/marketplace/ProfessionalCard";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/states";
import { listCategories, searchProfessionalViews } from "@/lib/data/professionals";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Explore Beauty Pros · iGlamHer",
  description: "Browse trusted hair, makeup, lash and styling professionals near you — no account needed. Sign up when you're ready to book.",
};

export default async function ExplorePage() {
  const [categories, pros] = await Promise.all([
    listCategories().catch(() => []),
    searchProfessionalViews({ sort: "rating" }).catch(() => []),
  ]);
  const gridCategories = categories.slice(0, 6);

  return (
    <main className="min-h-dvh bg-bg">
      {/* Public top bar */}
      <header className="topbar-safe sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border/60 bg-bg/95 px-5 md:px-8">
        <Link href="/" aria-label="iGlamHer home" className="flex items-center">
          <Image src="/brand/logo-word.png" alt="iGlamHer" width={150} height={32} priority className="h-7 w-auto" />
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/signin" className="rounded-full px-3 py-2 text-sm font-semibold text-ink-secondary hover:text-ink">
            Sign in
          </Link>
          <LinkButton href="/signup" className="!w-auto px-5 py-2 text-sm">
            Get started
          </LinkButton>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-5 pb-20 pt-6 md:px-8">
        {/* Guest banner */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-rose/30 bg-rose/[0.06] px-4 py-3">
          <p className="text-sm text-ink-secondary">
            <span className="font-semibold text-ink">Browsing as a guest.</span> Sign up free to book, save favorites and message pros.
          </p>
          <LinkButton href="/signup" className="!w-auto px-4 py-2 text-sm">
            Create account
          </LinkButton>
        </div>

        <h1 className="font-display text-3xl font-bold md:text-4xl">Explore beauty pros</h1>
        <p className="mt-1 text-sm text-ink-muted">Discover trusted hair, makeup, lash and styling professionals near you.</p>

        {/* Categories */}
        {gridCategories.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-secondary">Browse by category</h2>
            <CategoryTiles categories={gridCategories} />
          </section>
        )}

        {/* Pros */}
        <section className="mt-10">
          <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-secondary">Top-rated professionals</h2>
          {pros.length === 0 ? (
            <EmptyState
              title="No professionals yet"
              body="We're adding trusted beauty pros in your area every week — check back soon."
              action={{ label: "Get started", href: "/signup" }}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pros.map((pro) => (
                <ProfessionalCard key={pro.userId} pro={pro} variant="grid" />
              ))}
            </div>
          )}
        </section>

        {/* Bottom CTA — sign-in is only required at booking */}
        <section className="mt-14 rounded-[22px] border border-border bg-bg-elevated/60 px-6 py-10 text-center">
          <h2 className="font-display text-2xl font-bold">Found someone you love?</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-secondary">
            Create a free account to book your appointment, secure your spot and message your pro.
          </p>
          <div className="mx-auto mt-6 flex max-w-xs flex-col gap-3">
            <LinkButton href="/signup" full>
              Sign up to book
            </LinkButton>
            <LinkButton href="/signin" variant="ghost" full>
              I already have an account
            </LinkButton>
          </div>
        </section>
      </div>
    </main>
  );
}
