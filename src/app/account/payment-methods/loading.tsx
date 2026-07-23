import { LoadingScreen } from "@/components/ui/LoadingScreen";

export default function PaymentMethodsLoading() {
  return (
    <LoadingScreen>
      <div className="h-5 w-24 rounded shimmer" />
      <div className="mt-6 h-8 w-1/2 rounded shimmer" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-24 w-full rounded-[16px] shimmer" />
        ))}
      </div>
      <div className="mt-4 h-13 w-full rounded-full shimmer" />
    </LoadingScreen>
  );
}
