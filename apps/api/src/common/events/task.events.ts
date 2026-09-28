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
  /** Tên sự kiện (task.created …) — listener wildcard cần vì EventEmitter2 không đưa tên vào payload */
  event?: string;
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
  /** Việc đưa vào sprint đang chạy (scope tăng giữa chừng — mục "thêm sau khi bắt đầu" của báo cáo sprint) */
  afterStart?: boolean;
  /** Đóng sprint: việc dở chuyển về đâu (id sprint đích hoặc null = backlog) */
  movedTo?: string | null;
  /** Idempotency-Key của lần đóng — bấm lại cùng khoá thì trả kết quả cũ (docs 11 §2) */
  idempotencyKey?: string;
  at: Date;
}

export const COMMENT_EVENTS = {
  created: 'comment.created',
  updated: 'comment.updated',
  deleted: 'comment.deleted',
} as const;
export const NOTIFICATION_EVENTS = { created: 'notification.created' } as const;

export interface CommentEventPayload {
  event?: string;
  projectId: string;
  taskId: string;
  commentId: string;
  actorId: string;
  mentionedUserIds: string[];
  at: Date;
}

export interface ProjectMemberEventPayload {
  projectId: string;
  userId: string;
  actorId: string;
  at: Date;
}
