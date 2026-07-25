import { LoadingScreen } from "@/components/ui/LoadingScreen";

export default function ExploreLoading() {
  return (
    <LoadingScreen>
      <div className="h-8 w-1/3 rounded shimmer" />
      <div className="mt-6 grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-[14px] border border-border p-3">
            <div className="aspect-square w-full rounded-[10px] shimmer" />
            <div className="mt-3 h-4 w-3/4 rounded shimmer" />
            <div className="mt-2 h-3 w-1/2 rounded shimmer" />
          </div>
        ))}
      </div>
    </LoadingScreen>
  );
}
