import Image from "next/image";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/AuthForms";

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <Image src="/brand/logo-word.png" alt="iGlamHer" width={180} height={38} className="mx-auto h-8 w-auto" priority />
        <p className="mt-3 font-display text-xl">Reset your password</p>
        <p className="mt-1 text-sm text-ink-muted">We&apos;ll email you a secure reset link.</p>
      </div>
      <ForgotPasswordForm />
      <p className="mt-5 text-center text-sm text-ink-muted">
        <Link href="/signin" className="font-semibold text-rose">Back to sign in</Link>
      </p>
    </main>
  );
}
