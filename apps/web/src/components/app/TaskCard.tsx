"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { PriorityBadge } from "./PriorityBadge";
import { TaskTypeBadge } from "./TaskTypeBadge";
import { UserAvatar } from "./UserAvatar";
import { Calendar, CheckSquare, Sparkles, Clock, Link2, Plus, Loader2 } from "lucide-react";
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
  /** Thẻ đang được bàn phím trỏ tới (J/K, N/P) — viền theo token --ring của docs 10 §6. */
  isFocused?: boolean;
  /** Thẻ đang được tick để làm hàng loạt. */
  isSelected?: boolean;
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
export function TaskCard({ task, projectKey, onClick, onClaim, currentUserId, isDragging = false, isGhost = false, isFocused = false, isSelected = false, className, today }: TaskCardProps) {
  const overdue = !!task.dueDate && !task.completedAt && task.dueDate.slice(0, 10) < (today ?? new Date().toISOString().slice(0, 10));
  const isMyTask = currentUserId ? task.assignees.some((a) => a.id === currentUserId) : false;
  // Thẻ tạm (chưa có id thật): không mở chi tiết, không nhận việc — mọi PATCH sẽ 404.
  const pending = task.pending === true;

  return (
    <motion.div
      data-task-card="true"
      whileHover={isDragging || pending ? undefined : { y: -2, transition: { duration: 0.12 } }}
      whileTap={isDragging || pending ? undefined : { scale: 0.985 }}
      onClick={() => !pending && onClick?.(task)}
      aria-busy={pending}
      className={cn(
        "rounded-xl border p-3 cursor-pointer transition-colors shadow-2xs hover:border-primary/50 hover:shadow-md border-border/80 bg-card select-none relative",
        pending && "opacity-70 pointer-events-none border-dashed",
        isMyTask && "border-l-4 border-l-primary",
        isFocused && "ring-2 ring-ring ring-offset-1 border-primary",
        isSelected && "border-primary bg-primary/5",
        isDragging && "opacity-30 border-dashed border-primary",
        isGhost && "opacity-90 shadow-xl border-primary ring-2 ring-primary/20 rotate-1",
        className,
      )}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-1.5 min-h-[24px]">
          <div className={cn("flex items-center gap-1.5 flex-wrap min-w-0", isSelected && "pl-6")}>
            <Badge variant="outline" className="font-mono text-xs font-semibold px-1.5 py-0 shrink-0 gap-1">
              <span>{pending ? "…" : taskKeyOf(projectKey, task)}</span>
              {task.source === "AI" && (
                <span title="Được tạo bởi AI" className="inline-flex items-center">
                  <Sparkles className="h-3 w-3 text-indigo-500 shrink-0" />
                </span>
              )}
            </Badge>
            {pending ? (
              <Badge variant="secondary" className="gap-1 text-[11px] font-medium px-1.5 py-0 h-4.5 shrink-0">
                <Loader2 className="h-2.5 w-2.5 animate-spin" /> Đang lưu…
              </Badge>
            ) : (
              <TaskTypeBadge type={task.type} size="icon" />
            )}
            <PriorityBadge priority={task.priority} showIcon={false} className="text-[11px] font-medium tracking-wide" />
            {task.dependsOnIds.length > 0 && (
              <Badge variant="secondary" className="gap-1 text-[11px] font-medium px-1.5 py-0 h-4.5 shrink-0" title={`Có ${task.dependsOnIds.length} phụ thuộc`}>
                <Link2 className="h-2.5 w-2.5" /> {task.dependsOnIds.length}
              </Badge>
            )}
          </div>
          <div className="flex items-center justify-end gap-1 shrink-0 h-6">
            {task.assignees.length > 0 ? (
              <div className="flex -space-x-1.5 items-center">
                {task.assignees.slice(0, 3).map((a) => (
                  <UserAvatar key={a.id} name={a.shortName ?? a.fullName} avatar={a.avatarUrl ?? undefined} size="sm" className="ring-2 ring-card" />
                ))}
              </div>
            ) : onClaim && !pending ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClaim(task);
                }}
                className="inline-flex items-center gap-1 px-2 h-6 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors border border-primary/25 cursor-pointer shadow-2xs"
                title="Tự nhận công việc này"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Nhận task</span>
              </button>
            ) : (
              <span className="text-xs text-muted-foreground/70 italic">chưa giao</span>
            )}
          </div>
        </div>

        <h4 className="text-sm font-semibold text-foreground leading-snug line-clamp-2 my-0.5">{task.title}</h4>

        {task.labels.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {task.labels.slice(0, 3).map((l) => (
              <Badge key={l.id} variant="secondary" className="text-[11px] px-2 py-0.5 h-5 font-medium text-muted-foreground">
                #{l.name}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-1.5 border-t border-border/40 text-xs text-muted-foreground">
          <div className="flex items-center gap-2.5">
            {task.subtaskCount > 0 && (
              <div className="flex items-center gap-1 text-xs tabular-nums" title="Công việc con">
                <CheckSquare className="h-3 w-3" />
                <span>{task.subtaskCount}</span>
              </div>
            )}
            {task.estimateHours != null && (
              <div className="flex items-center gap-1 text-xs tabular-nums font-mono" title={`Còn ${task.remainingHours ?? task.estimateHours}h / ước lượng ${task.estimateHours}h`}>
                <Clock className="h-3 w-3" />
                <span>
                  {task.remainingHours ?? task.estimateHours}/{task.estimateHours}h
                </span>
              </div>
            )}
            {task.progress > 0 && <span className="text-xs tabular-nums font-mono text-muted-foreground/80">{task.progress}%</span>}
          </div>
          <div
            className={cn("flex items-center gap-1 text-xs tabular-nums shrink-0 ml-auto", overdue ? "text-destructive font-medium bg-destructive/10 px-1.5 py-0.5 rounded-sm" : "text-muted-foreground")}
            title={overdue ? "Quá hạn" : `Hạn ${fmtDay(task.dueDate)}`}
          >
            <Calendar className="h-3 w-3" />
            <span>{fmtDay(task.dueDate)}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
