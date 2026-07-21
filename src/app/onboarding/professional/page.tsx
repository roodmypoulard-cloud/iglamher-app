import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/pro/ProfileForm";
import { PortfolioManager } from "@/components/pro/PortfolioManager";
import { CategorySelector } from "@/components/pro/CategorySelector";
import { StartOnboardingButton, SubmitForReviewButton } from "@/components/pro/OnboardingActions";
import { getProContext } from "@/lib/pro/context";
import { getPublishChecklist } from "@/lib/pro/onboarding-actions";
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

  // Draft (or rejected) — complete the profile and publish.
  const supabase = await createSupabaseServerClient();
  const { data: cats } = await supabase
    .from("professional_categories")
    .select("slug, label, sort_order")
    .order("sort_order");
  const { data: assigned } = await supabase
    .from("professional_category_assignments")
    .select("category_id, professional_categories(slug)")
    .eq("professional_id", ctx.pro.userId);
  const categories = ((cats as { slug: string; label: string }[] | null) ?? []).map((c) => ({ slug: c.slug, label: c.label }));
  const selectedSlugs = ((assigned as { professional_categories?: { slug?: string } }[] | null) ?? [])
    .map((a) => a.professional_categories?.slug)
    .filter((s): s is string => Boolean(s));
  const { missing, ready } = await getPublishChecklist(ctx.pro.userId);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-6 py-12">
      <p className="font-display text-2xl font-bold">Finish your provider profile</p>
      {reviewStatus === "rejected" && (
        <p className="mt-2 rounded-[10px] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          Your previous submission needs changes. Update your profile and resubmit.
        </p>
      )}
      <p className="mt-1 text-sm text-ink-muted">Progress saves as you go. Publish when your profile is complete.</p>

      <section className="mt-8">
        <h2 className="mb-4 font-display text-lg font-semibold">Profile</h2>
        <ProfileForm pro={ctx.pro} />
      </section>

      <section className="mt-10">
        <h2 className="mb-4 font-display text-lg font-semibold">What do you offer?</h2>
        <CategorySelector categories={categories} selected={selectedSlugs} />
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
        {ready ? (
          <p className="mb-4 text-sm text-ink">Your profile is complete. Publish to appear in the marketplace and take bookings.</p>
        ) : (
          <div className="mb-4">
            <p className="text-sm font-semibold text-ink">Before you can publish, add:</p>
            <ul className="mt-2 space-y-1 text-sm text-ink-muted">
              {missing.map((m) => (
                <li key={m} className="flex items-center gap-2">
                  <span aria-hidden className="text-rose">○</span> {m}
                </li>
              ))}
            </ul>
          </div>
        )}
        <SubmitForReviewButton />
      </div>
    </main>
  );
}
