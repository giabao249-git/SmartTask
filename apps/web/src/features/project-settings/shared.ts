import { useQueryClient } from "@tanstack/react-query";
import { describeError } from "@/lib/api";
import { qk } from "@/lib/hooks/queries";
import { toast } from "sonner";

const TEXT: Record<string, string> = {
  VALIDATION_FAILED: "Dữ liệu không hợp lệ",
  SPRINT_ALREADY_ACTIVE: "Dự án đã có sprint đang chạy — đóng sprint đó trước",
  SPRINT_CLOSED: "Sprint đã đóng, không sửa được",
  FORBIDDEN: "Bạn không có quyền (cần PM hoặc quản trị workspace)",
  PROJECT_ARCHIVED: "Dự án đã lưu trữ",
  LABEL_NAME_TAKEN: "Nhãn trùng tên",
  COLUMN_NOT_EMPTY: "Cột còn task — chuyển hết task rồi mới bỏ cột",
};

/** Toast lỗi thống nhất cho các tab cấu hình; hiện thêm details.fields nếu API trả. */
export function toastApiError(e: unknown) {
  const { code, message } = describeError(e);
  const fields = (e as { details?: { fields?: string[] } })?.details?.fields;
  toast.error(TEXT[code] ?? message, { description: fields?.length ? fields.join("; ") : code });
}

/** Sau khi sửa dự án/sprint: làm mới GET /projects/:id (ProjectProvider) + sprint. */
export function useInvalidateProject(projectId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: qk.project(projectId) });
    qc.invalidateQueries({ queryKey: qk.sprints(projectId) });
    qc.invalidateQueries({ queryKey: ["projects", projectId, "tasks"] });
  };
}
