import { redirect } from "next/navigation";
import { Shell } from "@/components/marketplace/Shell";
import { FavoritesView } from "@/components/marketplace/FavoritesView";
import { searchProfessionalViews } from "@/lib/data/professionals";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  // Require auth when a real DB is connected.
  if (isLiveSupabase()) {
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) redirect("/signin?next=/account/favorites");
  }

  // The client store (localStorage) decides which of these are shown as saved —
  // so favorites work with or without a database.
  const allPros = await searchProfessionalViews({});

  return (
    <Shell back="/account">
      <h1 className="font-display text-3xl font-bold leading-tight">Favorites</h1>
      <p className="mb-6 mt-1 text-sm text-ink-muted">Your saved professionals.</p>
      <FavoritesView allPros={allPros} />
    </Shell>
  );
}
