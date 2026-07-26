import Link from "next/link";
import { redirect } from "next/navigation";
import { ProShell } from "@/components/pro/ProShell";
import { ProfileForm } from "@/components/pro/ProfileForm";
import { PortfolioManager } from "@/components/pro/PortfolioManager";
import { getProContext } from "@/lib/pro/context";
import { getMyApplicationAction } from "@/lib/pro/application-actions";
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

  // Status-aware verification banner. `app` is null only in demo mode (no live DB),
  // where the demo pro renders as already verified anyway.
  const app = ctx.pro.isVerified ? null : await getMyApplicationAction();
  const rejected = app?.status === "rejected";
  const needsInfo = app?.status === "needs_more_info";
  // Only claim "not submitted" when the application was actually READ and says
  // so — a transient null (auth/gate hiccup) falls through to the neutral
  // "pending" copy instead of mislabeling a submitted pro.
  const notSubmitted = app != null && (!app.exists || app.status === "draft");
  const showBanner = !ctx.pro.isVerified && !ctx.isDemo;

  return (
    <ProShell active="/pro/profile" isDemo={ctx.isDemo}>
      {showBanner && (
        <div className={`mb-6 flex items-start gap-3 rounded-[14px] border px-4 py-3 ${rejected ? "border-danger/40 bg-danger/10" : "border-gold/40 bg-gold/10"}`}>
          <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.9} className={`mt-0.5 flex-none ${rejected ? "text-danger" : "text-gold"}`} aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {rejected ? (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">Verification not approved</p>
              <p className="mt-0.5 text-[13px] text-ink-secondary">
                Your application wasn&apos;t approved this time. You can fix what was flagged and resubmit —{" "}
                <Link href="/pro/application" className="font-semibold text-rose underline-offset-2 hover:underline">see the reason &amp; resubmit</Link>.
              </p>
            </div>
          ) : needsInfo ? (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">Verification needs more info</p>
              <p className="mt-0.5 text-[13px] text-ink-secondary">
                Our team asked for a few updates before approving you —{" "}
                <Link href="/pro/application" className="font-semibold text-rose underline-offset-2 hover:underline">see what&apos;s needed &amp; update</Link>.
              </p>
            </div>
          ) : notSubmitted ? (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">Verification not submitted</p>
              <p className="mt-0.5 text-[13px] text-ink-secondary">
                You haven&apos;t submitted your verification yet. You won&apos;t appear in the marketplace until you do —{" "}
                <Link href="/pro/apply" className="font-semibold text-rose underline-offset-2 hover:underline">finish your application</Link>.
              </p>
            </div>
          ) : (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">Verification pending</p>
              <p className="mt-0.5 text-[13px] text-ink-secondary">
                Your profile is in our review queue. You won&apos;t appear in the public feed or take bookings until our team approves you — usually within a day. Nothing is broken; we&apos;ll email you once you&apos;re live.
              </p>
            </div>
          )}
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
