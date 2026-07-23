import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { GridSkeleton } from "@/components/ui/states";

export default function RecommendedLoading() {
  return (
    <LoadingScreen>
      <div className="h-8 w-1/2 rounded shimmer" />
      <div className="mt-2 h-4 w-2/3 rounded shimmer" />
      <div className="mt-4">
        <GridSkeleton />
      </div>
    </LoadingScreen>
  );
}
