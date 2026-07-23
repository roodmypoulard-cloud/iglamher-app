import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/marketplace/Shell";
import { AccountSettingsClient } from "@/components/profile/AccountSettingsClient";
import { IdVerificationCard } from "@/components/profile/IdVerificationCard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";
import { getAccountContext } from "@/lib/profile/account";
import { getMyIdVerificationAction } from "@/lib/profile/id-verification";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings · iGlamHer" };

type Provider = "email" | "google" | "apple";

export default async function SettingsPage() {
  if (!isLiveSupabase()) redirect("/signin?next=/profile/settings");
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/signin?next=/profile/settings");
  const user = auth.user;

  // Always-present columns and 0017 columns fetched separately so the page still
  // renders personal info even if migration 0017 hasn't been applied yet.
  const { data: base } = await supabase
    .from("profiles")
    .select("first_name, last_name, full_name, phone")
    .eq("id", user.id)
    .maybeSingle();
  const { data: status } = await supabase
    .from("profiles")
    .select("account_status, language, appearance, phone_verified")
    .eq("id", user.id)
    .maybeSingle();
  const p = { ...(base ?? {}), ...(status ?? {}) } as Record<string, string | null>;
  const phoneVerifiedFlag = Boolean((status as { phone_verified?: boolean } | null)?.phone_verified);
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("email, sms, push")
    .eq("user_id", user.id)
    .maybeSingle();
  const np = (prefs ?? {}) as Record<string, boolean>;
  const ctx = await getAccountContext();
  const idVerification = await getMyIdVerificationAction();

  // Verified reflects the profiles.phone_verified flag, which is set ONLY after an
  // OTP is confirmed (migration 0019; false/absent → not verified).
  const phoneVerified = phoneVerifiedFlag && Boolean(p.phone);

  const identities = (user.identities ?? []).map((i) => i.provider) as string[];
  const metaProviders = ((user.app_metadata?.providers as string[] | undefined) ?? []);
  const providers = Array.from(new Set([...identities, ...metaProviders, "email"])).filter((x): x is Provider =>
    x === "email" || x === "google" || x === "apple");

  return (
    <Shell back="/profile">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/profile" className="text-sm text-rose hover:underline">← Profile</Link>
      </div>
      <h1 className="mb-1 font-display text-3xl font-bold leading-tight">Settings</h1>
      <p className="mb-6 text-sm text-ink-muted">Manage your account, preferences, and privacy.</p>

      <AccountSettingsClient
        personal={{
          firstName: p.first_name ?? (p.full_name?.split(" ")[0] ?? ""),
          lastName: p.last_name ?? (p.full_name?.split(" ").slice(1).join(" ") ?? ""),
          phone: p.phone ?? "",
          email: user.email ?? "",
        }}
        phoneVerified={phoneVerified}
        accountType={ctx?.accountType ?? "customer"}
        activeMode={ctx?.activeMode ?? "customer"}
        accountStatus={(p.account_status as "active" | "paused" | "deactivated") ?? "active"}
        notif={{ email: np.email ?? true, sms: np.sms ?? true, push: np.push ?? true }}
        appearance={(p.appearance as "system" | "light" | "dark") ?? "system"}
        language={p.language ?? "en"}
        providers={providers}
      />

      <div className="mt-4">
        <IdVerificationCard initial={idVerification} />
      </div>
    </Shell>
  );
}
