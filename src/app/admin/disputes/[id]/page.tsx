import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/require-admin-page";
import { getOpenDisputes, getOpenReports } from "@/lib/admin/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Case · Admin · iGlamHer" };

/** Detail view for a dispute or moderation report. Resolution tooling isn't
 *  built yet, so this is an honest Soft Luxe coming-soon that still surfaces the
 *  real case (reason + status, matched from the open queues) and links back —
 *  never a dead row. `type=report` distinguishes the two entities. */
export default async function AdminCaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string; label?: string; status?: string }>;
}) {
  await requireAdminPage("/admin/disputes");
  const { id } = await params;
  const { type, label, status } = await searchParams;
  const isReport = type === "report";

  // Prefer live data from the queue; fall back to the label/status passed by the row.
  const items = isReport ? await getOpenReports() : await getOpenDisputes();
  const match = items.find((i) => i.id === id);
  const reason = match?.label ?? label ?? "Case";
  const state = match?.sub ?? status ?? "open";

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin/disputes" className="text-sm text-rose hover:underline">← Disputes &amp; reports</Link>

      <section className="mt-4 rounded-[18px] border border-border bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-rose/12 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-rose">
            {isReport ? "Moderation report" : "Dispute"}
          </span>
          <span className="rounded-full bg-warning/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-warning">
            {state}
          </span>
        </div>
        <h1 className="mt-3 font-display text-xl font-bold text-ink">{reason}</h1>
        <p className="mt-1 text-[12px] text-ink-muted">Case ID · {id.slice(0, 8)}</p>
      </section>

      <div className="mt-4 rounded-[16px] border border-gold/35 bg-gold/[0.06] px-4 py-4">
        <p className="text-sm font-bold text-ink">Resolution tools coming soon</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-secondary">
          Full case handling — evidence timeline, refunds, warnings, and account actions — is being built. Until then,
          review the parties in Professionals and Customers, and use the platform kill switches in Settings if urgent
          moderation is required.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/admin/professionals" className="rounded-full border border-rose/50 px-4 py-2 text-[12.5px] font-semibold text-rose hover:bg-rose/10">
            Professionals
          </Link>
          <Link href="/admin/settings" className="rounded-full border border-border px-4 py-2 text-[12.5px] font-semibold text-ink-secondary hover:border-rose/50">
            Platform settings
          </Link>
        </div>
      </div>
    </div>
  );
}
