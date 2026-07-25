import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/require-admin-page";
import { getOpenDisputes, getOpenReports, getOpenCardDisputes, type QueueItem } from "@/lib/admin/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Disputes · iGlamHer" };

function QueueCard({ title, items, empty, hrefFor }: { title: string; items: QueueItem[]; empty: string; hrefFor: (i: QueueItem) => string }) {
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
            <li key={it.id}>
              <Link href={hrefFor(it)} className="flex items-center justify-between gap-2 rounded-[10px] px-2 py-2.5 transition-colors hover:bg-bg-elevated">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">{it.label}</span>
                  <span className="block text-[12px] text-ink-muted">{it.sub}</span>
                </span>
                <span aria-hidden className="flex-none text-[13px] font-semibold text-rose">Open →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function AdminDisputesPage() {
  await requireAdminPage("/admin/disputes");
  const [disputes, reports, cardDisputes] = await Promise.all([getOpenDisputes(), getOpenReports(), getOpenCardDisputes()]);
  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-2">
      <QueueCard
        title="Open disputes"
        items={disputes}
        empty="No open disputes."
        hrefFor={(i) => `/admin/disputes/${i.id}?label=${encodeURIComponent(i.label)}&status=${encodeURIComponent(i.sub)}`}
      />
      <QueueCard
        title="Moderation reports"
        items={reports}
        empty="No open reports."
        hrefFor={(i) => `/admin/disputes/${i.id}?type=report&label=${encodeURIComponent(i.label)}&status=${encodeURIComponent(i.sub)}`}
      />
      <section className="rounded-[16px] border border-border bg-surface p-4 lg:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-bold">Card disputes (chargebacks)</h2>
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cardDisputes.length ? "bg-warning/15 text-warning" : "bg-border/60 text-ink-muted"}`}>
            {cardDisputes.length} open
          </span>
        </div>
        {cardDisputes.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-ink-muted">No open card disputes.</p>
        ) : (
          <ul className="divide-y divide-border/50">
            {cardDisputes.map((d) => (
              <li key={d.id}>
                <a
                  href={`https://dashboard.stripe.com/disputes/${d.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 rounded-[10px] px-2 py-2.5 transition-colors hover:bg-bg-elevated"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{d.label}</span>
                    <span className="block text-[12px] text-ink-muted">{d.sub}</span>
                  </span>
                  <span aria-hidden className="flex-none text-[13px] font-semibold text-rose">Respond in Stripe ↗</span>
                </a>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[12px] text-ink-muted">
          Evidence is submitted in the Stripe Dashboard. Records here are synced automatically from webhooks.
        </p>
      </section>
    </div>
  );
}
