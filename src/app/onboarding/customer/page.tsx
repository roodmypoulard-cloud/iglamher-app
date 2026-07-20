import { Field } from "@/components/auth/fields";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { finishCustomerOnboardingAction } from "@/lib/auth/actions";

// Customer onboarding — collects profile basics, then enters the marketplace.
export default function CustomerOnboarding() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-6 text-center">
        <p className="font-display text-2xl font-bold">Welcome to iGlamHer 💕</p>
        <p className="mt-1 text-sm text-ink-muted">A few details so we can personalize your beauty.</p>
      </div>
      <form action={finishCustomerOnboardingAction} className="space-y-4 rounded-[16px] border border-border bg-surface p-6">
        <Field label="Full name" id="fullName" type="text" autoComplete="name" placeholder="Your name" />
        <Field label="Phone" id="phone" type="tel" autoComplete="tel" placeholder="(555) 555-5555" />
        <Field label="City" id="city" type="text" placeholder="Los Angeles" defaultValue="Los Angeles" />
        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-semibold text-ink-muted">Notifications</legend>
          {[
            ["notif_email", "Email"],
            ["notif_sms", "Text messages"],
            ["notif_push", "Push notifications"],
          ].map(([id, label]) => (
            <label key={id} className="flex items-center gap-3 text-sm">
              <input type="checkbox" name={id} defaultChecked className="h-4 w-4 accent-rose" />
              {label}
            </label>
          ))}
        </fieldset>
        <SubmitButton>Finish &amp; explore</SubmitButton>
      </form>
    </main>
  );
}
