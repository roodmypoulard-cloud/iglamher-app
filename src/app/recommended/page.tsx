import { Shell } from "@/components/marketplace/Shell";
import { ProfessionalGrid } from "@/components/marketplace/ProfessionalGrid";
import { getRecommendedProfessionals } from "@/lib/data/professionals";
import { getFavoriteProfessionalIds } from "@/lib/data/favorites";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Recommended · iGlamHer",
  description: "Beauty professionals hand-picked and approved by iGlamHer.",
};

const CrownIcon = () => (
  <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 17h16l-1-7.5-3.6 2.8L12 6l-3.4 6.3L5 9.5 4 17Z" />
    <path d="M4 19.4h16" />
  </svg>
);

export default async function RecommendedPage() {
  const [pros, favoritedIds] = await Promise.all([
    getRecommendedProfessionals(24),
    getFavoriteProfessionalIds(),
  ]);

  return (
    <Shell back="/discover">
      <div className="flex items-center gap-2.5">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-full gold-glossy">
          <CrownIcon />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold leading-tight">Recommended</h1>
          <p className="text-[12.5px] text-ink-secondary">Hand-picked professionals, approved by iGlamHer.</p>
        </div>
      </div>

      <p className="mt-3 rounded-[14px] border border-rose/20 bg-rose/[0.06] px-3.5 py-2.5 text-[12px] leading-relaxed text-ink-secondary">
        Every professional here has been personally reviewed and endorsed by our team
        for quality of work, reliability, and client care.
      </p>

      <div className="mt-4">
        <ProfessionalGrid
          pros={pros}
          favoritedIds={favoritedIds}
          emptyTitle="Recommendations coming soon"
          emptyBody="We're curating our first class of iGlamHer-approved professionals. Check back shortly — or browse everyone on Discover."
        />
      </div>
    </Shell>
  );
}
