import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanBoard } from "@/features/board/KanbanBoard";

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <KanbanBoard />
    </Suspense>
  );
}
