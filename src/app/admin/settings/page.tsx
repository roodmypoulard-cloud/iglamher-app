import { KillSwitch } from "@/components/admin/KillSwitch";
import { requireAdminPage } from "@/lib/admin/require-admin-page";
import { isMaintenanceMode, isBookingsPaused, isPaymentsPaused } from "@/lib/ops/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Settings · iGlamHer" };

export default async function AdminSettingsPage() {
  await requireAdminPage("/admin/settings");
  const [maintenance, bookingsPaused, paymentsPaused] = await Promise.all([
    isMaintenanceMode(),
    isBookingsPaused(),
    isPaymentsPaused(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <p className="text-[13px] text-ink-muted">
        Platform kill switches. Every change is admin-gated server-side and written to the audit log.
      </p>
      <KillSwitch
        settingKey="maintenance_mode"
        label="Maintenance mode"
        description="Shows the maintenance notice across the customer app. Use only during planned work."
        initialEnabled={maintenance.enabled}
        danger
      />
      <KillSwitch
        settingKey="bookings_paused"
        label="Pause new bookings"
        description="Stops customers from starting new bookings. Existing bookings continue."
        initialEnabled={bookingsPaused}
        danger
      />
      <KillSwitch
        settingKey="payments_paused"
        label="Pause payments"
        description="Blocks new payment attempts platform-wide. For payment-provider incidents."
        initialEnabled={paymentsPaused}
        danger
      />
    </div>
  );
}
