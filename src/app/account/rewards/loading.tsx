import { LoadingScreen } from "@/components/ui/LoadingScreen";

export default function RewardsLoading() {
  return (
    <LoadingScreen>
      <div className="h-8 w-1/3 rounded shimmer" />
      <div className="mt-6 rounded-[14px] border border-border p-6">
        <div className="h-4 w-1/4 rounded shimmer" />
        <div className="mt-3 h-9 w-1/2 rounded shimmer" />
        <div className="mt-3 h-4 w-2/3 rounded shimmer" />
      </div>
      <div className="mt-6 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between rounded-[14px] border border-border p-4">
            <div className="h-4 w-1/3 rounded shimmer" />
            <div className="h-4 w-1/5 rounded shimmer" />
          </div>
        ))}
      </div>
    </LoadingScreen>
  );
}
