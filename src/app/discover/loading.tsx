import { GridSkeleton } from "@/components/ui/states";

export default function DiscoverLoading() {
  return (
    <div className="mx-auto w-full max-w-[440px] px-5 pt-6 md:max-w-3xl md:px-8 lg:max-w-5xl">
      <div className="h-8 w-1/2 rounded shimmer" />
      <div className="mt-3 h-12 w-full rounded-[14px] shimmer" />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-[3/4] rounded-[16px] shimmer" />
        ))}
      </div>
      <div className="mt-8">
        <GridSkeleton count={3} />
      </div>
    </div>
  );
}
