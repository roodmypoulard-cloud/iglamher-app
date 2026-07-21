import { GridSkeleton } from "@/components/ui/states";

export default function FavoritesLoading() {
  return (
    <div className="mx-auto w-full max-w-[440px] px-5 pt-6 md:max-w-3xl md:px-8 lg:max-w-5xl">
      <div className="h-8 w-1/3 rounded shimmer" />
      <div className="mt-6">
        <GridSkeleton count={3} />
      </div>
    </div>
  );
}
