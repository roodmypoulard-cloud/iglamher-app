import { redirect } from "next/navigation";
import { ProShell } from "@/components/pro/ProShell";
import { ProfileForm } from "@/components/pro/ProfileForm";
import { PortfolioManager } from "@/components/pro/PortfolioManager";
import { getProContext } from "@/lib/pro/context";
import { profileCompleteness } from "@/lib/marketplace/visibility";

export const dynamic = "force-dynamic";

export default async function ProProfilePage() {
  const ctx = await getProContext();
  if (!ctx.authed) redirect("/signin?next=/pro/profile");
  if (!ctx.pro) {
    return (
      <ProShell active="/pro/profile" isDemo={ctx.isDemo}>
        <p className="text-sm text-ink-muted">No professional profile found for this account.</p>
      </ProShell>
    );
  }

  const completeness = Math.round(profileCompleteness(ctx.pro) * 100);

  const pendingReview = !ctx.pro.isVerified;

  return (
    <ProShell active="/pro/profile" isDemo={ctx.isDemo}>
      {pendingReview && (
        <div className="mb-6 flex items-start gap-3 rounded-[14px] border border-gold/40 bg-gold/10 px-4 py-3">
          <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.9} className="mt-0.5 flex-none text-gold" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-ink">Profile pending review</p>
            <p className="mt-0.5 text-[13px] text-ink-secondary">
              Your profile is complete and in our review queue. You won&apos;t appear in the public feed or take bookings until our team approves you — usually within a day. Nothing is broken; we&apos;ll email you once you&apos;re live.
            </p>
          </div>
        </div>
      )}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Public profile</h1>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">Completeness</p>
          <p className="font-display text-xl font-bold text-rose">{completeness}%</p>
        </div>
      </div>
      <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-surface">
        <div className="h-full rose-gradient" style={{ width: `${completeness}%` }} />
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_1fr]">
        <section>
          <h2 className="mb-4 font-display text-lg font-semibold">Details</h2>
          <ProfileForm pro={ctx.pro} />
        </section>
        <section>
          <h2 className="mb-4 font-display text-lg font-semibold">Portfolio</h2>
          <PortfolioManager items={ctx.pro.portfolio} />
        </section>
      </div>
    </ProShell>
  );
}
