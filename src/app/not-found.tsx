import { LinkButton } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-5xl font-bold text-rose">404</p>
      <h1 className="font-display text-2xl font-bold">We couldn&apos;t find that page</h1>
      <p className="text-sm text-ink-secondary">
        The professional or page you&apos;re looking for may have moved or is no longer available.
      </p>
      <LinkButton href="/discover" className="!w-auto px-8">
        Back to discover
      </LinkButton>
    </div>
  );
}
