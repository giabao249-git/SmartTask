"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ProjectDetail, ProjectListItem, SkillView, WorkspaceListItem, WorkspaceMemberView, SprintView } from "@/lib/types";

/** Khoá query tập trung — invalidation theo tiền tố. */
export const qk = {
  workspaces: ["workspaces"] as const,
  projects: (wsId: string) => ["workspaces", wsId, "projects"] as const,
  members: (wsId: string) => ["workspaces", wsId, "members"] as const,
  project: (id: string) => ["projects", id] as const,
  sprints: (id: string) => ["projects", id, "sprints"] as const,
  skills: (wsId: string) => ["workspaces", wsId, "skills"] as const,
};

export function useSkills(wsId: string | undefined) {
  return useQuery({ queryKey: qk.skills(wsId ?? ""), queryFn: () => api.get<SkillView[]>(`/workspaces/${wsId}/skills`), enabled: !!wsId, staleTime: 5 * 60_000 });
}

export function useWorkspaces() {
  return useQuery({ queryKey: qk.workspaces, queryFn: () => api.get<WorkspaceListItem[]>("/workspaces") });
}

export function useProjects(wsId: string | undefined) {
  return useQuery({
    queryKey: qk.projects(wsId ?? ""),
    queryFn: () => api.get<ProjectListItem[]>(`/workspaces/${wsId}/projects`),
    enabled: !!wsId,
  });
}

export function useProject(id: string | undefined) {
  return useQuery({ queryKey: qk.project(id ?? ""), queryFn: () => api.get<ProjectDetail>(`/projects/${id}`), enabled: !!id });
}

export function useWorkspaceMembers(wsId: string | undefined) {
  return useQuery({
    queryKey: qk.members(wsId ?? ""),
    queryFn: () => api.get<WorkspaceMemberView[]>(`/workspaces/${wsId}/members`),
    enabled: !!wsId,
  });
}

export function useSprints(projectId: string | undefined) {
  return useQuery({
    queryKey: qk.sprints(projectId ?? ""),
    queryFn: () => api.get<SprintView[]>(`/projects/${projectId}/sprints`),
    enabled: !!projectId,
  });
}
