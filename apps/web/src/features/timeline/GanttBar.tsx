"use client";

import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/app/UserAvatar";
import { priorityToAccentColor } from "@/lib/status";
import type { TaskListItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TaskHoverCard } from "./TaskHoverCard";

/** Chiều cao thanh (khớp class h-9) — TimelineGanttView dùng để căn thanh vào giữa hàng. */
export const BAR_H = 36;

/** Dưới ngưỡng này (px), ẩn avatar trên thanh để tránh vỡ layout ở zoom tháng — chỉ giữ % */
const MIN_WIDTH_FOR_AVATAR = 80;

interface GanttBarProps {
  task: TaskListItem;
  projectKey: string;
  columnName?: string;
  today: number;
  left: number;
  width: number;
  top: number;
  overdue: boolean;
  isDragging: boolean;
  canEdit: boolean;
  onPointerDown: (e: React.PointerEvent, mode: "move" | "resize") => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onSelect: () => void;
}

/** Thanh task của Gantt (UC-13): nền theo trạng thái, viền trái theo priority, progress fill, avatar người phụ trách. */
export function GanttBar({
  task: t,
  projectKey,
  columnName,
  today,
  left,
  width,
  top,
  overdue,
  isDragging,
  canEdit,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onSelect,
}: GanttBarProps) {
  const editable = canEdit && !t.completedAt;
  const showAvatar = width >= MIN_WIDTH_FOR_AVATAR;
  const firstAssignee = t.assignees && t.assignees.length > 0 ? t.assignees[0] : null;
  const extraAssignees = t.assignees && t.assignees.length > 1 ? t.assignees.length - 1 : 0;

  // Trạng thái quyết định hue (đỏ=quá hạn, xanh lá=xong, xanh info=bình thường) — info thay cho
  // primary (vốn là màu mực/đen của app, không phải màu trạng thái) để hài hòa với success/destructive.
  const status = overdue ? "overdue" : t.completedAt ? "done" : "normal";
  const statusStyle = {
    overdue: { bg: "bg-destructive/16", border: "border-destructive/55", fill: "bg-destructive/35" },
    done: { bg: "bg-success/16", border: "border-success/55", fill: "bg-success/35" },
    normal: { bg: "bg-info/16", border: "border-info/55", fill: "bg-info/35" },
  }[status];

  return (
    <Tooltip delayDuration={150} open={isDragging ? false : undefined}>
      <TooltipTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          onPointerDown={(e) => onPointerDown(e, "move")}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onKeyDown={(e) => e.key === "Enter" && onSelect()}
          className={cn(
            "absolute h-9 flex items-center text-xs rounded-md border shadow-2xs select-none transition-shadow overflow-hidden text-foreground",
            editable ? "cursor-grab active:cursor-grabbing hover:shadow-sm" : "cursor-pointer",
            isDragging && "ring-2 ring-ring z-30 shadow-md",
            statusStyle.bg,
            statusStyle.border,
          )}
          style={{ top, left, width: Math.max(width, 1), zIndex: isDragging ? 30 : 15 }}
        >
          {/* Progress fill: lớp phủ đậm hơn từ trái theo %, nằm dưới lớp chữ */}
          {t.progress > 0 && (
            <div
              className={cn("absolute inset-y-0 left-0 pointer-events-none", statusStyle.fill)}
              style={{ width: `${Math.min(t.progress, 100)}%` }}
            />
          )}

          {/* Dải nhấn priority — strip màu riêng, không dùng CSS border (tránh xung đột twMerge) */}
          <div className={cn("absolute inset-y-0 left-0 w-[3px] pointer-events-none", priorityToAccentColor(t.priority))} />

          {/* Chữ luôn dùng text token trung tính, không tô theo màu trạng thái — màu trạng thái chỉ nằm ở nền/viền */}
          <div className="relative flex items-center w-full pl-2.5 pr-2 gap-1.5">
            {showAvatar && firstAssignee && (
              <div className="flex items-center gap-0.5 shrink-0">
                <UserAvatar
                  name={firstAssignee.fullName}
                  avatar={firstAssignee.avatarUrl ?? undefined}
                  size="sm"
                  showTooltip={false}
                />
                {extraAssignees > 0 && (
                  <span className="text-[9px] font-semibold text-muted-foreground">+{extraAssignees}</span>
                )}
              </div>
            )}
            <span className="truncate mr-1 font-medium">{t.title}</span>
            {t.progress > 0 && (
              <span className="ml-auto font-mono text-[10px] text-muted-foreground shrink-0">{t.progress}%</span>
            )}
          </div>

          {editable && t.dueDate && (
            <span
              onPointerDown={(e) => onPointerDown(e, "resize")}
              className="absolute right-0 top-0 h-full w-2.5 cursor-ew-resize hover:bg-foreground/20 rounded-r-md"
              aria-label="Kéo đổi hạn"
            />
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="center"
        sideOffset={8}
        className="z-50 p-3 bg-popover/95 text-popover-foreground border border-border/80 shadow-xl rounded-xl w-80 backdrop-blur-sm pointer-events-none"
      >
        <TaskHoverCard task={t} projectKey={projectKey} columnName={columnName} isOverdue={overdue} today={today} />
      </TooltipContent>
    </Tooltip>
  );
}
