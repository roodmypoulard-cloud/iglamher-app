import { LoadingScreen } from "@/components/ui/LoadingScreen";

export default function AccountLoading() {
  return (
    <LoadingScreen>
      <div className="h-8 w-1/3 rounded shimmer" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 w-full rounded-[14px] shimmer" />
        ))}
      </div>
    </LoadingScreen>
  );
}
