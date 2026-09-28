import { Suspense } from "react";
import { SprintsView } from "@/features/sprints/SprintsView";

export default function SprintsPage() {
  return (
    <Suspense>
      <SprintsView />
    </Suspense>
  );
}
