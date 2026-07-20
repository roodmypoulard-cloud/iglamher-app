import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";

export type AccountType = "customer" | "professional" | "both";
export type AccountMode = "customer" | "professional";

export type AccountContext = {
  userId: string;
  accountType: AccountType;
  activeMode: AccountMode;
  canSwitch: boolean; // true for professional/both accounts
};

/**
 * Reads the signed-in user's account type + active mode. Tolerant of the
 * pre-0016 schema: if the columns don't exist yet it falls back to customer,
 * so nothing breaks before the migration is applied.
 */
export async function getAccountContext(): Promise<AccountContext | null> {
  if (!isLiveSupabase()) return null;
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  let accountType: AccountType = "customer";
  let activeMode: AccountMode = "customer";
  const { data } = await supabase
    .from("profiles")
    .select("account_type, active_mode, role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const p = data as { account_type?: AccountType; active_mode?: AccountMode; role?: string } | null;
  if (p) {
    if (p.account_type) accountType = p.account_type;
    else if (p.role === "professional") accountType = "professional"; // pre-0016 fallback
    if (p.active_mode) activeMode = p.active_mode;
  }

  return {
    userId: auth.user.id,
    accountType,
    activeMode,
    canSwitch: accountType === "professional" || accountType === "both",
  };
}
