"use client";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/format";

export function SubmitButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "w-full rounded-[12px] px-6 py-3.5 font-semibold rose-gradient text-[#2A1712]",
        "shadow-[0_10px_26px_rgba(215,160,143,0.28)] transition-[transform,filter] duration-200",
        "active:scale-[.99] disabled:opacity-60 disabled:pointer-events-none",
        className,
      )}
    >
      {pending ? "Please wait…" : children}
    </button>
  );
}
