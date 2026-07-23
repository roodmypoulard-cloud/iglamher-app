import { requireAdminPage } from "@/lib/admin/require-admin-page";
import { integrationStatus } from "@/lib/integrations/config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Integrations · iGlamHer" };

export default async function AdminIntegrationsPage() {
  await requireAdminPage("/admin/integrations");
  const integrations = integrationStatus();

  return (
    <div className="mx-auto max-w-5xl">
      <p className="mb-4 text-[13px] text-ink-muted">
        Live configuration status — keys are never shown here. Add credentials via Vercel environment variables.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map((i) => (
          <div key={i.key} className="rounded-[14px] border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-ink">{i.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
                  i.configured ? "bg-success/15 text-success" : "bg-border/60 text-ink-muted"
                }`}
              >
                {i.configured ? "Connected" : "Configuration missing"}
              </span>
            </div>
            <p className="mt-1.5 text-[12px] leading-snug text-ink-muted">{i.purpose}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
