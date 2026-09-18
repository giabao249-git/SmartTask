export interface WorkloadBarData {
  name: string;
  role: string;
  actualHours: number;
  plannedHours: number;
  utilization: number;
  capacity: number; // 40h
}

export const DASHBOARD_WORKLOAD_DATA: WorkloadBarData[] = [
  { name: "Lan", role: "PM", actualHours: 11, plannedHours: 13.8, utilization: 62, capacity: 40 },
  { name: "Minh", role: "Backend", actualHours: 21, plannedHours: 17.4, utilization: 96, capacity: 40 },
  { name: "Huy", role: "Frontend", actualHours: 33, plannedHours: 14.2, utilization: 118, capacity: 40 },
  { name: "Thảo", role: "QA", actualHours: 6, plannedHours: 12.0, utilization: 45, capacity: 40 },
  { name: "An", role: "Fullstack", actualHours: 2, plannedHours: 10.0, utilization: 30, capacity: 40 },
];

export interface BurndownDataPoint {
  day: string; // T2 (23/10), T3 (24/10)...
  date: string;
  idealRemaining: number;
  actualRemaining: number | null;
}

export const DASHBOARD_BURNDOWN_DATA: BurndownDataPoint[] = [
  { day: "T4 (23/10)", date: "2026-10-23", idealRemaining: 120, actualRemaining: 120 },
  { day: "T5 (24/10)", date: "2026-10-24", idealRemaining: 100, actualRemaining: 104 },
  { day: "T6 (25/10)", date: "2026-10-25", idealRemaining: 80, actualRemaining: 86 },
  { day: "T7 (26/10)", date: "2026-10-26", idealRemaining: 60, actualRemaining: 71 },
  { day: "CN (27/10)", date: "2026-10-27", idealRemaining: 40, actualRemaining: 58 },
  { day: "T2 (28/10)", date: "2026-10-28", idealRemaining: 20, actualRemaining: null },
  { day: "T3 (29/10)", date: "2026-10-29", idealRemaining: 0, actualRemaining: null },
];

export interface DashboardAlertItem {
  id: string;
  type: "OVERLOAD" | "BURNOUT" | "OVERDUE" | "SPRINT_DELAY";
  severity: "high" | "medium";
  title: string;
  description: string;
  actionText: string;
  actionHref: string;
}

export const DASHBOARD_ALERTS: DashboardAlertItem[] = [
  {
    id: "al-1",
    type: "OVERLOAD",
    severity: "high",
    title: "Nhân sự quá tải: Huy (Frontend)",
    description: "Tải tuần 118%, đang gánh 5 task và điểm Burnout ở mức 74 (Cảnh báo). Độ chênh tải Spread toàn đội lên tới 41%.",
    actionText: "Xem đề xuất cân bằng",
    actionHref: "/projects/ST/rebalance",
  },
  {
    id: "al-2",
    type: "OVERDUE",
    severity: "high",
    title: "2 công việc đang bị trễ hạn",
    description: "ST-12 (Giao diện kéo thả Kanban) trễ 1 ngày; ST-8 (Heatmap tải nhân sự) trễ 1 ngày. Tổng giờ còn lại: 4h.",
    actionText: "Xem bảng Kanban",
    actionHref: "/projects/ST/board",
  },
  {
    id: "al-3",
    type: "SPRINT_DELAY",
    severity: "medium",
    title: "Dự báo Sprint 3 hoàn thành trễ 2 ngày",
    description: "Vận tốc hiện tại 12.4h/ngày, dự kiến hoàn thành vào 31/10 (kế hoạch 29/10). Rủi ro Sprint ở mức Trung bình.",
    actionText: "Xem phân rã & tối ưu",
    actionHref: "/projects/ST/ai-decompose",
  },
];
