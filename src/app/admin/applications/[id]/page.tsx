import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin/require-admin-page";
import { getApplicationDetail } from "@/lib/admin/verification-data";
import { openApplicationAction } from "@/lib/admin/verification-actions";
import { VerificationReviewActions } from "@/components/admin/VerificationReviewActions";
import { PortfolioGallery, DocumentViewer } from "@/components/admin/ApplicationMedia";
import { SECTION_LABELS, type ApplicationSection } from "@/lib/pro/application";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review application · Admin · iGlamHer" };

const STATUS_LABEL: Record<string, string> = {
  pending_review: "Pending", under_review: "Under review", approved: "Approved", rejected: "Rejected", needs_more_info: "Needs more info", draft: "Draft",
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export default async function ApplicationReviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage("/admin/applications");
  const { id } = await params;
  // Opening the detail marks a pending application as "under review".
  await openApplicationAction(id).catch(() => {});
  const app = await getApplicationDetail(id);
  if (!app) notFound();

  const locked = app.status === "approved" || app.status === "rejected";
  const socials: { label: string; href: string }[] = [];
  if (app.instagramHandle) socials.push({ label: `Instagram @${app.instagramHandle}`, href: `https://instagram.com/${app.instagramHandle}` });
  if (app.tiktokHandle) socials.push({ label: `TikTok @${app.tiktokHandle}`, href: `https://tiktok.com/@${app.tiktokHandle}` });
  if (app.websiteUrl) socials.push({ label: "Website", href: app.websiteUrl });
  if (app.portfolioUrl) socials.push({ label: "Portfolio site", href: app.portfolioUrl });

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[1100px] px-5 py-8 md:px-8">
      <Link href="/admin/applications" className="text-sm text-rose hover:underline">← All applications</Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{app.businessName}</h1>
          <p className="text-sm text-ink-muted">{app.primarySpecialty || "—"} · {app.city || "—"} · {app.email ?? "no email"}</p>
        </div>
        <span className="rounded-full bg-surface px-3 py-1 text-sm font-semibold text-rose">{STATUS_LABEL[app.status] ?? app.status}</span>
      </div>
      <p className="mt-1 text-[12px] text-ink-muted">Submitted {fmt(app.submittedAt)}{app.reviewedAt ? ` · last decision ${fmt(app.reviewedAt)}` : ""}{app.resubmissionCount > 0 ? ` · resubmitted ${app.resubmissionCount}×` : ""}</p>

      {app.accountStatus === "banned" && (
        <div className="mt-4 rounded-[14px] border border-danger/50 bg-danger/10 px-4 py-3 text-sm">
          <p className="font-semibold text-danger">🚫 Account banned</p>
          <p className="mt-0.5 text-ink-secondary">Hidden everywhere and blocked from re-applying.{app.banReason ? ` Reason: ${app.banReason}` : ""}</p>
        </div>
      )}
      {app.accountStatus === "suspended" && (
        <div className="mt-4 rounded-[14px] border border-warning/50 bg-warning/10 px-4 py-3 text-sm text-warning">Account suspended — temporarily hidden and blocked.</div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Main */}
        <div className="min-w-0 space-y-6">
          <section className="rounded-[16px] border border-border bg-surface p-5">
            <h2 className="mb-3 font-display text-lg font-semibold">Applicant</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Field label="Category" value={app.primarySpecialty} />
              <Field label="City / area" value={app.city} />
              <Field label="Experience" value={app.yearsExperience != null ? `${app.yearsExperience} yrs` : "—"} />
              <Field label="School / training" value={app.school ?? "—"} />
              <Field label="Email" value={app.email ?? "—"} />
            </dl>
            {app.bio && <><p className="mt-4 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Bio</p><p className="mt-1 text-sm leading-relaxed text-ink-secondary">{app.bio}</p></>}
          </section>

          <section className="rounded-[16px] border border-border bg-surface p-5">
            <h2 className="mb-3 font-display text-lg font-semibold">Social &amp; links</h2>
            {socials.length === 0 ? (
              <p className="text-sm text-ink-muted">No links provided.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {socials.map((s) => (
                  <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer" className="rounded-full border border-rose/40 bg-rose/[0.06] px-4 py-2 text-sm font-semibold text-rose hover:bg-rose/10">
                    {s.label} ↗
                  </a>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[16px] border border-border bg-surface p-5">
            <h2 className="mb-3 font-display text-lg font-semibold">Portfolio</h2>
            <PortfolioGallery items={app.portfolio} />
          </section>

          <section className="rounded-[16px] border border-border bg-surface p-5">
            <h2 className="mb-1 font-display text-lg font-semibold">Documents</h2>
            <p className="mb-3 text-[12px] text-ink-muted">Certifications, licenses, and government ID. Verify or flag each one — approval unlocks once required documents are verified. Preview links are private and expire quickly.</p>
            <DocumentViewer documents={app.documents} readOnly={locked || app.accountStatus === "banned"} />
          </section>

          <section className="rounded-[16px] border border-border bg-surface p-5">
            <h2 className="mb-2 font-display text-lg font-semibold">Identity check</h2>
            <p className="mb-2 text-sm">
              <span className="text-ink-muted">Stripe Identity: </span>
              <span className="rounded-full bg-border/40 px-2.5 py-0.5 text-[12px] font-semibold text-ink-muted">Not started — manual ID review</span>
            </p>
            <p className="text-sm text-ink-secondary">
              Preview the government ID in the Documents section above and mark it <strong>Verify</strong> once you&apos;ve confirmed a real person. The applicant is told their ID is <strong>not stored</strong> — it is <strong>automatically deleted the instant you approve, reject, or request changes</strong>.
            </p>
          </section>
        </div>

        {/* Sidebar: decision + audit */}
        <aside className="space-y-6">
          <VerificationReviewActions userId={app.userId} businessName={app.businessName} locked={locked} accountStatus={app.accountStatus} unmetRequirements={app.unmetRequirements} />

          {app.status === "needs_more_info" && app.needsInfoNote && (
            <div className="rounded-[16px] border border-gold/40 bg-gold/10 p-4 text-sm">
              <p className="font-semibold text-gold">Awaiting applicant edits</p>
              <p className="mt-1 text-ink-secondary">{app.needsInfoNote}</p>
              <p className="mt-2 text-[12px] text-ink-muted">Sections: {app.needsInfoSections.map((s) => SECTION_LABELS[s as ApplicationSection] ?? s).join(", ")}</p>
            </div>
          )}
          {app.status === "rejected" && app.rejectionReason && (
            <div className="rounded-[16px] border border-danger/40 bg-danger/10 p-4 text-sm">
              <p className="font-semibold text-danger">Rejected</p>
              <p className="mt-1 text-ink-secondary">{app.rejectionReason}</p>
            </div>
          )}

          <section className="rounded-[16px] border border-border bg-surface p-5">
            <h3 className="mb-3 font-display text-lg font-semibold">Activity</h3>
            {app.events.length === 0 ? (
              <p className="text-sm text-ink-muted">No activity yet.</p>
            ) : (
              <ul className="space-y-3">
                {app.events.map((e) => (
                  <li key={e.id} className="text-sm">
                    <p className="text-ink">
                      <span className="font-semibold capitalize">{e.action.replace(/_/g, " ")}</span>
                      {" · "}<span className="text-ink-muted">{e.actorName}</span>
                      {!e.visibleToApplicant && e.action === "note" && <span className="ml-1.5 rounded bg-bg-elevated px-1.5 py-0.5 text-[10px] uppercase text-ink-muted">internal</span>}
                    </p>
                    {e.body && <p className="mt-0.5 text-ink-secondary">{e.body}</p>}
                    <p className="mt-0.5 text-[11px] text-ink-muted">{fmt(e.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-0.5 font-medium text-ink">{value || "—"}</dd>
    </div>
  );
}
