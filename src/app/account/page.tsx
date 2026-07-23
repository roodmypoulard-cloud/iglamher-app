import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";
import { Shell, SectionHeader } from "@/components/marketplace/Shell";
import { EmptyState } from "@/components/ui/states";
import { HeartIcon, CalendarIcon, ChatIcon, BellIcon, UserIcon, StarIcon, CreditCardIcon } from "@/components/ui/icons";
import { getMyCustomerBookings, type BookingSummary } from "@/lib/booking/data";
import { statusLabel, isActive } from "@/lib/booking/status";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "My account · iGlamHer" };

const LINKS: { href: string; label: string; Icon: typeof HeartIcon }[] = [
  { href: "/account/favorites", label: "Favorites", Icon: HeartIcon },
  { href: "/account/payment-methods", label: "Payment", Icon: CreditCardIcon },
  { href: "/account/rewards", label: "Rewards", Icon: StarIcon },
  { href: "/notifications", label: "Notifications", Icon: BellIcon },
  { href: "/messages", label: "Messages", Icon: ChatIcon },
  { href: "/profile/settings", label: "Settings", Icon: UserIcon },
];

function BookingRow({ b }: { b: BookingSummary }) {
  return (
    <Link href={`/bookings/${b.id}`} className="flex items-center justify-between rounded-[14px] border border-border bg-surface p-4 transition-colors hover:border-rose/50">
      <div>
        <p className="font-display text-base font-semibold">{b.serviceName}</p>
        <p className="text-[12px] text-ink-muted">
          {b.professionalName ? `${b.professionalName} · ` : ""}
          {new Date(b.startsAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </div>
      <div className="text-right">
        <span className="rounded-full bg-bg-elevated px-2.5 py-1 text-[11px] font-semibold text-rose">{statusLabel(b.status)}</span>
        <p className="mt-1 text-sm font-semibold">{formatPrice(b.totalCents)}</p>
      </div>
    </Link>
  );
}

export default async function AccountPage() {
  if (isLiveSupabase()) {
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) redirect("/signin?next=/account");
  }
  const bookings = await getMyCustomerBookings();
  const upcoming = bookings.filter((b) => isActive(b.status));
  const past = bookings.filter((b) => !isActive(b.status));

  return (
    <Shell back="/profile">
      <h1 className="font-display text-3xl font-bold leading-tight">My account</h1>
      <p className="mt-1 text-sm text-ink-muted">Bookings, receipts and settings.</p>

      {/* Customer Mode is customer-only: mode switching lives on /profile; no pro
          shortcuts or upsells here. */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {LINKS.map(({ href, label, Icon }) => (
          <Link key={href} href={href} className="flex flex-col items-center gap-2 rounded-[16px] border border-border bg-surface px-3 py-4 text-center hover:border-rose/50">
            <Icon width={22} height={22} className="text-rose" />
            <span className="text-[12px] font-medium">{label}</span>
          </Link>
        ))}
      </div>

      <SectionHeader title="Upcoming appointments" aside={<CalendarIcon width={16} height={16} />} />
      {upcoming.length === 0 ? (
        <EmptyState
          title="No upcoming appointments"
          body="When you book a stylist, your appointment shows up here with reminders and receipts."
          action={{ label: "Find a stylist", href: "/discover" }}
        />
      ) : (
        <div className="space-y-3">
          {upcoming.map((b) => (
            <BookingRow key={b.id} b={b} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <>
          <SectionHeader title="Past appointments" />
          <div className="space-y-3">
            {past.map((b) => (
              <BookingRow key={b.id} b={b} />
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}
