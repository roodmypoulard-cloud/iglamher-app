import Image from "next/image";
import Link from "next/link";
import { SignUpForm } from "@/components/auth/AuthForms";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

export default function SignUpPage() {
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
          <p className="mt-3 font-display text-xl">Create your account</p>
        </div>
        <SignUpForm />
        <div className="mt-5">
          <OAuthButtons />
        </div>
        <p className="mt-5 text-center text-sm text-ink-muted">
          Already have an account?{" "}
          <Link href="/signin" className="font-semibold text-rose">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
