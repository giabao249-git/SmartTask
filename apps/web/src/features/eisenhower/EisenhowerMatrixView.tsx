"use client";

import * as React from "react";
import { Grid2X2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { TaskCard } from "@/components/app/TaskCard";
import { TaskDetailModal } from "@/components/app/TaskDetailModal";
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
  { key: "do", title: "Làm ngay", hint: "Khẩn + quan trọng", tone: "border-destructive/40 bg-destructive/5" },
  { key: "schedule", title: "Lên lịch", hint: "Quan trọng, chưa khẩn", tone: "border-primary/40 bg-primary/5" },
  { key: "delegate", title: "Uỷ quyền", hint: "Khẩn, ít quan trọng", tone: "border-warning/40 bg-warning/5" },
  { key: "eliminate", title: "Cân nhắc bỏ", hint: "Không khẩn, ít quan trọng", tone: "border-border/60 bg-muted/20" },
] as const;

/** Ma trận Eisenhower (UC-14): xếp 4 ô từ task mở của sprint đang chạy (quy tắc ở trên, tính trên web từ dữ liệu API). */
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
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        {open.length} việc mở theo bộ lọc hiện tại · khẩn = cờ khẩn hoặc hạn ≤ 3 ngày · quan trọng = ưu tiên Cao/Khẩn hoặc độ khó ≥ 4
      </p>
      {tasksQuery.isPending ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : tasksQuery.isError ? (
        <ErrorState code={describeError(tasksQuery.error).code} message={describeError(tasksQuery.error).message} onRetry={() => tasksQuery.refetch()} />
      ) : open.length === 0 ? (
        <EmptyState icon={Grid2X2} title="Không có việc mở" description="Mọi việc đã hoàn thành hoặc sprint chưa có việc." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {QUADRANTS.map((q) => (
            <Card key={q.key} className={cn("border", q.tone)}>
              <CardHeader className="p-4 pb-2 flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-sm">{q.title}</CardTitle>
                  <CardDescription className="text-xs">{q.hint}</CardDescription>
                </div>
                <Badge variant="secondary" className="font-mono text-xs">
                  {grouped[q.key].length}
                </Badge>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-2 min-h-[120px]">
                {grouped[q.key].length === 0 ? (
                  <p className="text-[11px] text-muted-foreground py-6 text-center">Trống</p>
                ) : (
                  grouped[q.key].map((t) => <TaskCard key={t.id} task={t} projectKey={project.key} onClick={() => setSelectedId(t.id)} />)
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <TaskDetailModal taskId={selectedId} project={project} open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)} />
    </div>
  );
}
