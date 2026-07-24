import Link from "next/link";
import Image from "next/image";
import { BackButton } from "@/components/ui/BackButton";
import { NotificationBell } from "@/components/notifications/NotificationBell";

/** Single compact top bar for the recommendation window, matching the mock:
 *  Back (left) · brand wordmark + tagline (center) · bell + menu (right).
 *  Page-local so Discover's AppHeader stays untouched. */
export function RecommendedTopbar() {
  return (
    <div className="mb-2 flex min-h-[56px] items-center justify-between gap-2">
      <div className="w-[84px] flex-none">
        <BackButton
          fallback="/discover"
          label="Back"
          className="!min-h-[36px] !border-0 !bg-transparent !px-0 !py-0 text-[13px] !backdrop-blur-none"
        />
      </div>

      <Link href="/discover" aria-label="iGlamHer home" className="flex min-w-0 flex-col items-center">
        <Image src="/brand/logo-word.png" alt="iGlamHer" width={450} height={174} priority className="h-7 w-auto object-contain" />
        <span className="mt-0.5 text-[7.5px] font-semibold uppercase tracking-[0.32em] text-rose-light/80">
          Beauty on Demand
        </span>
      </Link>

      <div className="flex w-[84px] flex-none items-center justify-end gap-2">
        <NotificationBell />
        <Link
          href="/profile/settings"
          aria-label="Account settings"
          className="menu-gold grid h-9 w-9 place-items-center rounded-full border border-rose/30 bg-surface/60"
        >
          <span aria-hidden className="flex w-[15px] flex-col gap-[3.5px]">
            <span className="menu-gold-bar" />
            <span className="menu-gold-bar" />
            <span className="menu-gold-bar" />
          </span>
        </Link>
      </div>
    </div>
  );
}
