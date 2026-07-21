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

  return (
    <ProShell active="/pro/profile" isDemo={ctx.isDemo}>
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
