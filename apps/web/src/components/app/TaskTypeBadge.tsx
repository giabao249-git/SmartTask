"use client";

import * as React from "react";
import { Bug, BookOpen, SquareCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { typeToHint, typeToLabel, typeToVariant, type TaskType } from "@/lib/status";
import { cn } from "@/lib/utils";

const ICON: Record<TaskType, React.ComponentType<{ className?: string }>> = {
  STORY: BookOpen,
  TASK: SquareCheck,
  BUG: Bug,
};

export interface TaskTypeBadgeProps {
  type: TaskType;
  /** "icon" cho thẻ Kanban (chỗ hẹp), "full" cho Sheet và bảng danh sách. */
  size?: "icon" | "full";
  className?: string;
}

/**
 * Loại công việc (docs 02/05 §E1). Màu và nhãn lấy từ `lib/status.ts`, không quyết định tại chỗ.
 * Dùng ở thẻ Kanban, danh sách và Sheet chi tiết nên đặt ở components/app (docs 10 §1).
 */
export function TaskTypeBadge({ type, size = "full", className }: TaskTypeBadgeProps) {
  const Icon = ICON[type] ?? SquareCheck;
  const label = typeToLabel(type);
  const badge = (
    <Badge
      variant={typeToVariant(type)}
      className={cn("gap-1 text-[10px] px-1.5 py-0 h-4 font-medium whitespace-nowrap", className)}
      aria-label={`Loại: ${label}`}
    >
      <Icon className="h-2.5 w-2.5" />
      {size === "full" && <span>{label}</span>}
    </Badge>
  );
  // Provider cục bộ: thẻ này nằm cả trong Kanban lẫn Sheet, không chắc cha nào cũng có Provider.
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {label} — {typeToHint(type)}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
