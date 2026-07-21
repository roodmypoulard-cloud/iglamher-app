import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell, SectionHeader } from "@/components/marketplace/Shell";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { AvatarUpload } from "@/components/marketplace/AvatarUpload";
import { AccountTypeSettings } from "@/components/profile/AccountTypeSettings";
import { HeartIcon, CalendarIcon, ChatIcon, BellIcon } from "@/components/ui/icons";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";
import { getAccountContext } from "@/lib/profile/account";

export const dynamic = "force-dynamic";

async function loadAccount(): Promise<{ name: string; email: string; avatarUrl: string | null }> {
  const fallback = { name: "You", email: "", avatarUrl: null };
  if (!isLiveSupabase()) return fallback;
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fallback;
  const { data } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", auth.user.id)
    .maybeSingle();
  const p = data as { full_name: string | null; avatar_url: string | null } | null;
  return {
    name: p?.full_name || auth.user.email?.split("@")[0] || "You",
    email: auth.user.email ?? "",
    avatarUrl: p?.avatar_url ?? null,
  };
}

const QUICK_LINKS = [
  { href: "/account/favorites", label: "Favorites", Icon: HeartIcon },
  { href: "/bookings", label: "My bookings", Icon: CalendarIcon },
  { href: "/messages", label: "Messages", Icon: ChatIcon },
  { href: "/notifications", label: "Notifications", Icon: BellIcon },
];

export default async function ProfilePage() {
  if (isLiveSupabase()) {
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) redirect("/signin?next=/profile");
  }
  const account = await loadAccount();
  const ctx = await getAccountContext();

  return (
    <Shell>
      <header className="flex items-center gap-4">
        <AvatarUpload name={account.name} initialUrl={account.avatarUrl} size={64} />
        <div>
          <h1 className="font-display text-2xl font-bold leading-tight">{account.name}</h1>
          <p className="text-sm text-ink-muted">{account.email}</p>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK_LINKS.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-2 rounded-[16px] border border-border bg-surface px-3 py-4 text-center transition-colors hover:border-rose/50"
          >
            <Icon width={22} height={22} className="text-rose" />
            <span className="text-[12px] font-medium">{label}</span>
          </Link>
        ))}
      </div>

      <SectionHeader title="Account" />
      {ctx ? (
        <AccountTypeSettings accountType={ctx.accountType} activeMode={ctx.activeMode} />
      ) : (
        <div className="card-luxe px-4 py-4 text-sm text-ink-muted">Sign in to manage your account.</div>
      )}

      <SectionHeader title="Payment methods" />
      <div className="rounded-[14px] border border-border bg-surface px-4 py-4 text-sm text-ink-muted">
        <p>No payment method saved.</p>
        <p className="mt-1 text-[12px]">Your card is entered securely at checkout.</p>
      </div>

      <div className="pt-8">
        <SignOutButton />
      </div>
    </Shell>
  );
}
