export default function AdminLoading() {
  return (
    <div>
      <div className="h-8 w-1/3 rounded shimmer" />
      <div className="mt-2 h-4 w-1/2 rounded shimmer" />
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-[14px] border border-border p-4">
            <div className="h-4 w-1/2 rounded shimmer" />
            <div className="mt-3 h-7 w-2/3 rounded shimmer" />
          </div>
        ))}
      </div>
      <div className="mt-6 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between rounded-[14px] border border-border p-4">
            <div className="h-4 w-1/4 rounded shimmer" />
            <div className="h-4 w-1/3 rounded shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}
