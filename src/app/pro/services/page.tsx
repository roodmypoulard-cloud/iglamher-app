import { redirect } from "next/navigation";
import { ProShell } from "@/components/pro/ProShell";
import { ServiceRowActions } from "@/components/pro/ServiceRowActions";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/states";
import { getProContext } from "@/lib/pro/context";
import { formatPrice, formatDuration, titleCase } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProServicesPage() {
  const ctx = await getProContext();
  if (!ctx.authed) redirect("/signin?next=/pro/services");

  const services = (ctx.pro?.services ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const active = services.filter((s) => !s.isArchived);
  const archived = services.filter((s) => s.isArchived);

  return (
    <ProShell active="/pro/services" isDemo={ctx.isDemo}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Services</h1>
          <p className="text-sm text-ink-muted">{active.length} active</p>
        </div>
        <LinkButton href="/pro/services/new" className="!w-auto px-6">
          + New service
        </LinkButton>
      </div>

      {active.length === 0 ? (
        <EmptyState title="No services yet" body="Add your first service so clients can book you." action={{ label: "Create a service", href: "/pro/services/new" }} />
      ) : (
        <div className="space-y-3">
          {active.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-border bg-surface p-4">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-display text-base font-semibold">
                  {s.name}
                  {!s.isActive && <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-[10px] text-ink-muted">Hidden</span>}
                </p>
                <p className="mt-0.5 text-[12px] text-ink-muted">
                  {titleCase(s.categorySlug)} · {formatDuration(s.durationMin)} · {formatPrice(s.priceCents, { from: s.priceIsFrom })}
                </p>
              </div>
              <ServiceRowActions serviceId={s.id} />
            </div>
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 font-display text-lg font-semibold text-ink-muted">Archived</h2>
          <div className="space-y-2">
            {archived.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-[12px] border border-border/60 bg-bg-elevated px-4 py-3 text-sm text-ink-muted">
                <span>{s.name}</span>
                <span>{formatPrice(s.priceCents)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </ProShell>
  );
}
