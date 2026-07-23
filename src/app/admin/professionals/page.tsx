import Image from "next/image";
import { AdminProRow } from "@/components/admin/AdminProRow";
import { requireAdminPage } from "@/lib/admin/require-admin-page";
import { getAllProfessionalsForAdmin } from "@/lib/data/professionals";
import { profileCompleteness } from "@/lib/marketplace/visibility";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Professionals · iGlamHer" };

export default async function AdminProfessionalsPage() {
  await requireAdminPage("/admin/professionals");
  const pros = await getAllProfessionalsForAdmin();

  return (
    <div className="mx-auto max-w-5xl">
      <p className="mb-4 text-[13px] text-ink-muted">{pros.length} professional accounts. Activate, feature, or open the full application review.</p>
      {pros.length === 0 ? (
        <div className="rounded-[16px] border border-border bg-surface px-6 py-12 text-center">
          <p className="font-display text-base font-bold text-ink">No professionals yet</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {pros.map((p) => (
            <div key={p.userId} className="flex flex-wrap items-center gap-3 rounded-[14px] border border-border bg-surface p-3.5">
              <Image src={p.avatarUrl} alt="" width={40} height={40} className="h-10 w-10 rounded-[10px] object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">{p.businessName || p.displayName}</p>
                <p className="truncate text-[12px] text-ink-muted">{p.primarySpecialty} · {p.city} · {profileCompleteness(p)}% complete</p>
              </div>
              <AdminProRow userId={p.userId} active={p.isActive} featured={p.isFeatured} recommended={Boolean(p.isRecommended)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
