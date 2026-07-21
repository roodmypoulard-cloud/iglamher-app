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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <Image src="/brand/logo-word.png" alt="iGlamHer" width={180} height={38} className="mx-auto h-8 w-auto" priority />
        <p className="mt-3 font-display text-xl">Welcome back, gorgeous</p>
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
    </main>
  );
}
