import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ListSkeleton } from "@/components/ui/states";

export default function MessagesLoading() {
  return (
    <LoadingScreen>
      <div className="h-8 w-1/3 rounded shimmer" />
      <div className="mt-6">
        <ListSkeleton count={6} />
      </div>
    </LoadingScreen>
  );
}
