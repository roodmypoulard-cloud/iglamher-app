import Image from "next/image";
import { ResetPasswordForm } from "@/components/auth/AuthForms";

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <Image src="/brand/logo-word.png" alt="iGlamHer" width={180} height={38} className="mx-auto h-8 w-auto" priority />
        <p className="mt-3 font-display text-xl">Choose a new password</p>
      </div>
      <ResetPasswordForm />
    </main>
  );
}
