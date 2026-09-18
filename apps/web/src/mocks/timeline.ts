export interface TimelineTask {
  code: string;
  title: string;
  assigneeName: string;
  assigneeAvatar: string;
  assigneeRole: string;
  startDate: string; // 2026-10-23
  dueDate: string; // 2026-10-26
  progress: number; // %
  status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
  dependsOn?: string;
  isOverdue?: boolean;
}

export const TIMELINE_TASKS: TimelineTask[] = [
  // Minh (Backend)
  { code: "ST-6", title: "Khởi tạo DB Prisma schema", assigneeName: "Minh", assigneeAvatar: "", assigneeRole: "Backend", startDate: "2026-10-23", dueDate: "2026-10-24", progress: 100, status: "DONE" },
  { code: "ST-7", title: "Index PostgreSQL workload", assigneeName: "Minh", assigneeAvatar: "", assigneeRole: "Backend", startDate: "2026-10-24", dueDate: "2026-10-26", progress: 75, status: "IN_PROGRESS", dependsOn: "ST-6" },
  { code: "ST-14", title: "JWT & Cookie Auth", assigneeName: "Minh", assigneeAvatar: "", assigneeRole: "Backend", startDate: "2026-10-24", dueDate: "2026-10-28", progress: 65, status: "IN_PROGRESS" },
  { code: "ST-1", title: "Thuật toán chia tải EffLoad", assigneeName: "Minh", assigneeAvatar: "", assigneeRole: "Backend", startDate: "2026-10-27", dueDate: "2026-10-29", progress: 0, status: "TODO" },

  // Huy (Frontend)
  { code: "ST-5", title: "AppShell & ⌘K Palette", assigneeName: "Huy", assigneeAvatar: "", assigneeRole: "Frontend", startDate: "2026-10-23", dueDate: "2026-10-24", progress: 100, status: "DONE" },
  { code: "ST-12", title: "Kéo thả thẻ Kanban", assigneeName: "Huy", assigneeAvatar: "", assigneeRole: "Frontend", startDate: "2026-10-23", dueDate: "2026-10-25", progress: 80, status: "IN_PROGRESS", isOverdue: true, dependsOn: "ST-5" },
  { code: "ST-8", title: "Heatmap tải & Burnout", assigneeName: "Huy", assigneeAvatar: "", assigneeRole: "Frontend", startDate: "2026-10-23", dueDate: "2026-10-26", progress: 90, status: "REVIEW", isOverdue: true, dependsOn: "ST-5" },
  { code: "ST-9", title: "Sheet bảng sự thật", assigneeName: "Huy", assigneeAvatar: "", assigneeRole: "Frontend", startDate: "2026-10-24", dueDate: "2026-10-27", progress: 70, status: "IN_PROGRESS", dependsOn: "ST-8" },
  { code: "ST-4", title: "Drawer Chat Trợ lý AI", assigneeName: "Huy", assigneeAvatar: "", assigneeRole: "Frontend", startDate: "2026-10-27", dueDate: "2026-10-29", progress: 0, status: "TODO" },

  // Lan (PM)
  { code: "ST-11", title: "Prompt AI Agent WBS", assigneeName: "Lan", assigneeAvatar: "", assigneeRole: "PM", startDate: "2026-10-23", dueDate: "2026-10-25", progress: 100, status: "DONE" },
  { code: "ST-13", title: "Bộ ErrorCode @smarttask/shared", assigneeName: "Lan", assigneeAvatar: "", assigneeRole: "PM", startDate: "2026-10-23", dueDate: "2026-10-24", progress: 100, status: "DONE" },

  // Thảo (QA)
  { code: "ST-17", title: "Test API AI Decompose", assigneeName: "Thảo", assigneeAvatar: "", assigneeRole: "QA", startDate: "2026-10-24", dueDate: "2026-10-27", progress: 85, status: "REVIEW" },
  { code: "ST-3", title: "Kịch bản E2E Playwright", assigneeName: "Thảo", assigneeAvatar: "", assigneeRole: "QA", startDate: "2026-10-28", dueDate: "2026-10-29", progress: 0, status: "TODO", dependsOn: "ST-12" },

  // An (Fullstack)
  { code: "ST-18", title: "Sửa Avatar fallback", assigneeName: "An", assigneeAvatar: "", assigneeRole: "Fullstack", startDate: "2026-10-24", dueDate: "2026-10-25", progress: 100, status: "DONE" },
  { code: "ST-2", title: "Ma trận kỹ năng UI", assigneeName: "An", assigneeAvatar: "", assigneeRole: "Fullstack", startDate: "2026-10-27", dueDate: "2026-10-29", progress: 0, status: "TODO" },
  { code: "ST-16", title: "Ma trận Eisenhower", assigneeName: "An", assigneeAvatar: "", assigneeRole: "Fullstack", startDate: "2026-10-28", dueDate: "2026-10-29", progress: 0, status: "TODO" },
];
