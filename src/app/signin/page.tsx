import Image from "next/image";
import Link from "next/link";
import { SignInForm } from "@/components/auth/AuthForms";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="relative flex min-h-dvh w-full flex-col justify-center overflow-hidden px-6 py-12">
      {/* Same editorial cover as the landing, dimmed so the form stays legible */}
      <div className="absolute inset-0 -z-10">
        <Image src="/brand/hero.jpg" alt="" fill priority sizes="100vw" className="object-cover object-top" />
        <div className="absolute inset-0 bg-gradient-to-b from-bg/60 via-bg/88 to-bg" />
      </div>
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <Image src="/brand/logo-clear.png" alt="iGlamHer" width={280} height={155} priority className="mx-auto w-[58%] max-w-[220px]" />
          <p className="mt-3 font-display text-xl">Welcome back — let&apos;s glow</p>
        </div>
        <SignInForm next={next} />
        <div className="mt-5">
          <OAuthButtons next={next ?? "/discover"} />
        </div>
        <div className="mt-4 text-center text-sm">
          <Link href="/forgot-password" className="text-ink-muted hover:text-ink">
            Forgot password?
          </Link>
        </div>
        <p className="mt-5 text-center text-sm text-ink-muted">
          New to iGlamHer?{" "}
          <Link href="/signup" className="font-semibold text-rose">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
