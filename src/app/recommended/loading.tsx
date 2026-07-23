import { LoadingScreen } from "@/components/ui/LoadingScreen";

/** Skeletons mirroring the recommendation cards (image left, details right). */
export default function RecommendedLoading() {
  return (
    <LoadingScreen>
      <div className="mx-auto h-9 w-2/3 rounded shimmer" />
      <div className="mx-auto mt-2 h-4 w-5/6 rounded shimmer" />
      <div className="mt-4 h-[52px] rounded-[16px] shimmer" />
      <div className="mt-4 flex gap-2.5 overflow-hidden">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-[76px] w-[76px] flex-none rounded-[18px] shimmer" />)}
      </div>
      <div className="mt-3 h-[52px] rounded-[14px] shimmer" />
      <div className="mt-4 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex h-[180px] overflow-hidden rounded-[22px] border border-border">
            <div className="w-[38%] shimmer" />
            <div className="flex-1 space-y-2.5 p-4">
              <div className="h-5 w-3/5 rounded shimmer" />
              <div className="h-3.5 w-2/5 rounded shimmer" />
              <div className="h-3.5 w-1/2 rounded shimmer" />
              <div className="h-6 w-4/5 rounded-full shimmer" />
            </div>
          </div>
        ))}
      </div>
    </LoadingScreen>
  );
}
