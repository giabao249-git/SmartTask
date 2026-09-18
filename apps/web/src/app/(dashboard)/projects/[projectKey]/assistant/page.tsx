import { Suspense } from "react";
import { AssistantView } from "@/features/assistant/AssistantView";
import { Skeleton } from "@/components/ui/skeleton";

export default function AssistantPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-6rem)] gap-4">
          <Skeleton className="w-72 h-full rounded-xl" />
          <Skeleton className="flex-1 h-full rounded-xl" />
          <Skeleton className="w-[420px] h-full rounded-xl" />
        </div>
      }
    >
      <AssistantView />
    </Suspense>
  );
}
