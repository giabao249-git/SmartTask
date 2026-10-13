import { Suspense } from "react";
import { ProjectDashboardView } from "@/features/dashboard/ProjectDashboardView";

export default function SprintsPage() {
  return (
    <Suspense>
      <ProjectDashboardView />
    </Suspense>
  );
}
