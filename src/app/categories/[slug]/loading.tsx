import { GridSkeleton } from "@/components/ui/states";

export default function CategoryLoading() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-5 pt-6 md:px-8">
      <div className="aspect-[16/6] w-full rounded-[16px] shimmer" />
      <div className="mt-6">
        <GridSkeleton count={6} />
      </div>
    </div>
  );
}
