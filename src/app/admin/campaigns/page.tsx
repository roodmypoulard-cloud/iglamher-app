import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/require-admin-page";
import { listCampaigns } from "@/lib/marketing/data";
import { CampaignManager } from "@/components/admin/CampaignManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Campaigns · Admin" };

export default async function AdminCampaignsPage() {
  const { isDemo } = await requireAdminPage("/admin/campaigns");
  const campaigns = await listCampaigns();

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[1000px] px-5 py-8 md:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Marketing campaigns</h1>
          <p className="mt-1 text-sm text-ink-muted">Coupons, seasonal promos, and geo-targeted offers.</p>
        </div>
        <Link href="/admin" className="text-sm text-rose hover:underline">← Command center</Link>
      </div>
      {isDemo && (
        <div className="mb-6 rounded-[12px] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-ink-secondary">
          Preview mode — creating campaigns requires a connected Supabase project and an admin session.
        </div>
      )}
      <CampaignManager initial={campaigns} />
    </div>
  );
}
