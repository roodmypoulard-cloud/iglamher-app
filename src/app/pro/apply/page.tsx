import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyApplicationAction, ensureApplicationRowAction } from "@/lib/pro/application-actions";
import { getProContext } from "@/lib/pro/context";
import { ApplicationWizard } from "@/components/pro/ApplicationWizard";
import { BackButton } from "@/components/ui/BackButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Become a Pro · iGlamHer" };

export default async function ApplyPage() {
  // Preserve the acquisition path: signed-out visitors must enter auth instead
  // of seeing an application-error card from ensureApplicationRowAction().
  const existingApp = await getMyApplicationAction();
  if (!existingApp) redirect("/signin?next=/pro/apply");

  // Guarantee the pro row + role exist first so portfolio/document uploads work
  // immediately. A banned account is refused here — render the refusal instead
  // of a wizard whose every save the server would reject.
  const ensured = await ensureApplicationRowAction();
  if (!ensured.ok) {
    // Moderation refusals (ban/suspension) are final — no retry offered. Other
    // failures (e.g. a transient insert error) are recoverable: say so and give
    // a retry affordance instead of only a raw error under scary red.
    const moderation = /banned|suspended/i.test(ensured.error);
    return (
      <main className="page-safe-top mx-auto min-h-dvh w-full max-w-2xl px-5 pb-8 md:pb-12">
        <BackButton fallback="/profile" label="Back" className="mb-4" />
        <h1 className="font-display text-2xl font-bold md:text-3xl">Become a pro</h1>
        <div className="mt-6 rounded-[16px] border border-danger/40 bg-danger/10 p-5">
          <p className="text-sm font-semibold text-danger">
            {moderation ? "Application unavailable" : "Something went wrong"}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary break-words">
            {moderation ? ensured.error : "We couldn't start your application just now. This is usually temporary."}
          </p>
          {!moderation && (
            <>
              <p className="mt-1.5 text-[12px] text-ink-muted break-words">{ensured.error}</p>
              <div className="mt-4">
                <Link href="/pro/apply" className="inline-flex min-h-[44px] items-center rounded-full rose-gradient px-6 text-sm font-semibold text-[#2A1712]">
                  Try again
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
    );
  }
  // Reuse the pre-ensure read when the row already existed — only a first-ever
  // visit (row just created) needs a re-read.
  const app = existingApp.exists ? existingApp : await getMyApplicationAction();
  if (!app) redirect("/signin?next=/pro/apply");
  if (app.status === "approved") redirect("/pro/profile");
  // In-flight applications are read-only → show the status page. Rejected stays
  // HERE: the applicant may edit everything and resubmit (the wizard explains why).
  if (app.status === "pending_review" || app.status === "under_review") redirect("/pro/application");

  const ctx = await getProContext();
  const portfolio = ctx.pro?.portfolio ?? [];

  return (
    <main className="page-safe-top mx-auto min-h-dvh w-full max-w-2xl px-5 pb-8 md:pb-12">
      <BackButton fallback="/profile" label="Back" className="mb-4" />
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
