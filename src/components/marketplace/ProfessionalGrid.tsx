import type { ProfessionalCardView } from "@/lib/data/model";
import { ProfessionalCard } from "./ProfessionalCard";
import { EmptyState } from "@/components/ui/states";

export function ProfessionalGrid({
  pros,
  favoritedIds = [],
  emptyTitle = "No professionals found",
  emptyBody = "Try widening your distance, clearing a filter, or searching a different service.",
}: {
  pros: ProfessionalCardView[];
  favoritedIds?: string[];
  emptyTitle?: string;
  emptyBody?: string;
}) {
  if (pros.length === 0) {
    return <EmptyState title={emptyTitle} body={emptyBody} action={{ label: "Browse all", href: "/discover" }} />;
  }
  const favSet = new Set(favoritedIds);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {pros.map((p) => (
        <ProfessionalCard key={p.userId} pro={p} favorited={favSet.has(p.userId)} />
      ))}
    </div>
  );
}
