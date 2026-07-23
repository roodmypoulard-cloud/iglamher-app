import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ListSkeleton } from "@/components/ui/states";

export default function RequestsLoading() {
  return (
    <LoadingScreen>
      <div className="h-8 w-1/2 rounded shimmer" />
      <div className="mt-2 h-4 w-2/3 rounded shimmer" />
      <div className="mt-4 h-[76px] rounded-[20px] shimmer" />
      <div className="mt-5 h-11 rounded-full shimmer" />
      <div className="mt-3">
        <ListSkeleton count={4} />
      </div>
    </LoadingScreen>
  );
}
