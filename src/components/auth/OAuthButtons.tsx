"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isLiveSupabase } from "@/lib/data/source";

// Google / Apple sign-in via Supabase OAuth. Requires the providers to be
// enabled + configured in the Supabase dashboard (client IDs/secrets); until
// then the buttons explain what's needed rather than failing silently.
export function OAuthButtons({ next = "/discover" }: { next?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const live = isLiveSupabase();

  async function signIn(provider: "google" | "apple") {
    if (!live) {
      setError("Connect a Supabase project and enable this provider to sign in with it.");
      return;
    }
    setLoading(provider);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setError(error.message);
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-[11px] uppercase tracking-wide text-ink-muted">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => signIn("google")}
          disabled={loading !== null}
          className="flex items-center justify-center gap-2 rounded-[12px] border border-border bg-surface py-3 text-sm font-semibold hover:bg-surface-hover disabled:opacity-50"
        >
          <span aria-hidden>G</span> Google
        </button>
        <button
          type="button"
          onClick={() => signIn("apple")}
          disabled={loading !== null}
          className="flex items-center justify-center gap-2 rounded-[12px] border border-border bg-surface py-3 text-sm font-semibold hover:bg-surface-hover disabled:opacity-50"
        >
          <span aria-hidden></span> Apple
        </button>
      </div>
      {error && <p className="text-center text-[12px] text-ink-muted">{error}</p>}
    </div>
  );
}
