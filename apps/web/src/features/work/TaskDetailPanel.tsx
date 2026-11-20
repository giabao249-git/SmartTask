"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { X } from "lucide-react";
import { ErrorState } from "@/components/app/ErrorState";
import { TaskDetailBody } from "@/components/app/TaskDetailModal";
import { taskKeyOf } from "@/components/app/TaskCard";
import { describeError } from "@/lib/api";
import type { ProjectDetail } from "@/lib/types";
import { useTask } from "@/features/board/hooks";
import { useResizablePanel } from "./use-resizable-panel";

export interface TaskDetailPanelProps {
  taskId: string | null;
  project: ProjectDetail;
  onClose: () => void;
}

export function TaskDetailPanel({ taskId, project, onClose }: TaskDetailPanelProps) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const router = useRouter();
  const { width, isDragging, handlePointerDown, resetWidth } = useResizablePanel();
  const q = useTask(taskId);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {taskId ? (
        <motion.aside
          key="task-detail-side-panel"
          initial={{ x: "100%", opacity: 0.8 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0.8 }}
          transition={{ type: "spring", damping: 30, stiffness: 350 }}
          style={{ width: `${width}px` }}
          className="fixed top-14 bottom-0 right-0 z-40 flex flex-col border-l border-border/80 bg-card/98 shadow-2xl backdrop-blur-md overflow-hidden max-w-full"
          aria-label="Bảng chi tiết công việc"
        >
          {/* Thanh kéo co giãn (Resizable Splitter Handle) ở mép trái */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Kéo để chỉnh độ rộng panel chi tiết"
            onPointerDown={handlePointerDown}
            onDoubleClick={resetWidth}
            className="absolute -left-1.5 top-0 bottom-0 w-3 cursor-col-resize z-50 group flex items-center justify-center select-none"
            title="Kéo sang trái/phải để co giãn · Bấm đúp để đặt lại mặc định (520px)"
          >
            <div className="w-1 h-12 rounded-full bg-border/80 group-hover:bg-primary group-active:bg-primary transition-colors shadow-2xs" />
          </div>

          {/* Lớp màng vô hình ngăn bắt sự kiện khi đang kéo chuột */}
          {isDragging && (
            <div className="fixed inset-0 z-[60] cursor-col-resize select-none pointer-events-auto" />
          )}

          {/* Nội dung chi tiết task */}
          {q.isPending || !q.data ? (
            <div className="flex flex-col h-full">
              <div className="px-4 sm:px-6 pt-3.5 pb-3 border-b border-border/60 bg-muted/15 flex items-center justify-between shrink-0">
                <Skeleton className="h-6 w-24 rounded-md" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                  onClick={onClose}
                  aria-label="Đóng panel (Esc)"
                  title="Đóng panel (Esc)"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                <Skeleton className="h-9 w-3/4 rounded-lg" />
                <div className="space-y-4 pt-2">
                  <Skeleton className="h-28 w-full rounded-lg" />
                  <Skeleton className="h-36 w-full rounded-lg" />
                  <Skeleton className="h-36 w-full rounded-lg" />
                </div>
              </div>
            </div>
          ) : q.isError ? (
            <div className="flex flex-col h-full">
              <div className="px-4 sm:px-6 pt-3.5 pb-3 border-b border-border/60 bg-muted/15 flex items-center justify-between shrink-0">
                <span className="text-xs font-semibold text-destructive">Lỗi tải công việc</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                  onClick={onClose}
                  aria-label="Đóng panel (Esc)"
                  title="Đóng panel (Esc)"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-6 flex-1 overflow-y-auto">
                <ErrorState
                  code={describeError(q.error).code}
                  message={describeError(q.error).message}
                  onRetry={() => q.refetch()}
                />
              </div>
            </div>
          ) : (
            <TaskDetailBody
              task={q.data}
              project={project}
              onRefresh={() => q.refetch()}
              variant="panel"
              onClose={onClose}
              onOpenFullPage={() => {
                onClose();
                router.push(`/projects/${project.id}/tasks/${taskKeyOf(project.key, q.data!)}`);
              }}
            />
          )}
        </motion.aside>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
