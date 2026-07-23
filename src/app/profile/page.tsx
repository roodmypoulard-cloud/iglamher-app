import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/marketplace/Shell";
import { AvatarUpload } from "@/components/marketplace/AvatarUpload";
import { AccountTypeSettings } from "@/components/profile/AccountTypeSettings";
import { ProfileModeCard } from "@/components/profile/ProfileModeCard";
import { SignOutConfirm } from "@/components/auth/SignOutConfirm";
import { NotifCount } from "@/components/profile/NotifCount";
import {
  HeartIcon, CalendarIcon, ChatIcon, BellIcon, StarIcon, CreditCardIcon,
  ChevronRight, VerifiedIcon,
} from "@/components/ui/icons";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";
import { getProfileOverview } from "@/lib/profile/profile-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile · iGlamHer" };

type SVGProps = { width?: number; height?: number; className?: string };
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const GiftIcon = (p: SVGProps) => (<svg viewBox="0 0 24 24" {...stroke} {...p}><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M5 12v9h14v-9M12 8S9 3 6.5 4.5 8 8 12 8Zm0 0s3-5 5.5-3.5S16 8 12 8Z" /></svg>);
const HeadsetIcon = (p: SVGProps) => (<svg viewBox="0 0 24 24" {...stroke} {...p}><path d="M4 13a8 8 0 0 1 16 0M4 13v3a2 2 0 0 0 2 2h1v-6H6a2 2 0 0 0-2 2Zm16 0v3a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2Zm-3 5a4 4 0 0 1-4 3h-1" /></svg>);
const GearUserIcon = (p: SVGProps) => (<svg viewBox="0 0 24 24" {...stroke} {...p}><circle cx="10" cy="8" r="3.2" /><path d="M4 20c0-3.3 2.7-5.5 6-5.5" /><circle cx="17.5" cy="16.5" r="2" /><path d="M17.5 13v1.4M17.5 18.6V20M14 16.5h1.4M19.6 16.5H21M15.2 14.2l1 1M18.8 17.8l1 1M15.2 18.8l1-1M18.8 15.2l1-1" /></svg>);
const PinIcon = (p: SVGProps) => (<svg viewBox="0 0 24 24" {...stroke} {...p}><path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>);
const MailIcon = (p: SVGProps) => (<svg viewBox="0 0 24 24" {...stroke} {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>);

const accountTypeLabel = (t?: "customer" | "professional" | "both") =>
  t === "both" ? "Customer & Professional" : t === "professional" ? "Beauty Professional" : "Customer";

type Tile = { href: string; label: string; Icon: (p: SVGProps) => React.ReactElement; sub: React.ReactNode };

function TileRow({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-border bg-surface">
      <div className="grid grid-cols-4">
        {tiles.map((t, i) => (
          <Link
            key={t.href}
            href={t.href}
            aria-label={t.label}
            className={`flex min-h-[74px] flex-col items-center justify-center gap-1 px-1 py-2.5 text-center transition-colors hover:bg-surface-hover active:scale-[0.98] ${i > 0 ? "border-l border-border/40" : ""}`}
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-rose/[0.08] text-rose ring-1 ring-rose/20">
              <t.Icon width={18} height={18} />
            </span>
            <span className="text-[11.5px] font-semibold leading-tight text-ink">{t.label}</span>
            <span className="text-[10.5px] leading-tight text-ink-muted">{t.sub}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default async function ProfilePage() {
  if (isLiveSupabase()) {
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) redirect("/signin?next=/profile");
  }

  const o = await getProfileOverview();
  const name = o?.name ?? "You";
  const email = o?.email ?? "";
  const c = o?.counts ?? { favorites: 0, upcomingBookings: 0, conversations: 0, pendingReviews: 0, savedCards: 0, activePromotions: 0 };
  const isPro = Boolean(o?.isPro);
  const canSwitch = Boolean(o?.account?.canSwitch);
  const viewProfileHref = o?.proSlug ? `/professionals/${o.proSlug}` : "/profile/settings";

  const row1: Tile[] = [
    { href: "/account/favorites", label: "Favorites", Icon: HeartIcon, sub: `${c.favorites} saved` },
    { href: "/bookings", label: "My Bookings", Icon: CalendarIcon, sub: `${c.upcomingBookings} upcoming` },
    { href: "/messages", label: "Messages", Icon: ChatIcon, sub: `${c.conversations} chats` },
    { href: "/notifications", label: "Notifications", Icon: BellIcon, sub: <NotifCount /> },
  ];
  const row2: Tile[] = [
    { href: "/reviews", label: "Reviews", Icon: StarIcon, sub: `${c.pendingReviews} to leave` },
    { href: "/account/payment-methods", label: "Payments", Icon: CreditCardIcon, sub: `${c.savedCards} cards` },
    { href: "/account/rewards", label: "Promotions", Icon: GiftIcon, sub: `${c.activePromotions} active` },
    { href: "/how-it-works", label: "Support", Icon: HeadsetIcon, sub: "24/7 help" },
  ];

  return (
    <Shell>
      <div className="space-y-2.5">
        {/* Profile summary */}
        <section className="rounded-[22px] border border-border bg-surface p-3.5 shadow-luxe">
          <div className="flex gap-3">
            <div className="flex-none">
              <AvatarUpload name={name} initialUrl={o?.avatarUrl ?? null} size={60} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-bold leading-tight text-ink">{name}</h1>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[13px] font-semibold text-rose">
                    {accountTypeLabel(o?.account?.accountType)}
                    {o?.isVerified && <VerifiedIcon width={15} height={15} className="flex-none" />}
                  </p>
                </div>
                <Link
                  href={viewProfileHref}
                  className="flex min-h-[38px] flex-none items-center gap-0.5 rounded-full border border-rose/50 px-3.5 text-[13px] font-semibold text-rose transition-colors hover:bg-rose/10 active:scale-[0.98]"
                >
                  View Profile <ChevronRight width={14} height={14} />
                </Link>
              </div>
              {o?.location && (
                <p className="mt-1 flex items-center gap-1.5 truncate text-[12.5px] text-ink-secondary"><PinIcon width={13} height={13} className="flex-none" />{o.location}</p>
              )}
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12.5px] text-ink-muted"><MailIcon width={13} height={13} className="flex-none" />{email || "Add your email"}</p>
            </div>
          </div>
        </section>

        {/* Quick-action grid — two cards of four */}
        <div className="space-y-2">
          <TileRow tiles={row1} />
          <TileRow tiles={row2} />
        </div>

        {/* Account section */}
        <div>
          <h2 className="mb-2 font-display text-base font-bold">Account</h2>
          <Link
            href="/profile/settings"
            className="flex items-center gap-3 rounded-[20px] border border-border bg-surface p-3 transition-colors hover:border-rose/50 active:scale-[0.99]"
          >
            <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-rose/[0.08] text-rose ring-1 ring-rose/20">
              <GearUserIcon width={18} height={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">Account Settings</p>
              <p className="text-[12px] leading-snug text-ink-muted">Personal info, security, privacy, notifications &amp; more</p>
            </div>
            <ChevronRight width={20} height={20} className="flex-none text-ink-muted" />
          </Link>
        </div>

        {/* Account type + mode + dashboard */}
        {canSwitch && o?.account ? (
          <ProfileModeCard accountType={o.account.accountType} activeMode={o.account.activeMode} proComplete={Boolean(o?.proComplete)} />
        ) : (
          o?.account && <AccountTypeSettings accountType={o.account.accountType} activeMode={o.account.activeMode} />
        )}

        {/* You're a Pro! */}
        {isPro && (
          <div className="flex items-center gap-3 rounded-[20px] border border-border bg-surface p-3">
            <div className="relative grid h-11 w-11 flex-none place-items-center">
              <span aria-hidden className="absolute inset-0 rounded-full bg-gold/30 blur-xl" />
              <span className="relative text-[26px] leading-none">👑</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-bold text-ink">You&apos;re a Pro!</p>
              <p className="mt-0.5 text-[11.5px] leading-snug text-ink-muted">Grow your business and get discovered by more clients.</p>
            </div>
            <Link href="/how-it-works" className="flex min-h-[38px] flex-none items-center rounded-full rose-gradient px-3.5 text-[13px] font-bold text-[#2A1712] active:scale-[0.98]">
              View Tips
            </Link>
          </div>
        )}

        {/* Sign out */}
        <SignOutConfirm />
      </div>
    </Shell>
  );
}
