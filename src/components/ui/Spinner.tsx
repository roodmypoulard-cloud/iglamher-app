import { cn } from "@/lib/format";

export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      style={{ width: size, height: size }}
      className={cn(
        "inline-block animate-spin rounded-full border-2 border-border border-t-rose",
        className,
      )}
    />
  );
}

export function FullSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-muted">
      <Spinner size={28} />
      <p className="text-sm">{label}</p>
    </div>
  );
}
