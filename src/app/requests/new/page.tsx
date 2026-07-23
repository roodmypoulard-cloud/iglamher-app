import { redirect } from "next/navigation";
import { Shell } from "@/components/marketplace/Shell";
import { CreateRequestForm } from "@/components/requests/CreateRequestForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create a Job · iGlamHer" };

export default async function NewRequestPage() {
  if (isLiveSupabase()) {
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) redirect("/signin?next=/requests/new");
  }

  return (
    <Shell back="/requests">
      <h1 className="font-display text-2xl font-bold">Create a job</h1>
      <p className="mb-4 mt-1 text-[13px] text-ink-secondary">
        Post what you need and let beauty professionals come to you.
      </p>
      <CreateRequestForm />
    </Shell>
  );
}
