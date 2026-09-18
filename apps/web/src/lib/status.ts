/**
 * Bảng ánh xạ trạng thái sang variant của Badge/Button theo chuẩn design system SmartTask.
 * Không quyết định màu hex hoặc class màu tùy ý trong component — chỉ dùng qua các hàm này.
 */

export type WorkloadLevel = "NORMAL" | "HIGH" | "FULL" | "OVERLOAD";
export type PriorityLevel = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
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
    case "Khẩn":
      return "destructive";
    default:
      return "secondary";
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
