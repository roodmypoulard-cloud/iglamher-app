import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/marketplace/Shell";
import { RequestsTabs } from "@/components/requests/RequestsTabs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";
import { listMyRequests, listOpenRequests } from "@/lib/requests/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Job Marketplace · iGlamHer" };

export default async function RequestsPage() {
  let userId: string | null = null;
  if (isLiveSupabase()) {
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) redirect("/signin?next=/requests");
    userId = auth.user.id;
  }

  const [open, mine] = await Promise.all([
    listOpenRequests({ excludeUserId: userId ?? undefined }),
    userId ? listMyRequests(userId) : Promise.resolve([]),
  ]);

  return (
    <Shell back="/discover">
      <h1 className="font-display text-2xl font-bold">Job Marketplace</h1>
      <p className="mt-1 text-[13px] text-ink-secondary">
        Tell beauty professionals what you need — or browse what others are booking.
      </p>

      {/* Hero create CTA */}
      <Link
        href="/requests/new"
        className="fab-gold mt-4 flex items-center gap-3 rounded-[20px] p-4 text-[#2A1712]"
      >
        <span aria-hidden className="fab-gold-shine rounded-[20px]" />
        <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-[#2A1712]/10">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15.5px] font-bold leading-tight">Create a job</span>
          <span className="mt-0.5 block text-[12px] font-medium opacity-80">Makeup, hair, nails, bridal, events &amp; more</span>
        </span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className="flex-none">
          <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>

      <div className="mt-5">
        <RequestsTabs open={open} mine={mine} />
      </div>
    </Shell>
  );
}
