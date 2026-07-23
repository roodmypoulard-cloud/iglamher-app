import { requireAdminPage } from "@/lib/admin/require-admin-page";
import { getOpenDisputes, getOpenReports, type QueueItem } from "@/lib/admin/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Disputes · iGlamHer" };

function QueueCard({ title, items, empty }: { title: string; items: QueueItem[]; empty: string }) {
  return (
    <section className="rounded-[16px] border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-base font-bold">{title}</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${items.length ? "bg-warning/15 text-warning" : "bg-border/60 text-ink-muted"}`}>
          {items.length} open
        </span>
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-ink-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {items.map((it) => (
            <li key={it.id} className="py-2.5">
              <p className="text-sm font-semibold text-ink">{it.label}</p>
              <p className="text-[12px] text-ink-muted">{it.sub}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function AdminDisputesPage() {
  await requireAdminPage("/admin/disputes");
  const [disputes, reports] = await Promise.all([getOpenDisputes(), getOpenReports()]);
  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-2">
      <QueueCard title="Open disputes" items={disputes} empty="No open disputes." />
      <QueueCard title="Moderation reports" items={reports} empty="No open reports." />
    </div>
  );
}
