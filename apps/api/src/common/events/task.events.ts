/**
 * Sự kiện nội bộ (EventEmitter2). Service phát; listener ở activity / notifications / realtime / workload nghe.
 * Tên theo docs/04-kien-truc/02 §1: task.created | task.updated | task.moved | task.deleted | task.assigned
 * sprint.started | sprint.closed | project.member.removed
 */
export const TASK_EVENTS = {
  created: 'task.created',
  updated: 'task.updated',
  moved: 'task.moved',
  deleted: 'task.deleted',
  assigned: 'task.assigned',
} as const;

export const SPRINT_EVENTS = {
  started: 'sprint.started',
  closed: 'sprint.closed',
  updated: 'sprint.updated',
} as const;
export const PROJECT_EVENTS = {
  memberRemoved: 'project.member.removed',
} as const;

export interface TaskEventPayload {
  projectId: string;
  taskId: string;
  actorId: string | null;
  /** Người liên quan để tính lại tải / gửi thông báo (assignee trước và sau) */
  affectedUserIds: string[];
  /** Trường đã đổi: { field: { from, to } } — activity log dùng nguyên, LLM/notification chỉ đọc key */
  diff?: Record<string, { from: unknown; to: unknown }>;
  version: number;
  source: 'MANUAL' | 'AI';
  at: Date;
}

export interface SprintEventPayload {
  projectId: string;
  sprintId: string;
  actorId: string;
  movedTaskIds?: string[];
  at: Date;
}
