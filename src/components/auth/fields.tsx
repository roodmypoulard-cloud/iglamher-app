"use client";
import { useState, type ComponentProps } from "react";

export function Field({
  label,
  id,
  ...props
}: { label: string; id: string } & ComponentProps<"input">) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-ink-muted">
        {label}
      </label>
      <input
        id={id}
        name={id}
        className="w-full rounded-[12px] border border-border bg-bg-elevated px-4 py-3.5 text-[15px] outline-none transition-colors duration-200 focus:border-rose"
        {...props}
      />
    </div>
  );
}

export function PasswordField({
  label,
  id,
  ...props
}: { label: string; id: string } & ComponentProps<"input">) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-ink-muted">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={show ? "text" : "password"}
          className="w-full rounded-[12px] border border-border bg-bg-elevated px-4 py-3.5 pr-16 text-[15px] outline-none transition-colors duration-200 focus:border-rose"
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-rose"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

export function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  return (
    <p
      role={error ? "alert" : "status"}
      className={`text-sm ${error ? "text-danger" : "text-success"}`}
    >
      {error ?? success}
    </p>
  );
}
