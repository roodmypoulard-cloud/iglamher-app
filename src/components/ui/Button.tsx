import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/format";

type Variant = "rose" | "ghost" | "outline";
const styles: Record<Variant, string> = {
  rose: "rose-gradient text-[#2A1712] shadow-[0_10px_26px_rgba(215,160,143,0.28)] hover:brightness-105",
  ghost: "bg-surface border border-border text-ink hover:bg-surface-hover",
  outline: "border border-rose text-rose hover:bg-rose/10",
};

const cls = (variant: Variant, full: boolean, extra?: string) =>
  cn(
    "inline-flex items-center justify-center gap-2 rounded-[12px] px-6 py-3.5 font-semibold",
    "transition-[transform,filter,background] duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-[0.97]",
    "disabled:opacity-45 disabled:pointer-events-none",
    full && "w-full",
    styles[variant],
    extra,
  );

export function Button({
  variant = "rose",
  full = false,
  className,
  children,
  ...props
}: { variant?: Variant; full?: boolean; children: ReactNode } & ComponentProps<"button">) {
  return (
    <button className={cls(variant, full, className)} {...props}>
      {children}
    </button>
  );
}

export function LinkButton({
  variant = "rose",
  full = false,
  className,
  children,
  href,
  ...props
}: { variant?: Variant; full?: boolean; children: ReactNode; href: string } & Omit<ComponentProps<typeof Link>, "href">) {
  return (
    <Link href={href} className={cls(variant, full, className)} {...props}>
      {children}
    </Link>
  );
}
