/**
 * Bảng ánh xạ trạng thái sang variant của Badge/Button theo chuẩn design system SmartTask.
 * Không quyết định màu hex hoặc class màu tùy ý trong component — chỉ dùng qua các hàm này.
 */

export type WorkloadLevel = "NORMAL" | "HIGH" | "FULL" | "OVERLOAD";
export type PriorityLevel = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
export type TaskType = "STORY" | "TASK" | "BUG";
export type BurnoutLevel = "NORMAL" | "MONITOR" | "WARNING";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "info";

/**
 * Ánh xạ mức tải sang variant:
 * < 70%: Bình thường (success)
 * 70 - 90%: Cao (warning)
 * 90 - 110%: Đầy (warning)
 * > 110%: Quá tải (destructive)
 */
export function levelToVariant(level: WorkloadLevel | string): BadgeVariant {
  switch (level) {
    case "NORMAL":
    case "Bình thường":
      return "success";
    case "HIGH":
    case "Cao":
    case "FULL":
    case "Đầy":
      return "warning";
    case "OVERLOAD":
    case "Quá tải":
      return "destructive";
    default:
      return "secondary";
  }
}

/**
 * Tính mức tải từ phần trăm (0 - 200%)
 */
export function percentToWorkload(percent: number): {
  level: WorkloadLevel;
  label: string;
  variant: BadgeVariant;
} {
  if (percent < 70) {
    return { level: "NORMAL", label: "Bình thường", variant: "success" };
  }
  if (percent <= 90) {
    return { level: "HIGH", label: "Cao", variant: "warning" };
  }
  if (percent <= 110) {
    return { level: "FULL", label: "Đầy", variant: "warning" };
  }
  return { level: "OVERLOAD", label: "Quá tải", variant: "destructive" };
}

/**
 * Ánh xạ mức ưu tiên sang variant Badge:
 * Thấp -> outline, Trung bình -> secondary, Cao -> warning, Khẩn -> destructive
 */
export function priorityToVariant(p: PriorityLevel | string): BadgeVariant {
  switch (p) {
    case "LOW":
    case "Thấp":
      return "outline";
    case "MEDIUM":
    case "Trung bình":
      return "secondary";
    case "HIGH":
    case "Cao":
      return "warning";
    case "URGENT":
    case "Rất cao":
    case "Khẩn":
      return "destructive";
    default:
      return "secondary";
  }
}

/**
 * Màu dải nhấn (accent strip) cho thanh Gantt theo priority — khớp màu với priorityToVariant
 * (LOW≈outline, MEDIUM≈secondary, HIGH≈warning, URGENT≈destructive) để nhất quán
 * với Badge priority hiển thị ở hover card/footer legend.
 * Dùng làm nền cho 1 dải phủ mỏng bên trái (không dùng CSS border) để tránh xung đột
 * với tailwind-merge — class "border-{color}" (toàn viền) và "border-l-{color}" (viền trái)
 * cùng nhóm xung đột trong twMerge nên sẽ bị loại bỏ lẫn nhau nếu kết hợp cả hai.
 */
export function priorityToAccentColor(p: PriorityLevel | string): string {
  switch (p) {
    case "LOW":
    case "Thấp":
      return "bg-border";
    case "MEDIUM":
    case "Trung bình":
      return "bg-muted-foreground/50";
    case "HIGH":
    case "Cao":
      return "bg-warning";
    case "URGENT":
    case "Rất cao":
    case "Khẩn":
      return "bg-destructive";
    default:
      return "bg-border";
  }
}

/**
 * Ánh xạ trạng thái task sang variant Badge
 */
export function statusToVariant(s: TaskStatus | string): BadgeVariant {
  switch (s) {
    case "TODO":
    case "Cần làm":
      return "outline";
    case "IN_PROGRESS":
    case "Đang làm":
      return "default";
    case "REVIEW":
    case "Review":
      return "warning";
    case "DONE":
    case "Hoàn thành":
      return "success";
    default:
      return "secondary";
  }
}

/**
 * Ánh xạ điểm nguy cơ Burnout (0 - 100) sang nhãn và variant
 */
export function burnoutToVariant(score: number): {
  level: BurnoutLevel;
  label: string;
  variant: BadgeVariant;
} {
  if (score >= 70) {
    return { level: "WARNING", label: "Cảnh báo", variant: "destructive" };
  }
  if (score >= 50) {
    return { level: "MONITOR", label: "Theo dõi", variant: "warning" };
  }
  return { level: "NORMAL", label: "Bình thường", variant: "success" };
}

/**
 * Ánh xạ rủi ro Sprint (Thấp / Trung bình / Cao)
 */
export function riskToVariant(r: RiskLevel | string): BadgeVariant {
  switch (r) {
    case "LOW":
    case "Thấp":
      return "success";
    case "MEDIUM":
    case "Trung bình":
      return "warning";
    case "HIGH":
    case "Cao":
      return "destructive";
    default:
      return "secondary";
  }
}

/**
 * Trạng thái bản nháp AI (docs 12 §6): DRAFT viền info "AI · chờ duyệt"; APPLIED success (xanh lá);
 * DISCARDED gạch ngang mờ; EXPIRED warning. Mọi màu thẻ nháp đi qua đây.
 */
