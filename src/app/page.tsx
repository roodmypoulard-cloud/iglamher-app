import Image from "next/image";
import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";

export default function LandingPage() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <Image
          src="/brand/hero.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-bg/45 via-bg/65 to-bg" />
      </div>

      <div className="flex flex-1 flex-col items-center justify-end px-6 pb-16 text-center md:justify-center md:pb-0">
        <div className="fade-in mx-auto flex max-w-md flex-col items-center">
          <Image
            src="/brand/logo-clear.png"
            alt="iGlamHer"
            width={360}
            height={200}
            priority
            className="w-[80%] max-w-[340px]"
          />
          <div className="mt-10 w-full max-w-xs space-y-3">
            <LinkButton href="/signup" full>
              Get started
            </LinkButton>
            <p className="text-sm text-ink-muted">
              Already have an account?{" "}
              <Link href="/signin" className="font-semibold text-rose">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
