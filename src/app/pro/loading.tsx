import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { GridSkeleton } from "@/components/ui/states";

export default function ProLoading() {
  return (
    <LoadingScreen>
      <div className="h-8 w-1/2 rounded shimmer" />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-[16px] shimmer" />
        ))}
      </div>
      <div className="mt-8">
        <GridSkeleton count={3} />
      </div>
    </LoadingScreen>
  );
}