export type DraftItemStatus = "DRAFT" | "APPLIED" | "DISCARDED";
export type ProposalStatus = "DRAFT" | "APPLIED" | "REJECTED" | "EXPIRED";

export function draftItemToVariant(s: DraftItemStatus | string): BadgeVariant {
  switch (s) {
    case "DRAFT":
      return "info";
    case "APPLIED":
      return "success";
    default:
      return "secondary";
  }
}

export function draftItemClasses(s: DraftItemStatus | string): string {
  switch (s) {
    case "DRAFT":
      return "border-info/40 bg-info/5 hover:border-info/70";
    case "APPLIED":
      return "border-success/40 bg-success/10";
    default:
      return "border-border/40 bg-muted/30 opacity-60";
  }
}

export function proposalToVariant(s: ProposalStatus | string): BadgeVariant {
  switch (s) {
    case "DRAFT":
      return "info";
    case "APPLIED":
      return "success";
    case "EXPIRED":
      return "warning";
    default:
      return "secondary";
  }
}

/**
 * Loại công việc (docs 02/05 §E1) — enum cố định 3 giá trị, mọi loại dùng chung một luồng cột.
 * Màu và nhãn chỉ lấy từ đây, component không tự quyết.
 */
export function typeToVariant(t: TaskType | string): BadgeVariant {
  switch (t) {
    case "BUG":
      return "destructive";
    case "STORY":
      return "info";
    default:
      return "secondary";
  }
}

export function typeToLabel(t: TaskType | string): string {
  switch (t) {
    case "STORY":
      return "Tính năng";
    case "BUG":
      return "Lỗi";
    default:
      return "Việc chung";
  }
}

/** Mô tả để đặt vào title/Tooltip — giúp người mới biết chọn loại nào. */
export function typeToHint(t: TaskType | string): string {
  switch (t) {
    case "STORY":
      return "Tính năng người dùng nhìn thấy được";
    case "BUG":
      return "Sửa lỗi đã có trong sản phẩm";
    default:
      return "Việc kỹ thuật, nghiên cứu, cấu hình";
  }
}

export const TASK_TYPES: TaskType[] = ["STORY", "TASK", "BUG"];

/** Trạng thái sprint — nhãn tiếng Việt và màu dùng chung mọi màn (tab Sprint, ô lọc, thanh hàng loạt, chat). */
export function sprintStatusLabel(s: string): string {
  switch (s) {
    case "ACTIVE":
      return "Đang chạy";
    case "PLANNED":
      return "Kế hoạch";
    case "CLOSED":
      return "Đã đóng";
    default:
      return s;
  }
}

export function sprintStatusVariant(s: string): BadgeVariant {
  return s === "ACTIVE" ? "success" : s === "PLANNED" ? "info" : "secondary";
}

/** Nguyên nhân rủi ro do ForecastService đo (docs 04 §8) — câu tiếng Việt thay cho mã máy "OVERDUE ×7". */
export function causeLabel(code: string, n: number): string {
  switch (code) {
    case "OVERDUE":
      return `${n} việc quá hạn`;
    case "UNASSIGNED":
      return `${n} việc chưa giao`;
    case "OVERLOADED_MEMBER":
      return `${n} người quá tải`;
    case "BLOCKED":
      return `${n} việc bị chặn`;
    case "BIG_NOT_STARTED":
      return `${n} việc lớn chưa bắt đầu`;
    case "SCOPE_CREEP":
      return `phạm vi tăng ${n} ngày`;
    default:
      return `${code} ×${n}`;
  }
}

/** Mức tải từ API (NORMAL/HIGH/FULL/OVERLOAD) → chữ tiếng Việt; trước đây badge in thẳng "NORMAL". */
export function workloadLevelLabel(level: string): string {
  return ({ NORMAL: "Bình thường", HIGH: "Cao", FULL: "Đầy", OVERLOAD: "Quá tải" } as Record<string, string>)[level] ?? level;
}

/** Vai trong dự án */
export function projectRoleLabel(role: string): string {
  return ({ PM: "PM", MEMBER: "Thành viên" } as Record<string, string>)[role] ?? role;
}

/** Thành phần điểm burnout (docs 04 §4) → chữ người đọc được */
export function riskFactorLabel(key: string): string {
  return (
    (
      {
        utilization: "Mức sử dụng",
        overtime: "Làm thêm giờ",
        consecutiveHigh: "Nhiều tuần liên tiếp cao tải",
        earTrend: "Đang chậm dần so với chính mình",
        overdue: "Việc quá hạn",
        switching: "Chuyển qua lại nhiều dự án",
        meetings: "Họp nhiều",
      } as Record<string, string>
    )[key] ?? key
  );
}

/** Độ tin cậy của mức kỹ năng từ bằng chứng (docs 02/08) */
export function confidenceLabel(c: string): string {
  return ({ none: "chưa có bằng chứng", low: "ít bằng chứng", medium: "bằng chứng vừa", high: "nhiều bằng chứng" } as Record<string, string>)[c] ?? c;
}
