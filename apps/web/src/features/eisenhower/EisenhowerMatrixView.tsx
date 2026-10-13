"use client";

import * as React from "react";
import { Grid2X2, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { PriorityBadge } from "@/components/app/PriorityBadge";
import { TaskTypeBadge } from "@/components/app/TaskTypeBadge";
import { UserAvatar } from "@/components/app/UserAvatar";
import { TaskDetailModal } from "@/components/app/TaskDetailModal";
import { fmtDay, taskKeyOf } from "@/components/app/TaskCard";
import { describeError } from "@/lib/api";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { useAuth } from "@/lib/auth";
import { useWorkFilters } from "@/features/work/filters";
import type { TaskListItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useTasks } from "@/features/board/hooks";

const DAY = 86_400_000;
/** Khẩn = isUrgent hoặc hạn trong ≤ 3 ngày làm việc (hoặc quá hạn); Quan trọng = ưu tiên HIGH/URGENT hoặc độ khó ≥ 4. */
function quadrantOf(t: TaskListItem, today: number): "do" | "schedule" | "delegate" | "eliminate" {
  const due = t.dueDate ? Math.floor(new Date(t.dueDate).getTime() / DAY) : null;
  const urgent = t.isUrgent || (due !== null && due - today <= 3);
  const important = t.priority === "URGENT" || t.priority === "HIGH" || t.difficulty >= 4;
  if (urgent && important) return "do";
  if (!urgent && important) return "schedule";
  if (urgent && !important) return "delegate";
  return "eliminate";
}

const QUADRANTS = [
  { key: "do", title: "Làm ngay", hint: "Khẩn + Quan trọng", tone: "border-destructive/30 bg-destructive/5" },
  { key: "schedule", title: "Lên lịch", hint: "Quan trọng, Chưa khẩn", tone: "border-primary/30 bg-primary/5" },
  { key: "delegate", title: "Uỷ quyền", hint: "Khẩn, Ít quan trọng", tone: "border-warning/30 bg-warning/5" },
  { key: "eliminate", title: "Cân nhắc bỏ", hint: "Không khẩn, Ít quan trọng", tone: "border-border/60 bg-muted/20" },
] as const;

function EisenhowerCompactCard({
  task,
  projectKey,
  onClick,
}: {
  task: TaskListItem;
  projectKey: string;
  onClick: () => void;
}) {
  const overdue = !!task.dueDate && !task.completedAt && task.dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className="group flex flex-col gap-1.5 p-2.5 rounded-lg border border-border/80 bg-card hover:bg-accent/40 hover:border-primary/40 transition-colors shadow-2xs cursor-pointer select-none"
    >
      <div className="flex items-center justify-between gap-1.5 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono text-[11px] font-semibold text-muted-foreground shrink-0">
            {taskKeyOf(projectKey, task)}
          </span>
          <TaskTypeBadge type={task.type} size="icon" />
          <PriorityBadge priority={task.priority} showIcon={false} />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {task.assignees.length > 0 ? (
            <div className="flex -space-x-1 items-center">
              {task.assignees.slice(0, 2).map((a) => (
                <UserAvatar key={a.id} name={a.shortName ?? a.fullName} avatar={a.avatarUrl ?? undefined} size="sm" className="h-5 w-5 ring-1 ring-card" />
              ))}
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground/60 italic">chưa giao</span>
          )}
        </div>
      </div>
      <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors" title={task.title}>
        {task.title}
      </p>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
        <div className="flex items-center gap-2">
          {task.estimateHours != null && (
            <span className="tabular-nums font-mono">
              {task.remainingHours ?? task.estimateHours}/{task.estimateHours}h
            </span>
          )}
          {task.progress > 0 && <span className="tabular-nums font-mono">{task.progress}%</span>}
        </div>
        {task.dueDate && (
          <span className={cn("tabular-nums text-[10px]", overdue ? "text-destructive font-medium" : "text-muted-foreground")}>
            Hạn {fmtDay(task.dueDate)}
          </span>
        )}
      </div>
    </div>
  );
}

/** Ma trận Eisenhower (UC-14): xếp 4 ô từ task mở của sprint đang chạy, cố định layout 2x2 trong viewport. */
export function EisenhowerMatrixView() {
  const project = useCurrentProject();
  const auth = useAuth();
  const f = useWorkFilters();
  const tasksQuery = useTasks(project.id, f.query);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const today = Math.floor(Date.now() / DAY);
  const open = React.useMemo(
    () => f.applyQuick(tasksQuery.data ?? [], auth.user?.id).filter((t) => !t.completedAt),
    [tasksQuery.data, f, auth.user?.id],
  );
  const grouped = React.useMemo(() => {
    const g: Record<string, TaskListItem[]> = { do: [], schedule: [], delegate: [], eliminate: [] };
    for (const t of open) g[quadrantOf(t, today)].push(t);
    return g;
  }, [open, today]);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-foreground">{open.length} công việc đang mở</span>
            <span>theo bộ lọc hiện tại</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground inline-flex items-center" aria-label="Quy tắc phân loại">
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs max-w-72 p-2.5">
                <p className="font-semibold mb-1">Quy tắc phân loại ma trận:</p>
                <ul className="space-y-1 list-disc pl-3 text-[11px] text-muted-foreground">
                  <li><strong>Khẩn:</strong> Có cờ khẩn hoặc hạn chót còn ≤ 3 ngày (hoặc đã quá hạn).</li>
                  <li><strong>Quan trọng:</strong> Ưu tiên Cao / Rất cao hoặc độ khó kỹ thuật ≥ 4.</li>
                </ul>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {tasksQuery.isPending ? (
          <div className="grid grid-cols-1 md:grid-cols-2 grid-rows-2 gap-3.5 h-[calc(100vh-12.5rem)] min-h-[560px]">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-full rounded-xl" />
            ))}
          </div>
        ) : tasksQuery.isError ? (
          <ErrorState code={describeError(tasksQuery.error).code} message={describeError(tasksQuery.error).message} onRetry={() => tasksQuery.refetch()} />
        ) : open.length === 0 ? (
          <EmptyState icon={Grid2X2} title="Không có việc mở" description="Mọi việc đã hoàn thành hoặc sprint chưa có việc." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 grid-rows-2 gap-3.5 h-[calc(100vh-12.5rem)] min-h-[560px]">
            {QUADRANTS.map((q) => (
              <div key={q.key} className={cn("flex flex-col h-full rounded-xl border overflow-hidden bg-card/60 shadow-2xs", q.tone)}>
                <div className="flex items-center justify-between px-3.5 py-2.5 shrink-0 border-b border-border/40 bg-background/50">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold text-foreground">{q.title}</h3>
                    <span className="text-[11px] text-muted-foreground hidden sm:inline">· {q.hint}</span>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs h-5 px-1.5">
                    {grouped[q.key].length}
                  </Badge>
                </div>
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2 min-h-0">
                  {grouped[q.key].length === 0 ? (
                    <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground/60 italic h-full py-8">
                      Không có công việc trong ô này
                    </div>
                  ) : (
                    grouped[q.key].map((t) => (
                      <EisenhowerCompactCard
                        key={t.id}
                        task={t}
                        projectKey={project.key}
                        onClick={() => setSelectedId(t.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <TaskDetailModal taskId={selectedId} project={project} open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)} />
      </div>
    </TooltipProvider>
  );
}
