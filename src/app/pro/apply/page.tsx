import { redirect } from "next/navigation";
import { getMyApplicationAction, ensureApplicationRowAction } from "@/lib/pro/application-actions";
import { getProContext } from "@/lib/pro/context";
import { ApplicationWizard } from "@/components/pro/ApplicationWizard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Become a Pro · iGlamHer" };

export default async function ApplyPage() {
  // Guarantee the pro row + role exist first so portfolio/document uploads work immediately.
  await ensureApplicationRowAction();
  const app = await getMyApplicationAction();
  if (!app) redirect("/signin?next=/pro/apply");
  if (app.status === "approved") redirect("/pro/profile");
  // Submitted (and not sent back) applications are read-only → show the status page.
  if (app.status === "pending_review" || app.status === "under_review" || app.status === "rejected") redirect("/pro/application");

  const ctx = await getProContext();
  const portfolio = ctx.pro?.portfolio ?? [];

  return (
    <main className="page-safe-top mx-auto min-h-dvh w-full max-w-2xl px-5 pb-8 md:pb-12">
      <h1 className="font-display text-2xl font-bold md:text-3xl">Become a pro</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Tell us about your work. Every application is reviewed before you go live — we&apos;ll email you the decision.
      </p>
      <div className="mt-6">
        <ApplicationWizard initial={app} portfolio={portfolio} />
      </div>
    </main>
  );
}
