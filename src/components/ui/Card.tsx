import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/format";

type Base = { children: ReactNode; className?: string; interactive?: boolean };

const base = (interactive?: boolean, extra?: string) =>
  cn(
    "rounded-[16px] border border-border bg-surface",
    interactive && "transition-colors duration-200 hover:border-rose/50",
    extra,
  );

/** Surface card. Pass `href` to render as a link, otherwise a div. */
export function Card({
  children,
  className,
  interactive,
  href,
  ...rest
}: Base & { href?: string } & Omit<ComponentProps<"div">, "className">) {
  if (href) {
    return (
      <Link href={href} className={base(interactive ?? true, className)}>
        {children}
      </Link>
    );
  }
  return (
    <div className={base(interactive, className)} {...rest}>
      {children}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("p-4", className)}>{children}</div>;
}
