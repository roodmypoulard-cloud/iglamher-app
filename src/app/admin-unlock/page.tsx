import { redirect } from "next/navigation";
import { requireAdminRole } from "@/lib/admin/require-admin-page";
import { isGateConfigured, isGateUnlocked } from "@/lib/admin/gate";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminUnlockForm } from "@/components/admin/AdminUnlockForm";
import { isLiveSupabase } from "@/lib/data/source";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin unlock · iGlamHer" };

export default async function AdminUnlockPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = next?.startsWith("/admin") ? next : "/admin";

  await requireAdminRole("/admin");

  // Already unlocked, or no passcode set yet → go straight in.
  if (isLiveSupabase()) {
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    const configured = await isGateConfigured();
    if (!configured || (uid && (await isGateUnlocked(uid)))) redirect(target);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center px-6">
      <span className="grid h-14 w-14 place-items-center rounded-full gold-glossy" aria-hidden>
        <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="#2a1c08" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
      </span>
      <h1 className="mt-4 font-display text-2xl font-bold text-ink">Admin access</h1>
      <p className="mt-1 text-center text-[13px] text-ink-secondary">Enter your admin passcode to continue.</p>
      <AdminUnlockForm next={target} />
    </main>
  );
}
