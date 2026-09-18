"use client";

import * as React from "react";
import type { ProjectDetail } from "@/lib/types";

/** Dự án đang mở (nạp ở layout /projects/[projectId]); AppShell và các màn con đọc từ đây, không tra lại. */
const ProjectContext = React.createContext<ProjectDetail | null>(null);

export const LAST_PROJECT_KEY = "st.lastProject";

export function ProjectProvider({ project, children }: { project: ProjectDetail; children: React.ReactNode }) {
  React.useEffect(() => {
    try {
      localStorage.setItem(LAST_PROJECT_KEY, JSON.stringify({ id: project.id, key: project.key, name: project.name }));
    } catch {
      // bộ nhớ trình duyệt không khả dụng — bỏ qua
    }
  }, [project.id, project.key, project.name]);
  return <ProjectContext.Provider value={project}>{children}</ProjectContext.Provider>;
}

export function useProjectContext(): ProjectDetail | null {
  return React.useContext(ProjectContext);
}

export function useCurrentProject(): ProjectDetail {
  const p = React.useContext(ProjectContext);
  if (!p) throw new Error("useCurrentProject phải nằm trong ProjectProvider");
  return p;
}

/** Dự án mở gần nhất (để sidebar còn link khi đang ở /workspaces hay /settings). */
export function readLastProject(): { id: string; key: string; name: string } | null {
  try {
    const raw = localStorage.getItem(LAST_PROJECT_KEY);
    return raw ? (JSON.parse(raw) as { id: string; key: string; name: string }) : null;
  } catch {
    return null;
  }
}
