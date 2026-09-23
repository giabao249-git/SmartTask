import { api } from "@/lib/api";
import { clearLastProject, readLastProject } from "@/lib/hooks/use-project";
import type { ProjectListItem, WorkspaceSummary } from "@/lib/types";

/**
 * Nơi cần tới sau khi đăng nhập / mở trang gốc:
 * 1. Dự án mở gần nhất (nếu còn tồn tại) — người dùng quay lại đúng chỗ đang làm.
 * 2. Workspace chỉ có đúng một dự án → vào thẳng dự án đó, khỏi phải bấm "Mở dự án".
 * 3. Còn lại → danh sách workspace để tự chọn.
 */
export async function resolveLandingPath(known?: WorkspaceSummary[]): Promise<string> {
  const last = readLastProject();
  if (last?.id) {
    try {
      await api.get<ProjectListItem>(`/projects/${last.id}`);
      return `/projects/${last.id}/dashboard`;
    } catch {
      clearLastProject(); // dự án đã xoá hoặc bị gỡ khỏi thành viên
    }
  }
  // Ngay sau khi đăng nhập, state workspaces trong closure có thể chưa kịp cập nhật → hỏi lại API
  let workspaces = known ?? [];
  if (workspaces.length === 0) {
    try {
      workspaces = await api.get<WorkspaceSummary[]>("/workspaces");
    } catch {
      return "/workspaces";
    }
  }
  const ws = workspaces[0];
  if (workspaces.length === 1 && ws) {
    try {
      const res = await api.get<{ items: ProjectListItem[] } | ProjectListItem[]>(`/workspaces/${ws.id}/projects`);
      const items = Array.isArray(res) ? res : res.items;
      const active = items.filter((p) => p.status === "ACTIVE");
      if (active.length === 1) return `/projects/${active[0].id}/dashboard`;
    } catch {
      // không lấy được danh sách → về màn workspace
    }
  }
  return "/workspaces";
}
