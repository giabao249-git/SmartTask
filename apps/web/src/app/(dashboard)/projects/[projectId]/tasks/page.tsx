import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskListView } from "@/features/tasks/TaskListView";

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <TaskListView />
    </Suspense>
  );
}
