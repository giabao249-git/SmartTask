"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PriorityBadge } from "./PriorityBadge";
import { UserAvatar } from "./UserAvatar";
import { Calendar, CheckSquare, Sparkles, Clock, Link2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskListItem } from "@/lib/types";

export interface TaskCardProps {
  task: TaskListItem;
  projectKey: string;
  onClick?: (task: TaskListItem) => void;
  onClaim?: (task: TaskListItem) => void;
  currentUserId?: string;
  isDragging?: boolean;
  isGhost?: boolean;
  className?: string;
  today?: string;
}

export const taskKeyOf = (projectKey: string, t: { key?: string; number: number }) => t.key ?? `${projectKey}-${t.number}`;

export const fmtDay = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** Thẻ task trên Kanban/danh sách — dữ liệu từ `TasksService.toListView` (docs 11 §3.6). */
export function TaskCard({ task, projectKey, onClick, onClaim, currentUserId, isDragging = false, isGhost = false, className, today }: TaskCardProps) {
  const overdue = !!task.dueDate && !task.completedAt && task.dueDate.slice(0, 10) < (today ?? new Date().toISOString().slice(0, 10));
  const isMyTask = currentUserId ? task.assignees.some((a) => a.id === currentUserId) : false;

  return (
    <Card
      onClick={() => onClick?.(task)}
      className={cn(
        "p-3 cursor-pointer transition-all hover:border-primary/50 hover:shadow-md active:scale-[0.99] border-border/80 bg-card select-none relative",
        isMyTask && "border-l-2 border-l-primary",
        isDragging && "opacity-30 border-dashed border-primary",
        isGhost && "opacity-90 shadow-xl border-primary ring-2 ring-primary/20 rotate-1",
        className,
      )}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className="font-mono text-xs font-semibold px-1.5 py-0">
              {taskKeyOf(projectKey, task)}
            </Badge>
            {isMyTask && (
              <Badge variant="default" className="text-[9px] px-1 py-0 h-4 bg-primary/20 text-primary border-primary/30 hover:bg-primary/30 font-medium">
                Của tôi
              </Badge>
            )}
            {task.source === "AI" && (
              <Badge variant="info" className="gap-1 text-[10px] px-1.5 py-0 h-4">
                <Sparkles className="h-2.5 w-2.5" /> AI
              </Badge>
            )}
            <PriorityBadge priority={task.priority} showIcon={false} />
            {task.dependsOnIds.length > 0 && (
              <Badge variant="secondary" className="gap-1 text-[10px] px-1.5 py-0 h-4" title="Có phụ thuộc">
                <Link2 className="h-2.5 w-2.5" /> {task.dependsOnIds.length}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {task.assignees.length > 0 ? (
              <div className="flex -space-x-1.5">
                {task.assignees.slice(0, 3).map((a) => (
                  <UserAvatar key={a.id} name={a.shortName ?? a.fullName} avatar={a.avatarUrl ?? undefined} size="sm" className="ring-2 ring-card" />
                ))}
              </div>
            ) : onClaim ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClaim(task);
                }}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors border border-primary/25 cursor-pointer shadow-2xs"
                title="Tự nhận công việc này"
              >
                <Plus className="h-3 w-3" />
                <span>Nhận task</span>
              </button>
            ) : (
              <span className="text-[10px] text-muted-foreground italic">chưa giao</span>
            )}
          </div>
        </div>

        <h4 className="text-sm font-medium text-foreground leading-snug line-clamp-2">{task.title}</h4>

        {task.labels.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {task.labels.slice(0, 3).map((l) => (
              <Badge key={l.id} variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal text-muted-foreground">
                #{l.name}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            {task.subtaskCount > 0 && (
              <div className="flex items-center gap-1 text-[11px] tabular-nums" title="Công việc con">
                <CheckSquare className="h-3 w-3" />
                <span>{task.subtaskCount}</span>
              </div>
            )}
            {task.estimateHours != null && (
              <div className="flex items-center gap-1 text-[11px] tabular-nums" title={`Còn ${task.remainingHours ?? task.estimateHours}h / ước lượng ${task.estimateHours}h`}>
                <Clock className="h-3 w-3" />
                <span>
                  {task.remainingHours ?? task.estimateHours}/{task.estimateHours}h
                </span>
              </div>
            )}
            {task.progress > 0 && <span className="text-[11px] tabular-nums">{task.progress}%</span>}
          </div>
          <div
            className={cn("flex items-center gap-1 text-[11px] tabular-nums", overdue ? "text-destructive font-medium bg-destructive/10 px-1.5 py-0.5 rounded-sm" : "text-muted-foreground")}
            title={overdue ? "Quá hạn" : `Hạn ${fmtDay(task.dueDate)}`}
          >
            <Calendar className="h-3 w-3" />
            <span>{fmtDay(task.dueDate)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
