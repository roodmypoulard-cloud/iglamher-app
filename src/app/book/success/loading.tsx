import { LoadingScreen } from "@/components/ui/LoadingScreen";

export default function BookSuccessLoading() {
  return (
    <LoadingScreen>
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-[360px] rounded-[14px] border border-border p-6 text-center">
          <div className="mx-auto h-14 w-14 rounded-full shimmer" />
          <div className="mx-auto mt-4 h-6 w-2/3 rounded shimmer" />
          <div className="mx-auto mt-2 h-4 w-1/2 rounded shimmer" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="h-4 w-1/4 rounded shimmer" />
                <div className="h-4 w-1/3 rounded shimmer" />
              </div>
            ))}
          </div>
          <div className="mt-6 h-12 w-full rounded-full shimmer" />
        </div>
      </div>
    </LoadingScreen>
  );
}
