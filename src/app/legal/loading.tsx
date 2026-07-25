import { LoadingScreen } from "@/components/ui/LoadingScreen";

export default function LegalLoading() {
  return (
    <LoadingScreen>
      <div className="h-8 w-2/3 rounded shimmer" />
      <div className="mt-2 h-4 w-1/3 rounded shimmer" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className={`h-4 rounded shimmer ${i % 4 === 3 ? "w-2/3" : "w-full"}`} />
        ))}
      </div>
    </LoadingScreen>
  );
}
