import { signOutAction } from "@/lib/auth/actions";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button type="submit" className="w-full rounded-[14px] border border-border bg-surface px-4 py-3.5 text-left text-sm font-semibold text-danger">
        Sign out
      </button>
    </form>
  );
}
