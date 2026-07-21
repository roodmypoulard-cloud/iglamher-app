import { GridSkeleton } from "@/components/ui/states";

export default function SearchLoading() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-5 py-8 md:px-8">
      <div className="mb-6 h-12 w-full animate-pulse rounded-[14px] bg-surface" />
      <GridSkeleton count={6} />
    </div>
  );
}
