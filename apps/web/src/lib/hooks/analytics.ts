"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { BurndownView, CapacityTableView, DashboardView, ExplainView, ForecastView, SkillMatrixView, WeekLoadView, WorkloadView } from "@/lib/types";

/** Số liệu do backend tính (docs 04) — web chỉ hiển thị, không tính lại. */
export function useDashboard(projectId: string) {
  return useQuery({ queryKey: ["projects", projectId, "dashboard"], queryFn: () => api.get<DashboardView>(`/projects/${projectId}/dashboard`), staleTime: 30_000 });
}

export function useProjectWorkload(projectId: string, weeks = 4, from?: string) {
  return useQuery({ queryKey: ["projects", projectId, "workload", weeks, from ?? ""], queryFn: () => api.get<WorkloadView>(`/projects/${projectId}/workload`, { weeks, from }) });
}

export function useWorkloadDetails(userId: string | null, week?: string) {
  return useQuery({
    queryKey: ["users", userId, "workload", week ?? ""],
    queryFn: () => api.get<WeekLoadView & { userId: string }>(`/users/${userId}/workload/details`, { week }),
    enabled: !!userId,
  });
}

export function useCapacityTable(projectId: string, sprintId?: string, enabled = true) {
  return useQuery({ queryKey: ["projects", projectId, "capacity-table", sprintId ?? ""], queryFn: () => api.get<CapacityTableView>(`/projects/${projectId}/capacity-table`, { sprintId }), enabled });
}

export function useSkillMatrix(wsId: string, projectId?: string, minLevel?: number) {
  return useQuery({ queryKey: ["workspaces", wsId, "skill-matrix", projectId ?? "", minLevel ?? ""], queryFn: () => api.get<SkillMatrixView>(`/workspaces/${wsId}/skill-matrix`, { projectId, minLevel }) });
}

export function useBurndown(sprintId: string | null) {
  return useQuery({ queryKey: ["sprints", sprintId, "burndown"], queryFn: () => api.get<BurndownView>(`/sprints/${sprintId}/burndown`), enabled: !!sprintId });
}

export function useForecast(sprintId: string | null) {
  return useQuery({ queryKey: ["sprints", sprintId, "forecast"], queryFn: () => api.get<ForecastView>(`/sprints/${sprintId}/forecast`), enabled: !!sprintId });
}

export type { ExplainView };
