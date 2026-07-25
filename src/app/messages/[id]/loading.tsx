import { LoadingScreen } from "@/components/ui/LoadingScreen";

export default function ConversationLoading() {
  return (
    <LoadingScreen>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full shimmer" />
        <div className="h-5 w-1/3 rounded shimmer" />
      </div>
      <div className="mt-6 flex flex-col gap-3">
        <div className="h-10 w-3/5 self-start rounded-2xl shimmer" />
        <div className="h-14 w-2/3 self-end rounded-2xl shimmer" />
        <div className="h-10 w-1/2 self-start rounded-2xl shimmer" />
        <div className="h-10 w-3/5 self-end rounded-2xl shimmer" />
        <div className="h-14 w-2/3 self-start rounded-2xl shimmer" />
      </div>
      <div className="mt-8 h-12 w-full rounded-full shimmer" />
    </LoadingScreen>
  );
}
