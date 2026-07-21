import Image from "next/image";
import Link from "next/link";
import { SignUpForm } from "@/components/auth/AuthForms";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

export default function SignUpPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <Image src="/brand/logo-word.png" alt="iGlamHer" width={180} height={38} className="mx-auto h-8 w-auto" priority />
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
    </main>
  );
}
