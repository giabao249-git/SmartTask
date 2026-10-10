"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { BurndownView, CapacityTableView, DashboardView, EvidenceItemView, ExplainView, ForecastView, MemberProfileView, PendingReviewView, SkillMatrixView, SprintSummaryView, WeekLoadView, WorkloadView } from "@/lib/types";

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

/** Tóm tắt sprint: cam kết, năng lực nhóm, theo người, việc bị đẩy/thêm giữa chừng (GET /sprints/:id/summary). */
export function useSprintSummary(sprintId: string | null) {
  return useQuery({ queryKey: ["sprints", sprintId, "summary"], queryFn: () => api.get<SprintSummaryView>(`/sprints/${sprintId}/summary`), enabled: !!sprintId });
}

/** Hồ sơ kỹ năng từ bằng chứng của thành viên dự án (docs 02/08) */
export function useSkillProfiles(projectId: string) {
  return useQuery({ queryKey: ["projects", projectId, "skill-profiles"], queryFn: () => api.get<MemberProfileView[]>(`/projects/${projectId}/skill-profiles`) });
}

/** Các việc làm nên mức kỹ năng của một người — tải khi mở phần "vì sao" */
export function useSkillEvidence(projectId: string, userId: string | null, skillId?: string) {
  return useQuery({
    queryKey: ["projects", projectId, "skill-profiles", userId, "evidence", skillId ?? ""],
    queryFn: () => api.get<EvidenceItemView[]>(`/projects/${projectId}/skill-profiles/${userId}/evidence`, { skillId }),
    enabled: !!userId,
  });
}

/** Việc đã xong chưa đánh giá (PM) */
export function usePendingReviews(projectId: string, enabled: boolean) {
  return useQuery({ queryKey: ["projects", projectId, "reviews", "pending"], queryFn: () => api.get<PendingReviewView[]>(`/projects/${projectId}/reviews/pending`), enabled });
}

export type { ExplainView };
