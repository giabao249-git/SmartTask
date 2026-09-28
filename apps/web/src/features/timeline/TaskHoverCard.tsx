"use client";

import { Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/app/UserAvatar";
import { taskKeyOf } from "@/components/app/TaskCard";
import { priorityToVariant } from "@/lib/status";
import type { TaskListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const DAY = 86_400_000;
const toDay = (iso: string) => Math.floor(new Date(iso).getTime() / DAY);

const fmtDate = (iso: string | null) => {
  if (!iso) return "Chưa đặt";
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
};

interface TaskHoverCardProps {
  task: TaskListItem;
  projectKey: string;
  columnName?: string;
  isOverdue: boolean;
  today: number;
}

/** Nội dung hover card của 1 task trên Gantt — dùng chung bởi sidebar và GanttBar. */
export function TaskHoverCard({ task, projectKey, columnName, isOverdue, today }: TaskHoverCardProps) {
  const dueDay = task.dueDate ? toDay(task.dueDate) : null;
  const overdueDays = dueDay !== null && dueDay < today ? today - dueDay : 0;

  return (
    <div className="space-y-2 text-left">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
          {taskKeyOf(projectKey, task)}
        </span>
        <div className="flex items-center gap-1.5">
          <Badge variant={priorityToVariant(task.priority)} className="text-[10px] px-1.5 py-0">
            {task.priority}
          </Badge>
          {columnName && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
              {columnName}
            </Badge>
          )}
        </div>
      </div>

      <div className="text-xs font-semibold text-foreground line-clamp-2 leading-snug">
        {task.title}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] pt-1.5 border-t border-border/50 text-muted-foreground">
        <div>
          <span className="text-[10px] block text-muted-foreground/70">Bắt đầu</span>
          <span className="font-medium text-foreground">{fmtDate(task.startDate)}</span>
        </div>
        <div>
          <span className="text-[10px] block text-muted-foreground/70">Hạn chót</span>
          <span className={cn("font-medium", isOverdue ? "text-destructive font-semibold" : "text-foreground")}>
            {fmtDate(task.dueDate)}
          </span>
        </div>
      </div>

      {isOverdue && (
        <div className="text-[10px] text-destructive font-medium bg-destructive/10 px-2 py-1 rounded flex items-center gap-1 border border-destructive/20">
          <span>⚠️ Quá hạn {overdueDays} ngày</span>
        </div>
      )}

      {/* Tiến độ & Ước tính */}
      <div className="space-y-1 pt-1.5 border-t border-border/50">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Tiến độ ({task.progress}%)</span>
          <span>{task.estimateHours ? `${task.estimateHours}h ước tính` : "Chưa ước lượng"}</span>
        </div>
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className={cn("h-full transition-all rounded-full", task.progress === 100 ? "bg-success" : "bg-primary")}
            style={{ width: `${Math.min(task.progress, 100)}%` }}
          />
        </div>
      </div>

      {/* Phân công & Phụ thuộc */}
      <div className="flex items-center justify-between pt-1.5 border-t border-border/50 text-[11px]">
        <div className="flex items-center gap-1.5 truncate max-w-[170px]">
          {task.assignees && task.assignees.length > 0 ? (
            <>
              <UserAvatar
                name={task.assignees[0].fullName}
                avatar={task.assignees[0].avatarUrl ?? undefined}
                size="sm"
                showTooltip={false}
                className="h-4 w-4 text-[8px]"
              />
              <span className="text-[11px] truncate font-medium text-foreground">
                {task.assignees[0].fullName}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground text-[10px] italic">Chưa phân công</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground shrink-0 font-mono">
          {task.dependsOnIds.length > 0 && (
            <span className="flex items-center gap-0.5" title={`${task.dependsOnIds.length} việc phụ thuộc`}>
              <Link2 className="h-3 w-3" /> {task.dependsOnIds.length}
            </span>
          )}
          {task.subtaskCount > 0 && (
            <span title={`${task.subtaskCount} việc con`}>
              ✓ {task.subtaskCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
