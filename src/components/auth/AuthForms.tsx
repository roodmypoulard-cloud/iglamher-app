"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import {
  signInAction,
  signUpAction,
  forgotPasswordAction,
  resetPasswordAction,
  type ActionState,
} from "@/lib/auth/actions";
import { Field, PasswordField, FormMessage } from "./fields";
import { SubmitButton } from "./SubmitButton";

const card = "space-y-4 rounded-[16px] border border-border bg-surface p-6";

const ACCOUNT_TYPES = [
  { value: "customer", title: "Book beauty services", desc: "Find and book trusted pros near you." },
  { value: "professional", title: "Offer my services", desc: "List your services and take bookings." },
  { value: "both", title: "Both", desc: "Book services and offer your own." },
] as const;

export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(signInAction, undefined);
  return (
    <form action={action} className={card}>
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="Email" id="email" type="email" autoComplete="email" placeholder="you@email.com" required />
      <PasswordField label="Password" id="password" autoComplete="current-password" placeholder="••••••••" required />
      <FormMessage error={state?.error} />
      <SubmitButton>Sign in</SubmitButton>
    </form>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState<ActionState, FormData>(signUpAction, undefined);
  const [step, setStep] = useState<1 | 2>(1);

  return (
    <form action={action} className={card}>
      {/* Step 1 — details. Kept mounted (hidden on step 2) so FormData is complete. */}
      <div className={step === 1 ? "space-y-4" : "hidden"}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" id="firstName" type="text" autoComplete="given-name" placeholder="First" required />
          <Field label="Last name" id="lastName" type="text" autoComplete="family-name" placeholder="Last" required />
        </div>
        <Field label="Email" id="email" type="email" autoComplete="email" placeholder="you@email.com" required />
        <Field label="Phone (optional)" id="phone" type="tel" autoComplete="tel" placeholder="(555) 555-5555" />
        <PasswordField label="Password" id="password" autoComplete="new-password" placeholder="At least 8 characters" required />
        <PasswordField label="Confirm password" id="confirmPassword" autoComplete="new-password" placeholder="Re-enter password" required />
        <label className="flex items-start gap-2 text-[13px] text-ink-muted">
          <input type="checkbox" name="acceptTerms" value="true" required className="mt-0.5 h-4 w-4 accent-rose" />
          <span>
            I agree to the{" "}
            <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-rose underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-rose underline">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        <button
          type="button"
          onClick={() => setStep(2)}
          className="w-full rounded-full rose-gradient px-6 py-3 text-sm font-semibold text-[#2A1712]"
        >
          Continue
        </button>
      </div>

      {/* Step 2 — account type selection. */}
      <div className={step === 2 ? "space-y-4" : "hidden"}>
        <div className="flex items-center justify-between">
          <p className="font-display text-lg font-semibold">How will you use iGlamHer?</p>
          <button type="button" onClick={() => setStep(1)} className="text-sm text-rose hover:underline">
            ← Back
          </button>
        </div>
        <fieldset className="space-y-2">
          <legend className="sr-only">Account type</legend>
          {ACCOUNT_TYPES.map((t, i) => (
            <label
              key={t.value}
              className="flex cursor-pointer items-start gap-3 rounded-[12px] border border-border bg-bg px-4 py-3 has-[:checked]:border-rose has-[:checked]:bg-rose/10"
            >
              <input
                type="radio"
                name="accountType"
                value={t.value}
                defaultChecked={i === 0}
                className="mt-1 h-4 w-4 accent-rose"
              />
              <span>
                <span className="block text-sm font-semibold text-ink">{t.title}</span>
                <span className="block text-[12px] text-ink-muted">{t.desc}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <FormMessage error={state?.error} success={state?.success} />
        <SubmitButton>Create account</SubmitButton>
      </div>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState<ActionState, FormData>(forgotPasswordAction, undefined);
  return (
    <form action={action} className={card}>
      <Field label="Email" id="email" type="email" autoComplete="email" placeholder="you@email.com" required />
      <FormMessage error={state?.error} success={state?.success} />
      <SubmitButton>Send reset link</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState<ActionState, FormData>(resetPasswordAction, undefined);
  return (
    <form action={action} className={card}>
      <PasswordField label="New password" id="password" autoComplete="new-password" placeholder="At least 8 characters" required />
      <FormMessage error={state?.error} />
      <SubmitButton>Update password</SubmitButton>
    </form>
  );
}
