export default function ServiceLoading() {
  return (
    <div className="mx-auto w-full max-w-[440px] px-5 pt-6 md:max-w-3xl md:px-8 lg:max-w-5xl">
      <div className="h-4 w-24 rounded shimmer" />
      <div className="mt-4 h-8 w-2/3 rounded shimmer" />
      <div className="mt-2 h-4 w-1/2 rounded shimmer" />
      <div className="mt-5 aspect-[16/9] w-full rounded-[16px] shimmer" />
      <div className="mt-5 h-20 w-full rounded shimmer" />
    </div>
  );
}
