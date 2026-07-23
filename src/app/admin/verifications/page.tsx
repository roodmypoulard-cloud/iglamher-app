import { CustomerIdReviewRow } from "@/components/admin/CustomerIdReviewRow";
import { requireAdminPage } from "@/lib/admin/require-admin-page";
import { listPendingCustomerIds } from "@/lib/admin/verification-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Verifications · iGlamHer" };

export default async function AdminVerificationsPage() {
  await requireAdminPage("/admin/verifications");
  const rows = await listPendingCustomerIds();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">Customer ID checks</h2>
        <span className="rounded-full bg-gold/15 px-2.5 py-1 text-[11px] font-bold text-gold">{rows.length} pending</span>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-[16px] border border-border bg-surface px-6 py-12 text-center">
          <p className="font-display text-base font-bold text-ink">No ID checks waiting</p>
          <p className="mt-1 text-[13px] text-ink-muted">When customers submit identity documents, they appear here for review.</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((c) => (
            <CustomerIdReviewRow key={c.userId} row={c} />
          ))}
        </ul>
      )}
    </div>
  );
}
