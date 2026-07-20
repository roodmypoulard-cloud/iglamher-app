import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/pro/ProfileForm";
import { PortfolioManager } from "@/components/pro/PortfolioManager";
import { StartOnboardingButton, SubmitForReviewButton } from "@/components/pro/OnboardingActions";
import { getProContext } from "@/lib/pro/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";

export const dynamic = "force-dynamic";

const CHECKLIST = [
  "Business name & bio",
  "Service categories & area",
  "Profile & portfolio images",
  "Services & prices",
  "Availability",
];

async function reviewState(userId: string): Promise<{ reviewStatus: string; isActive: boolean }> {
  if (!isLiveSupabase()) return { reviewStatus: "draft", isActive: false };
  const supabase = await createSupabaseServerClient();
  // is_active always exists; fetch it independently so visibility resolves even
  // if migration 0015 (review_status) has not been applied yet.
  const { data: activeRow } = await supabase
    .from("professional_profiles")
    .select("is_active")
    .eq("user_id", userId)
    .maybeSingle();
  const isActive = Boolean((activeRow as { is_active?: boolean } | null)?.is_active);
  const { data: rev } = await supabase
    .from("professional_profiles")
    .select("review_status")
    .eq("user_id", userId)
    .maybeSingle();
  const reviewStatus = (rev as { review_status?: string } | null)?.review_status ?? "draft";
  return { reviewStatus, isActive };
}

export default async function ProfessionalOnboarding() {
  const ctx = await getProContext();
  if (!ctx.authed) redirect("/signin?next=/onboarding/professional");

  // No provider profile yet — show the intro + create-account CTA.
  if (!ctx.pro) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-lg px-6 py-12">
        <p className="font-display text-2xl font-bold">Become an iGlamHer pro</p>
        <p className="mt-1 text-sm text-ink-muted">Set up your profile, portfolio, and prices. You keep 85%.</p>
        <ul className="mt-6 space-y-2">
          {CHECKLIST.map((s, i) => (
            <li key={s} className="flex items-center gap-3 rounded-[12px] border border-border bg-surface px-4 py-3 text-sm">
              <span className="grid h-6 w-6 flex-none place-items-center rounded-full border border-border text-xs font-bold text-ink-muted">{i + 1}</span>
              <span className="text-ink">{s}</span>
            </li>
          ))}
        </ul>
        <p className="mb-6 mt-6 text-xs text-ink-muted">
          After you submit, an iGlamHer admin reviews your profile before it goes live. You won’t appear in the marketplace or take bookings until you’re approved.
        </p>
        <StartOnboardingButton />
      </main>
    );
  }

  const { reviewStatus, isActive } = await reviewState(ctx.pro.userId);

  // Approved & live.
  if (isActive) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-lg px-6 py-12">
        <p className="font-display text-2xl font-bold">You’re live 🎉</p>
        <p className="mt-1 text-sm text-ink-muted">Your profile is approved and visible in the marketplace.</p>
        <Link href="/pro" className="mt-6 inline-block rounded-full rose-gradient px-6 py-3 text-sm font-semibold text-[#2A1712]">
          Go to your dashboard
        </Link>
      </main>
    );
  }

  // Submitted, awaiting admin approval.
  if (reviewStatus === "pending_review") {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-lg px-6 py-12">
        <p className="font-display text-2xl font-bold">Under review</p>
        <p className="mt-1 text-sm text-ink-muted">
          Thanks — your profile is with our team. We’ll email you once you’re approved and live. You can still edit your details below.
        </p>
        <div className="mt-8">
          <ProfileForm pro={ctx.pro} />
        </div>
      </main>
    );
  }

  // Draft (or rejected) — complete the profile and submit.
  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-6 py-12">
      <p className="font-display text-2xl font-bold">Finish your provider profile</p>
      {reviewStatus === "rejected" && (
        <p className="mt-2 rounded-[10px] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          Your previous submission needs changes. Update your profile and resubmit.
        </p>
      )}
      <p className="mt-1 text-sm text-ink-muted">Progress saves as you go. Submit when you’re ready for review.</p>

      <section className="mt-8">
        <h2 className="mb-4 font-display text-lg font-semibold">Profile</h2>
        <ProfileForm pro={ctx.pro} />
      </section>

      <section className="mt-10">
        <h2 className="mb-4 font-display text-lg font-semibold">Portfolio</h2>
        <PortfolioManager items={ctx.pro.portfolio} />
      </section>

      <section className="mt-10 grid gap-3 sm:grid-cols-2">
        <Link href="/pro/services" className="rounded-[12px] border border-border bg-surface px-4 py-3 text-sm font-semibold text-ink hover:border-rose">
          Services & prices →
        </Link>
        <Link href="/pro/availability" className="rounded-[12px] border border-border bg-surface px-4 py-3 text-sm font-semibold text-ink hover:border-rose">
          Availability →
        </Link>
      </section>

      <div className="mt-10 border-t border-border pt-6">
        <p className="mb-4 text-sm text-ink-muted">
          Ready? Submitting sends your profile for admin approval. You won’t be public or bookable until approved.
        </p>
        <SubmitForReviewButton />
      </div>
    </main>
  );
}
