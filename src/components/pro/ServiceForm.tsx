"use client";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { saveServiceAction, type ActionState } from "@/lib/pro/actions";
import type { ServiceRow } from "@/lib/data/model";

const CATEGORIES = [
  { value: "hair", label: "Hair" },
  { value: "makeup", label: "Makeup" },
  { value: "lashes", label: "Lashes" },
  { value: "nails", label: "Nails" },
  { value: "stylist", label: "Stylist" },
];
const LOCATIONS = [
  { value: "in_salon", label: "At studio" },
  { value: "mobile", label: "Mobile" },
  { value: "both", label: "Both" },
];

function Field({
  label,
  name,
  error,
  children,
  hint,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
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

const inputCls =
  "w-full rounded-[10px] border border-border bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-rose";

export function ServiceForm({ service }: { service?: ServiceRow }) {
  const router = useRouter();
  const bound = saveServiceAction.bind(null, service?.id ?? null);
  const [state, action] = useActionState<ActionState, FormData>(bound, undefined);
  const fe = state?.fieldErrors ?? {};

  return (
    <form action={action} className="max-w-xl space-y-5">
      {state?.error && (
        <p role="alert" className="rounded-[10px] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="rounded-[10px] border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
          {state.success}
        </p>
      )}

      <Field label="Service name" name="name" error={fe.name}>
        <input name="name" defaultValue={service?.name} required className={inputCls} placeholder="e.g. Soft Glam" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Category" name="category" error={fe.category}>
          <select name="category" defaultValue={service?.categorySlug ?? "makeup"} className={inputCls}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Where" name="locationType" error={fe.locationType}>
          <select name="locationType" defaultValue={service?.locationType ?? "both"} className={inputCls}>
            {LOCATIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Description" name="description" error={fe.description}>
        <textarea
          name="description"
          defaultValue={service?.description}
          rows={3}
          className={inputCls}
          placeholder="What's included, what to expect…"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Price (USD)" name="priceDollars" error={fe.priceDollars}>
          <input
            name="priceDollars"
            type="number"
            min={0}
            step="1"
            required
            defaultValue={service ? service.priceCents / 100 : ""}
            className={inputCls}
          />
        </Field>
        <Field label="Duration (min)" name="durationMin" error={fe.durationMin}>
          <input
            name="durationMin"
            type="number"
            min={5}
            step="5"
            required
            defaultValue={service?.durationMin ?? 60}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Buffer before (min)" name="bufferBeforeMin" error={fe.bufferBeforeMin} hint="0–240">
          <input name="bufferBeforeMin" type="number" min={0} max={240} defaultValue={service?.bufferBeforeMin ?? 0} className={inputCls} />
        </Field>
        <Field label="Buffer after (min)" name="bufferAfterMin" error={fe.bufferAfterMin} hint="0–240">
          <input name="bufferAfterMin" type="number" min={0} max={240} defaultValue={service?.bufferAfterMin ?? 15} className={inputCls} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Deposit %" name="depositPercent" error={fe.depositPercent} hint="Charged upfront to hold the slot">
          <input name="depositPercent" type="number" min={0} max={100} defaultValue={service?.depositValue ?? 20} className={inputCls} />
        </Field>
        <Field label="Travel fee (USD)" name="travelFeeDollars" error={fe.travelFeeDollars} hint="Optional">
          <input
            name="travelFeeDollars"
            type="number"
            min={0}
            defaultValue={service?.travelFeeCents != null ? service.travelFeeCents / 100 : ""}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-5">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="priceIsFrom" value="true" defaultChecked={service?.priceIsFrom} className="h-4 w-4 accent-[#D7A08F]" />
          Show as “from” price
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="instantBook" value="true" defaultChecked={service?.instantBook} className="h-4 w-4 accent-[#D7A08F]" />
          Instant booking
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" value="true" defaultChecked={service?.isActive ?? true} className="h-4 w-4 accent-[#D7A08F]" />
          Active (visible)
        </label>
      </div>

      <div className="flex gap-3 pt-2">
        <SubmitButton className="!w-auto px-8">{service ? "Save changes" : "Create service"}</SubmitButton>
        <Button type="button" variant="ghost" className="!w-auto px-6" onClick={() => router.push("/pro/services")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
