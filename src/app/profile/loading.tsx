import { LoadingScreen } from "@/components/ui/LoadingScreen";

export default function ProfileLoading() {
  return (
    <LoadingScreen>
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 flex-none rounded-full shimmer" />
        <div className="flex-1 space-y-2">
          <div className="h-6 w-1/2 rounded shimmer" />
          <div className="h-4 w-1/3 rounded shimmer" />
        </div>
      </div>
      <div className="mt-8 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 w-full rounded-[14px] shimmer" />
        ))}
      </div>
    </LoadingScreen>
  );
}
