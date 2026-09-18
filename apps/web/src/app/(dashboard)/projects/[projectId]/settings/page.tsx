import { Suspense } from "react";
import { ProjectSettingsView } from "@/features/project-settings/ProjectSettingsView";

export default function ProjectSettingsPage() {
  return (
    <Suspense>
      <ProjectSettingsView />
    </Suspense>
  );
}
