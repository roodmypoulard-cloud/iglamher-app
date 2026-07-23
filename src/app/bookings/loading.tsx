import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ListSkeleton } from "@/components/ui/states";

export default function BookingsLoading() {
  return (
    <LoadingScreen>
      <div className="h-8 w-1/3 rounded shimmer" />
      <div className="mt-2 h-4 w-1/2 rounded shimmer" />
      <div className="mt-6">
        <ListSkeleton count={4} />
      </div>
    </LoadingScreen>
  );
}
