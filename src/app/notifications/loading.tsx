import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ListSkeleton } from "@/components/ui/states";

export default function NotificationsLoading() {
  return (
    <LoadingScreen>
      <div className="h-8 w-1/2 rounded shimmer" />
      <div className="mt-6">
        <ListSkeleton count={5} />
      </div>
    </LoadingScreen>
  );
}
