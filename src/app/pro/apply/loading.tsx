export default function Loading() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-5 py-8 md:py-12">
      <div className="h-8 w-1/2 rounded shimmer" />
      <div className="mt-2 h-4 w-3/4 rounded shimmer" />
      <div className="mt-6 h-1.5 w-full rounded shimmer" />
      <div className="mt-6 h-80 w-full rounded-[18px] shimmer" />
    </main>
  );
}
