"use client";
import { useActionState } from "react";
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
  return (
    <form action={action} className={card}>
      <Field label="Full name" id="fullName" type="text" autoComplete="name" placeholder="Your name" required />
      <Field label="Email" id="email" type="email" autoComplete="email" placeholder="you@email.com" required />
      <PasswordField label="Password" id="password" autoComplete="new-password" placeholder="At least 8 characters" required />
      <fieldset>
        <legend className="mb-1.5 block text-xs font-semibold text-ink-muted">I want to</legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-[10px] border border-border bg-bg px-3 py-2.5 text-sm has-[:checked]:border-rose has-[:checked]:bg-rose/10">
            <input type="radio" name="role" value="customer" defaultChecked className="h-4 w-4 accent-rose" />
            Book beauty services
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-[10px] border border-border bg-bg px-3 py-2.5 text-sm has-[:checked]:border-rose has-[:checked]:bg-rose/10">
            <input type="radio" name="role" value="professional" className="h-4 w-4 accent-rose" />
            Offer my services
          </label>
        </div>
      </fieldset>
      <FormMessage error={state?.error} success={state?.success} />
      <SubmitButton>Create account</SubmitButton>
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
