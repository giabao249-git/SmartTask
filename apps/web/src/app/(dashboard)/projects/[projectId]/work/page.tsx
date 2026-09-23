import { Suspense } from "react";
import { WorkView } from "@/features/work/WorkView";

export default function WorkPage() {
  return (
    <Suspense>
      <WorkView />
    </Suspense>
  );
}
