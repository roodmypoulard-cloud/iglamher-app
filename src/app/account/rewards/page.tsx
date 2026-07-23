import { redirect } from "next/navigation";
import { Shell, SectionHeader } from "@/components/marketplace/Shell";
import { RedeemBox, ReferralBox } from "@/components/rewards/RewardsPanel";
import { EmptyState } from "@/components/ui/states";
import { getMyLoyalty } from "@/lib/loyalty/data";
import { getMyReferral } from "@/lib/referral/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";

export const dynamic = "force-dynamic";
export const metadata = { title: "iGlam Rewards · iGlamHer" };

export default async function RewardsPage() {
  if (isLiveSupabase()) {
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) redirect("/signin?next=/account/rewards");
  }

  const [loyalty, referral] = await Promise.all([getMyLoyalty(), getMyReferral()]);

  if (!loyalty.available) {
    return (
      <Shell back="/account">
        <h1 className="font-display text-3xl font-bold">iGlam Rewards</h1>
        <div className="mt-6">
          <EmptyState title="Rewards need the live backend" body="Connect Supabase and sign in to earn points, unlock tiers, and share your referral code." action={{ label: "Discover", href: "/discover" }} />
        </div>
      </Shell>
    );
  }

  return (
    <Shell back="/account">
      <h1 className="font-display text-3xl font-bold leading-tight">iGlam Rewards</h1>
      <p className="mb-6 mt-1 text-sm text-ink-muted">Earn on every booking. Redeem for credit.</p>

      {/* Tier + balance */}
      <div className="card-luxe p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-ink-muted">Your tier</p>
            <p className="font-display text-2xl font-bold text-rose">{loyalty.tierLabel}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-ink-muted">Points balance</p>
            <p className="font-display text-2xl font-bold">{loyalty.points}</p>
          </div>
        </div>
        {loyalty.next && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-[11px] text-ink-muted">
              <span>{loyalty.tierLabel}</span>
              <span>{loyalty.pointsToNext} pts to {loyalty.next}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
              <div className="h-full rose-gradient" style={{ width: `${loyalty.progressPct}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <RedeemBox points={loyalty.points} />
        <ReferralBox code={referral.code} />
      </div>

      {referral.available && (
        <SectionHeader title="Your referrals" aside={`${referral.rewarded} rewarded · ${referral.pending} pending`} />
      )}

      <SectionHeader title="Recent activity" />
      {loyalty.transactions.length === 0 ? (
        <p className="text-sm text-ink-muted">No points activity yet — book an appointment to start earning.</p>
      ) : (
        <div className="space-y-2">
          {loyalty.transactions.map((t, i) => (
            <div key={i} className="flex items-center justify-between rounded-[12px] border border-border bg-surface px-4 py-3 text-sm">
              <span className="capitalize text-ink-secondary">{t.reason.replace(/_/g, " ")}</span>
              <span className={t.pointsDelta >= 0 ? "font-semibold text-success" : "font-semibold text-ink-muted"}>
                {t.pointsDelta >= 0 ? "+" : ""}{t.pointsDelta} pts
              </span>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
