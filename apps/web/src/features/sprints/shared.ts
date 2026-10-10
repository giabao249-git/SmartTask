import { useQueryClient } from "@tanstack/react-query";
import { describeError } from "@/lib/api";
import { qk } from "@/lib/hooks/queries";
import type { SprintView } from "@/lib/types";
import { toast } from "sonner";

/** YYYY-MM-DD theo giờ MÁY NGƯỜI DÙNG (không dùng toISOString: trước 7 giờ sáng giờ VN sẽ ra hôm qua). */
export function localIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "2026-09-29" → "29/09" */
export const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Giờ: bỏ số lẻ vô nghĩa, dấu phẩy thập phân kiểu Việt ("30,6 h") */
export const hrs = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString("vi-VN")} h`;

/** Sprint khác (chưa đóng) có khoảng ngày chồng lên [start, end] — chỉ để cảnh báo, không chặn. */
export function overlapping(sprints: SprintView[], start: string, end: string, exceptId?: string): SprintView | undefined {
  return sprints.find((s) => s.id !== exceptId && s.status !== "CLOSED" && s.startDate.slice(0, 10) <= end && s.endDate.slice(0, 10) >= start);
}

const TEXT: Record<string, string> = {
  VALIDATION_FAILED: "Dữ liệu không hợp lệ",
  SPRINT_ALREADY_ACTIVE: "Dự án đã có sprint đang chạy",
  SPRINT_NOT_ACTIVE: "Sprint không ở trạng thái cho phép thao tác này",
  FORBIDDEN: "Bạn không có quyền (cần PM hoặc quản trị workspace)",
  PROJECT_ARCHIVED: "Dự án đã lưu trữ",
};

export function toastSprintError(e: unknown) {
  const { code, message } = describeError(e);
  const details = (e as { details?: { fields?: string[]; active?: { name?: string } } })?.details;
  const extra = details?.active?.name ? `Đang chạy: ${details.active.name}` : details?.fields?.join("; ");
  toast.error(TEXT[code] ?? message, { description: extra ?? code });
}

/** Sau khi đổi sprint hoặc chuyển việc: làm mới dự án (activeSprint), danh sách sprint, tóm tắt, việc. */
export function useInvalidateSprints(projectId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: qk.project(projectId) });
    void qc.invalidateQueries({ queryKey: qk.sprints(projectId) });
    void qc.invalidateQueries({ queryKey: ["projects", projectId, "tasks"] });
    void qc.invalidateQueries({ queryKey: ["projects", projectId, "dashboard"] });
    void qc.invalidateQueries({ queryKey: ["sprints"] });
  };
}
