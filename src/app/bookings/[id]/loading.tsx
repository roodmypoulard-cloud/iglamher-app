import { LoadingScreen } from "@/components/ui/LoadingScreen";

export default function BookingDetailLoading() {
  return (
    <LoadingScreen>
      <div className="h-5 w-24 rounded shimmer" />
      <div className="mt-6 h-7 w-2/3 rounded shimmer" />
      <div className="mt-2 h-4 w-1/3 rounded shimmer" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between rounded-[14px] border border-border p-4">
            <div className="h-4 w-1/4 rounded shimmer" />
            <div className="h-4 w-1/3 rounded shimmer" />
          </div>
        ))}
      </div>
      <div className="mt-6 h-12 w-full rounded-full shimmer" />
    </LoadingScreen>
  );
}
