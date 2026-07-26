import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyApplicationAction } from "@/lib/pro/application-actions";
import { LinkButton } from "@/components/ui/Button";
import { BackButton } from "@/components/ui/BackButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "My application · iGlamHer" };

const CONFIG: Record<string, { label: string; tone: string; body: string }> = {
  draft: { label: "Draft", tone: "text-ink-muted", body: "You haven't submitted yet. Finish your application to enter the review queue." },
  pending_review: { label: "Pending", tone: "text-rose", body: "Your application is in the queue. Our team reviews every applicant — you'll get an email with the decision, usually within a day." },
  under_review: { label: "Under review", tone: "text-gold", body: "A reviewer is looking at your application right now. Hang tight — we'll email you shortly." },
  approved: { label: "Approved", tone: "text-success", body: "You're approved and live in the marketplace! You can now receive bookings." },
  rejected: { label: "Not approved", tone: "text-danger", body: "Unfortunately your application wasn't approved this time. You can fix what was flagged and resubmit — the reason is below." },
  needs_more_info: { label: "Needs more info", tone: "text-gold", body: "We need a few things updated before we can approve you. Update the flagged sections and resubmit." },
};

export default async function MyApplicationPage() {
  const app = await getMyApplicationAction();
  if (!app) redirect("/signin?next=/pro/application");
  if (!app.exists || app.status === "draft") redirect("/pro/apply");

  const c = CONFIG[app.status] ?? CONFIG.pending_review;

  return (
    <main className="page-safe-top mx-auto min-h-dvh w-full max-w-2xl px-5 pb-8 md:pb-12">
      <BackButton fallback="/profile" label="Back" className="mb-4" />
      <h1 className="font-display text-2xl font-bold md:text-3xl">My application</h1>

      <div className="mt-6 rounded-[20px] border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Status</p>
          <span className={`rounded-full bg-bg-elevated px-3 py-1 text-sm font-bold ${c.tone}`}>{c.label}</span>
        </div>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-secondary">{c.body}</p>

        {app.status === "needs_more_info" && (
          <div className="mt-4 rounded-[12px] border border-gold/40 bg-gold/10 p-4">
            {app.needsInfoNote && <p className="text-sm text-ink-secondary">{app.needsInfoNote}</p>}
            {app.needsInfoSections.length > 0 && (
              <p className="mt-2 text-[12px] text-ink-muted">You can edit: {app.needsInfoSections.join(", ")}</p>
            )}
            <div className="mt-4"><LinkButton href="/pro/apply">Update my application</LinkButton></div>
          </div>
        )}

        {app.status === "rejected" && (
          <div className="mt-4 rounded-[12px] border border-danger/40 bg-danger/10 p-4">
            {app.rejectionReason && (
              <>
                <p className="text-sm font-semibold text-danger">Reason</p>
                <p className="mt-1 text-sm text-ink-secondary break-words">{app.rejectionReason}</p>
              </>
            )}
            <p className={`text-sm text-ink-secondary ${app.rejectionReason ? "mt-3" : ""}`}>
              To resubmit: {app.rejectionReason ? "update what the reason above calls out" : "review and update your application"}, re-upload your government ID (it was deleted after review — we never keep IDs on file), then hit <strong>Resubmit application</strong> on the review step.
            </p>
            <div className="mt-4"><LinkButton href="/pro/apply">Update &amp; resubmit</LinkButton></div>
          </div>
        )}

        {app.status === "approved" && (
          <div className="mt-5"><LinkButton href="/pro/profile">Go to your pro dashboard</LinkButton></div>
        )}
      </div>

      <p className="mt-4 text-center text-sm text-ink-muted">
        Questions? Email <a href="mailto:support@iglamher.com" className="font-semibold text-rose">support@iglamher.com</a>
      </p>
      <p className="mt-2 text-center text-sm">
        <Link href="/discover" className="text-ink-muted hover:text-ink">← Back to iGlamHer</Link>
      </p>
    </main>
  );
}
