export default function BookLoading() {
  return (
    <div className="mx-auto w-full max-w-[440px] px-5 pt-6 md:max-w-3xl md:px-8 lg:max-w-5xl">
      <div className="h-4 w-20 rounded shimmer" />
      <div className="mt-4 h-7 w-1/2 rounded shimmer" />
      <div className="mt-5 h-24 w-full rounded-[16px] shimmer" />
      <div className="mt-6 h-4 w-32 rounded shimmer" />
      <div className="mt-3 grid grid-cols-4 gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 rounded-[12px] shimmer" />
        ))}
      </div>
      <div className="mt-6 h-12 w-full rounded-full shimmer" />
    </div>
  );
}
