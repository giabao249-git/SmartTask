import type { CodeMap, ProjectMember } from "@/lib/types";

/**
 * Mã ngắn u/t/s/k (docs 05 §3.1) → tên hiển thị. Chỉ tra bảng `code_map` server trả kèm proposal;
 * không suy đoán khi mã không có trong bảng (in nguyên mã).
 */
export interface CodeResolver {
  user(code: string | null | undefined): { id: string; name: string } | null;
  userCodeOf(userId: string): string | null;
  sprint(code: string | null | undefined): string | null;
  /** "k3≥2" → "NestJS≥2" khi có danh mục; mã lạ giữ nguyên */
  skillLabel(text: string): string;
}

export function makeResolver(
  codeMap: CodeMap | null | undefined,
  members: ProjectMember[],
  sprints: { id: string; name: string }[],
  skills: { id: string; name: string }[] = [],
): CodeResolver {
  const users = codeMap?.users ?? {};
  const skillName = new Map(skills.map((s) => [s.id, s.name]));
  const byId = new Map(members.map((m) => [m.id, m]));
  const reverse = new Map(Object.entries(users).map(([code, id]) => [id, code]));
  const sprintById = new Map(sprints.map((s) => [s.id, s.name]));
  return {
    user(code) {
      if (!code) return null;
      const id = users[code];
      if (!id) return null;
      const m = byId.get(id);
      return { id, name: m ? (m.shortName ?? m.fullName) : "(ngoài dự án)" };
    },
    userCodeOf(userId) {
      return reverse.get(userId) ?? null;
    },
    sprint(code) {
      if (!code) return null;
      const id = codeMap?.sprints?.[code];
      return id ? (sprintById.get(id) ?? code) : null;
    },
    skillLabel(text) {
      return text.replace(/^(k\d+)/, (m) => {
        const id = codeMap?.skills?.[m];
        return (id && skillName.get(id)) || m;
      });
    },
  };
}

export const KIND_LABEL: Record<string, string> = {
  DECOMPOSE: "Phân rã yêu cầu",
  TASK_DRAFT: "Tạo công việc",
  TASK_UPDATE: "Sửa công việc thật",
  ASSIGN: "Đề xuất giao việc",
  REBALANCE: "Cân bằng tải",
  RESCHEDULE: "Dời lịch",
};

export const ACTION_LABEL: Record<string, string> = {
  DECOMPOSE_PROPOSAL: "Đề xuất phân rã",
  CREATE_TASK_DRAFT: "Bản nháp công việc",
  UPDATE_TASK_DRAFT: "Sửa bản nháp",
  DISCARD_DRAFT: "Bỏ bản nháp",
  ASSIGN_PROPOSAL: "Đề xuất giao việc",
  REBALANCE_PROPOSAL: "Đề xuất cân bằng",
  RISK_EXPLANATION: "Giải thích rủi ro",
  MEMORY_PROPOSAL: "Đề xuất ghi nhớ",
  ASK_CLARIFICATION: "Cần làm rõ",
  CHAT_RESPONSE: "Trả lời",
};

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
