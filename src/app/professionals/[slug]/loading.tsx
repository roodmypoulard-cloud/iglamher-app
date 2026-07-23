export default function ProfessionalLoading() {
  return (
    <div className="mx-auto w-full max-w-[440px] px-5 pt-6 md:max-w-3xl md:px-8 lg:max-w-5xl">
      <div className="h-4 w-20 rounded shimmer" />
      <div className="mt-5 flex items-center gap-4">
        <div className="h-20 w-20 flex-none rounded-full shimmer" />
        <div className="min-w-0 flex-1">
          <div className="h-6 w-2/3 rounded shimmer" />
          <div className="mt-2 h-4 w-1/2 rounded shimmer" />
        </div>
      </div>
      <div className="mt-6 aspect-[16/9] w-full rounded-[16px] shimmer" />
      <div className="mt-6 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 w-full rounded-[16px] shimmer" />
        ))}
      </div>
    </div>
  );
}
