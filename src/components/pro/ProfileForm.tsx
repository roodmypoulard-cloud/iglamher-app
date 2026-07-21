"use client";
import { useActionState } from "react";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { saveProfileAction, type ActionState } from "@/lib/pro/actions";
import type { Professional } from "@/lib/data/model";

const inputCls = "w-full rounded-[10px] border border-border bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-rose";
const LOCATIONS = [
  { value: "in_salon", label: "At studio" },
  { value: "mobile", label: "Mobile" },
  { value: "both", label: "Both" },
];

function Field({ label, name, error, hint, children }: { label: string; name: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-[11px] text-ink-muted">{hint}</span>}
      {error && (
        <span id={`${name}-error`} className="mt-1 block text-[11px] text-danger">
          {error}
        </span>
      )}
    </label>
  );
}

export function ProfileForm({ pro }: { pro: Professional }) {
  const [state, action] = useActionState<ActionState, FormData>(saveProfileAction, undefined);
  const fe = state?.fieldErrors ?? {};

  return (
    <form action={action} className="max-w-xl space-y-5">
      {state?.error && (
        <p role="alert" className="rounded-[10px] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="rounded-[10px] border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">{state.success}</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Business name" name="businessName" error={fe.businessName}>
          <input name="businessName" defaultValue={pro.businessName} required className={inputCls} />
        </Field>
        <Field label="Primary specialty" name="primarySpecialty" error={fe.primarySpecialty}>
          <input name="primarySpecialty" defaultValue={pro.primarySpecialty} required className={inputCls} />
        </Field>
      </div>

      <Field label="Headline" name="headline" error={fe.headline} hint="Short tagline shown on cards">
        <input name="headline" defaultValue={pro.headline} className={inputCls} />
      </Field>

      <Field label="Bio" name="bio" error={fe.bio}>
        <textarea name="bio" defaultValue={pro.bio} rows={4} className={inputCls} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="City" name="city" error={fe.city}>
          <input name="city" defaultValue={pro.city} className={inputCls} />
        </Field>
        <Field label="ZIP" name="postalCode" error={fe.postalCode}>
          <input name="postalCode" defaultValue={pro.postalCode} className={inputCls} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Serves clients" name="locationType" error={fe.locationType}>
          <select name="locationType" defaultValue={pro.locationType} className={inputCls}>
            {LOCATIONS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mobile radius (mi)" name="serviceRadiusMiles" error={fe.serviceRadiusMiles}>
          <input name="serviceRadiusMiles" type="number" min={0} defaultValue={pro.serviceRadiusMiles} className={inputCls} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Years experience" name="yearsExperience" error={fe.yearsExperience}>
          <input name="yearsExperience" type="number" min={0} defaultValue={pro.yearsExperience} className={inputCls} />
        </Field>
        <Field label="Instagram" name="instagramHandle" error={fe.instagramHandle}>
          <input name="instagramHandle" defaultValue={pro.instagramHandle} className={inputCls} />
        </Field>
      </div>

      <Field label="Languages" name="languages" error={fe.languages} hint="Comma-separated">
        <input name="languages" defaultValue={pro.languages.join(", ")} className={inputCls} />
      </Field>
      <Field label="Specialties" name="specialties" error={fe.specialties} hint="Comma-separated">
        <input name="specialties" defaultValue={pro.specialties.join(", ")} className={inputCls} />
      </Field>
      <Field label="Cancellation policy" name="cancellationPolicy" error={fe.cancellationPolicy}>
        <textarea name="cancellationPolicy" defaultValue={pro.cancellationPolicy} rows={3} className={inputCls} />
      </Field>

      <p className="rounded-[10px] border border-border bg-bg-elevated px-4 py-3 text-[12px] text-ink-muted">
        Your public listing goes live once an admin approves your profile. You can&apos;t activate or verify your own
        account.
      </p>

      <SubmitButton className="!w-auto px-8">Save profile</SubmitButton>
    </form>
  );
}
