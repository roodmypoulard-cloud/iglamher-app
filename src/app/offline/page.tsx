import Image from "next/image";

export const metadata = { title: "Offline · iGlamHer" };

export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <Image src="/brand/logo-word.png" alt="iGlamHer" width={140} height={30} className="h-7 w-auto" priority />
      <h1 className="mt-2 font-display text-2xl font-bold">You&apos;re offline</h1>
      <p className="text-sm text-ink-secondary">
        Check your connection and try again. Your saved pages and images are still available.
      </p>
    </div>
  );
}
