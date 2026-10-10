/**
 * Nhãn nhật ký hoạt động (UC-16) — DÙNG CHUNG cho màn hình (ActivityList) và khối tra cứu ACTIVITY_FEED
 * của Trợ lý AI, để cùng một sự kiện không hiện hai kiểu ("cập nhật" ở Dashboard, "task.updated" trong chat).
 */
export const ACTIVITY_ACTION_LABEL: Record<string, string> = {
  'task.created': 'tạo việc',
  'task.updated': 'cập nhật',
  'task.moved': 'chuyển cột',
  'task.deleted': 'xoá việc',
  'task.assigned': 'giao việc',
  'comment.created': 'bình luận',
  'sprint.started': 'bắt đầu sprint',
  'sprint.closed': 'kết thúc sprint',
  'sprint.tasks_added': 'đưa việc vào sprint',
  'project.member.removed': 'gỡ thành viên',
};

export const ACTIVITY_FIELD_LABEL: Record<string, string> = {
  title: 'tiêu đề',
  columnId: 'cột',
  priority: 'ưu tiên',
  dueDate: 'hạn',
  startDate: 'bắt đầu',
  estimateHours: 'giờ ước',
  remainingHours: 'giờ còn',
  progress: 'tiến độ',
  assignees: 'người',
  sprintId: 'sprint',
  difficulty: 'độ khó',
  description: 'mô tả',
  isUrgent: 'cờ khẩn',
  position: 'vị trí',
};

/**
 * Phần đuôi cho dòng sprint: "Sprint 1 · 7 việc chuyển đi". `diff` là JSON nhật ký đã lưu
 * (`sprint.closed` có `movedTaskIds`, `sprint.tasks_added` có `taskIds`, `afterStart`).
 */
export function sprintActivityDetail(
  action: string,
  diff: unknown,
  sprintName: string | undefined,
): string | null {
  if (!action.startsWith('sprint.')) return null;
  const d = (diff ?? {}) as {
    movedTaskIds?: unknown[];
    taskIds?: unknown[];
    afterStart?: boolean;
  };
  const parts = [sprintName ?? 'sprint'];
  if (action === 'sprint.closed' && d.movedTaskIds?.length)
    parts.push(`${d.movedTaskIds.length} việc chưa xong được chuyển đi`);
  if (action === 'sprint.tasks_added' && d.taskIds?.length)
    parts.push(
      `${d.taskIds.length} việc${d.afterStart ? ' — thêm sau khi sprint đã bắt đầu' : ''}`,
    );
  return parts.join(' · ');
}
