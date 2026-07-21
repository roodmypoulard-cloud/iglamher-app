import { redirect } from "next/navigation";
import { ProShell } from "@/components/pro/ProShell";
import { AvailabilityEditor } from "@/components/pro/AvailabilityEditor";
import { getProContext } from "@/lib/pro/context";

export const dynamic = "force-dynamic";

export default async function ProAvailabilityPage() {
  const ctx = await getProContext();
  if (!ctx.authed) redirect("/signin?next=/pro/availability");

  return (
    <ProShell active="/pro/availability" isDemo={ctx.isDemo}>
      <h1 className="mb-1 font-display text-2xl font-bold">Availability</h1>
      <p className="mb-6 text-sm text-ink-muted">
        Set your weekly hours, booking notice, and how far ahead clients can book. Times are in your timezone; we store
        everything in UTC.
      </p>
      <AvailabilityEditor
        initialRules={ctx.pro?.availability ?? []}
        timezone={ctx.pro?.timezone ?? "America/Los_Angeles"}
      />
    </ProShell>
  );
}
