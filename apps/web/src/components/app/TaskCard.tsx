"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PriorityBadge } from "./PriorityBadge";
import { UserAvatar } from "./UserAvatar";
import { Calendar, CheckSquare, Sparkles, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskItem } from "@/mocks/tasks";

export interface TaskCardProps {
  task: TaskItem;
  onClick?: (task: TaskItem) => void;
  isDragging?: boolean;
  isGhost?: boolean;
  className?: string;
}

export function TaskCard({
  task,
  onClick,
  isDragging = false,
  isGhost = false,
  className,
}: TaskCardProps) {
  const completedSubtasks = task.subtasks.filter((s) => s.completed).length;
  const totalSubtasks = task.subtasks.length;

  return (
    <Card
      onClick={() => onClick?.(task)}
      className={cn(
        "p-3 cursor-pointer transition-all hover:border-primary/50 hover:shadow-md active:scale-[0.99] border-border/80 bg-card select-none",
        isDragging && "opacity-30 border-dashed border-primary",
        isGhost && "opacity-90 shadow-xl border-primary ring-2 ring-primary/20 rotate-1",
        className
      )}
    >
      <div className="flex flex-col gap-2">
        {/* Header: Code, Badges, Assignee Avatar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className="font-mono text-xs font-semibold px-1.5 py-0">
              {task.code}
            </Badge>

            {task.isAiGenerated && (
              <Badge variant="info" className="gap-1 text-[10px] px-1.5 py-0 h-4">
                <Sparkles className="h-2.5 w-2.5" />
                AI
              </Badge>
            )}

            <PriorityBadge priority={task.priority} showIcon={false} />
          </div>

          <UserAvatar
            name={task.assignee.name}
            avatar={task.assignee.avatar}
            role={task.assignee.role}
            initials={task.assignee.initials}
            isOnline={task.assignee.isOnline}
            workloadPercent={task.assignee.utilization}
            size="sm"
          />
        </div>

        {/* Title */}
        <h4 className="text-sm font-medium text-foreground leading-snug line-clamp-2">
          {task.title}
        </h4>

        {/* Labels */}
        {task.labels && task.labels.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {task.labels.slice(0, 3).map((lbl) => (
              <Badge
                key={lbl}
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-4 font-normal text-muted-foreground"
              >
                #{lbl}
              </Badge>
            ))}
          </div>
        )}

        {/* Footer: Due date, subtask progress, estimate hours */}
        <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            {/* Subtasks 2/5 */}
            {totalSubtasks > 0 && (
              <div
                className={cn(
                  "flex items-center gap-1 text-[11px] tabular-nums",
                  completedSubtasks === totalSubtasks && "text-success font-medium"
                )}
                title={`Hoàn thành ${completedSubtasks}/${totalSubtasks} công việc con`}
              >
                <CheckSquare className="h-3 w-3" />
                <span>
                  {completedSubtasks}/{totalSubtasks}
                </span>
              </div>
            )}

            {/* Estimate hours */}
            <div className="flex items-center gap-1 text-[11px] tabular-nums" title={`Ước lượng: ${task.estimateHours}h`}>
              <Clock className="h-3 w-3" />
              <span>{task.estimateHours}h</span>
            </div>
          </div>

          {/* Due date with red highlight if overdue */}
          <div
            className={cn(
              "flex items-center gap-1 text-[11px] tabular-nums",
              task.isOverdue
                ? "text-destructive font-medium bg-destructive/10 px-1.5 py-0.5 rounded-sm"
                : "text-muted-foreground"
            )}
            title={task.isOverdue ? "Công việc đã quá hạn!" : `Hạn chót: ${task.dueDate}`}
          >
            <Calendar className="h-3 w-3" />
            <span>
              {task.dueDate.split("-").slice(1).reverse().join("/")}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
