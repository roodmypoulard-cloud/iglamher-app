import type { ReactNode } from "react";
import { LinkButton, Button } from "./Button";

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="card-luxe flex flex-col items-center gap-3 px-6 py-14 text-center">
      {icon && <div className="text-rose">{icon}</div>}
      <h3 className="font-display text-xl font-semibold text-ink">{title}</h3>
      {body && <p className="max-w-sm text-sm text-ink-secondary">{body}</p>}
      {action && (
        <LinkButton href={action.href} className="mt-2">
          {action.label}
        </LinkButton>
      )}
    </div>
  );
}

/**
 * Error state with an optional retry action. `onRetry` is only ever passed from
 * a client component (e.g. an error boundary); server callers omit it.
 */
export function ErrorState({
  title = "Something went wrong",
  body,
  onRetry,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="card-luxe flex flex-col items-center gap-3 border-danger/40 px-6 py-12 text-center">
      <h3 className="font-display text-xl font-semibold text-ink">{title}</h3>
      <p className="max-w-sm text-sm text-ink-secondary">
        {body ?? "We couldn't load this right now. Please try again in a moment."}
      </p>
      {onRetry && (
        <Button variant="outline" className="mt-1 !w-auto px-6" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[16px] border border-border">
      <div className="aspect-[4/3] w-full shimmer" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-2/3 rounded shimmer" />
        <div className="h-3 w-1/2 rounded shimmer" />
        <div className="h-3 w-1/3 rounded shimmer" />
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3.5 rounded-[16px] border border-border p-3">
          <div className="h-16 w-16 flex-none rounded-[15px] shimmer" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/2 rounded shimmer" />
            <div className="h-3 w-2/3 rounded shimmer" />
            <div className="h-3 w-1/3 rounded shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}
