import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/format";

const fieldCls =
  "w-full rounded-[10px] border border-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-rose";

export function FieldShell({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-[11px] text-ink-muted">{hint}</span>}
      {error && (
        <span className="mt-1 block text-[11px] text-danger" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

export function TextInput({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldCls, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldCls, className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(fieldCls, className)} {...props}>
      {children}
    </select>
  );
}
