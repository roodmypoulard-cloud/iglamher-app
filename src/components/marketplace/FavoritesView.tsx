"use client";
import { useMemo } from "react";
import type { ProfessionalCardView } from "@/lib/data/model";
import { ProfessionalCard } from "./ProfessionalCard";
import { EmptyState, GridSkeleton } from "@/components/ui/states";
import { HeartIcon } from "@/components/ui/icons";
import { useFavorites } from "@/lib/favorites/provider";

export function FavoritesView({ allPros }: { allPros: ProfessionalCardView[] }) {
  const { ids, hydrated } = useFavorites();
  const saved = useMemo(() => allPros.filter((p) => ids.has(p.userId)), [allPros, ids]);

  if (!hydrated) return <GridSkeleton count={3} />;

  if (saved.length === 0) {
    return (
      <EmptyState
        icon={<HeartIcon width={28} height={28} />}
        title="No favorites yet"
        body="Tap the heart on any professional to save them here for quick rebooking."
        action={{ label: "Discover professionals", href: "/discover" }}
      />
    );
  }

  return (
    <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {saved.map((p) => (
        <ProfessionalCard key={p.userId} pro={p} favorited />
      ))}
    </div>
  );
}
