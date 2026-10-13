import { Suspense } from "react";
import { ProjectDashboardView } from "@/features/dashboard/ProjectDashboardView";

export default function DashboardPage() {
  return (
    <Suspense>
      <ProjectDashboardView />
    </Suspense>
  );
}
