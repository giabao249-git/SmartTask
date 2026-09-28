/**
 * Đường dẫn trong thông báo phải là ROUTE CÓ THẬT của apps/web (app/(dashboard)/projects/[projectId]/…).
 * Trước 28/09 listener ghi `/p/ST/sprints`, `/p/ST/t/ST-6` — web không có route `/p`, bấm vào là 404.
 */
export const webLink = {
  task: (projectId: string, taskKey: string) =>
    `/projects/${projectId}/tasks/${taskKey}`,
  sprints: (projectId: string) => `/projects/${projectId}/settings?tab=sprints`,
  project: (projectId: string) => `/projects/${projectId}/dashboard`,
};
