"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { CalendarRange, ZoomIn, ZoomOut, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { UserAvatar } from "@/components/app/UserAvatar";
import { TaskDetailModal } from "@/components/app/TaskDetailModal";
import { taskKeyOf } from "@/components/app/TaskCard";
import { describeError } from "@/lib/api";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { useAuth } from "@/lib/auth";
import { useSprints } from "@/lib/hooks/queries";
import { useWorkFilters } from "@/features/work/filters";
import { priorityToVariant } from "@/lib/status";
import type { TaskListItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useTaskMutations, useTasks } from "@/features/board/hooks";
import { describeError as errInfo } from "@/lib/api";
import { toast } from "sonner";

const DAY = 86_400_000;
const ZOOM = { day: 56, week: 24, month: 10 } as const;
type Zoom = keyof typeof ZOOM;

const toDay = (iso: string) => Math.floor(new Date(iso).getTime() / DAY);
const fmt = (dayIdx: number) => {
  const d = new Date(dayIdx * DAY);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

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

function TaskHoverCard({ task, projectKey, columnName, isOverdue, today }: TaskHoverCardProps) {
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

const ROW = 38;
const SIDEBAR_WIDTH = 340;

/** Gantt tương tác cao (UC-13): lấp đầy viewport, xem trước hover, thanh theo ngày bắt đầu–hạn, nhóm sprint, đường hôm nay, quá hạn, kéo thả điều chỉnh */
export function TimelineGanttView() {
  const project = useCurrentProject();
  const params = useSearchParams();
  const f = useWorkFilters();
  const auth = useAuth();
  const sprints = useSprints(project.id);
  const [zoom, setZoom] = React.useState<Zoom>("week");
  const [selectedId, setSelectedId] = React.useState<string | null>(params.get("task"));
  const tasksQuery = useTasks(project.id, f.query);
  const px = ZOOM[zoom];
  const today = Math.floor(Date.now() / DAY);
  const m = useTaskMutations(project.id);

  const columnMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const c of project.columns ?? []) {
      map.set(c.id, c.name);
    }
    return map;
  }, [project.columns]);

  // Kéo thanh (dời cả thanh) / kéo mép phải (đổi hạn): xem trước bằng delta ngày, thả mới PATCH /tasks/:id kèm version
  const [drag, setDrag] = React.useState<{ id: string; mode: "move" | "resize"; startX: number; delta: number } | null>(null);
  const dragRef = React.useRef(drag);
  dragRef.current = drag;

  const onPointerDown = (e: React.PointerEvent, t: TaskListItem, mode: "move" | "resize") => {
    if (!project.canEdit || t.completedAt) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({ id: t.id, mode, startX: e.clientX, delta: 0 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const delta = Math.round((e.clientX - d.startX) / px);
    if (delta !== d.delta) setDrag({ ...d, delta });
  };

  const onPointerUp = (t: TaskListItem) => {
    const d = dragRef.current;
    setDrag(null);
    if (!d || d.id !== t.id) return;
    if (d.delta === 0) {
      setSelectedId(t.id);
      return;
    }
    const iso = (day: number) => new Date(day * DAY).toISOString().slice(0, 10);
    const s0 = toDay(t.startDate ?? t.dueDate!);
    const e0 = Math.max(s0, toDay(t.dueDate ?? t.startDate!));
    const patch =
      d.mode === "move"
        ? {
            ...(t.startDate ? { startDate: iso(s0 + d.delta) } : {}),
            ...(t.dueDate ? { dueDate: iso(e0 + d.delta) } : {}),
          }
        : { dueDate: iso(Math.max(s0, e0 + d.delta)) };

    m.update.mutate(
      { id: t.id, version: t.version, patch },
      {
        onSuccess: () =>
          toast.success(
            `${taskKeyOf(project.key, t)}: ${d.mode === "move" ? `dời ${d.delta > 0 ? "+" : ""}${d.delta} ngày` : "đổi hạn"}`,
          ),
        onError: (err) => {
          const { code, message } = errInfo(err);
          toast.error(code === "TASK_VERSION_CONFLICT" ? "Công việc vừa được người khác sửa — đã tải lại" : message, {
            description: code,
          });
          tasksQuery.refetch();
        },
      },
    );
  };

  const rows = React.useMemo(
    () => f.applyQuick(tasksQuery.data ?? [], auth.user?.id).filter((t) => t.startDate || t.dueDate),
    [tasksQuery.data, f, auth.user?.id],
  );
  const range = React.useMemo(() => {
    if (!rows.length) return { start: today - 7, end: today + 21 };
    const starts = rows.map((t) => toDay(t.startDate ?? t.dueDate!));
    const ends = rows.map((t) => toDay(t.dueDate ?? t.startDate!));
    return { start: Math.min(...starts, today) - 2, end: Math.max(...ends, today) + 3 };
  }, [rows, today]);
  const days = range.end - range.start + 1;

  const groups = React.useMemo(() => {
    const bySprint = new Map<string, TaskListItem[]>();
    for (const t of rows) {
      const k = t.sprintId ?? "__backlog";
      bySprint.set(k, [...(bySprint.get(k) ?? []), t]);
    }
    const name = (id: string) => (id === "__backlog" ? "Backlog" : (sprints.data?.find((s) => s.id === id)?.name ?? "Sprint"));
    return [...bySprint.entries()].map(([id, list]) => ({
      id,
      name: name(id),
      tasks: list.sort((a, b) => (a.startDate ?? a.dueDate ?? "").localeCompare(b.startDate ?? b.dueDate ?? "")),
    }));
  }, [rows, sprints.data]);

  // Hàng 0 = trục ngày (h-8), mỗi nhóm 1 hàng tiêu đề rồi tới task
  const rowIndex = new Map<string, number>();
  let idx = 1;
  for (const g of groups) {
    idx += 1;
    for (const t of g.tasks) rowIndex.set(t.id, idx++);
  }

  const bar = (t: TaskListItem) => {
    let s = toDay(t.startDate ?? t.dueDate!);
    let e = Math.max(s, toDay(t.dueDate ?? t.startDate!));
    if (drag && drag.id === t.id) {
      if (drag.mode === "move") {
        s += drag.delta;
        e += drag.delta;
      } else e = Math.max(s, e + drag.delta);
    }
    return { left: (s - range.start) * px, width: (e - s + 1) * px, overdue: !t.completedAt && !!t.dueDate && e < today };
  };

  const gridHeight = Math.max(idx * ROW + 40, 520);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-col h-[calc(100vh-8.5rem)] min-h-[620px] space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap shrink-0">
          <p className="text-xs text-muted-foreground">
            {project.canEdit
              ? "Kéo thanh để dời ngày, kéo mép phải để đổi hạn (lưu kèm version). Rê chuột để xem chi tiết, bấm để mở hội thoại."
              : "Chế độ xem. Rê chuột để xem chi tiết, bấm để mở hội thoại."}
          </p>
          <div className="flex items-center rounded-md border border-border/80 bg-background">
            {(["day", "week", "month"] as Zoom[]).map((z) => (
              <Button
                key={z}
                variant={zoom === z ? "default" : "ghost"}
                size="sm"
                className="h-8 text-xs rounded-none first:rounded-l-md last:rounded-r-md"
                onClick={() => setZoom(z)}
              >
                {z === "day" ? <ZoomIn className="h-3.5 w-3.5" /> : z === "month" ? <ZoomOut className="h-3.5 w-3.5" /> : "Tuần"}
              </Button>
            ))}
          </div>
        </div>

        {tasksQuery.isPending ? (
          <Skeleton className="flex-1 w-full rounded-xl" />
        ) : tasksQuery.isError ? (
          <ErrorState
            code={describeError(tasksQuery.error).code}
            message={describeError(tasksQuery.error).message}
            onRetry={() => tasksQuery.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title="Chưa có công việc có ngày"
            description="Đặt ngày bắt đầu/hạn cho công việc để hiện trên timeline."
          />
        ) : (
          <Card className="border-border/80 flex-1 min-h-0 flex flex-col overflow-hidden shadow-xs">
            <CardHeader className="p-3.5 pb-2.5 shrink-0 flex flex-row items-center justify-between border-b border-border/60">
              <div>
                <CardTitle className="text-sm font-semibold">
                  {rows.length} công việc · {groups.length} nhóm sprint
                </CardTitle>
                <CardDescription className="text-xs">
                  Đường đỏ = hôm nay · thanh đỏ = quá hạn · mũi tên = phụ thuộc · rê chuột vào công việc để xem chi tiết
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="hidden sm:inline font-mono text-[11px]">
                  Bấm thanh hoặc tên công việc để mở chi tiết
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-0 flex-1 min-h-0 flex flex-col overflow-hidden">
              <ScrollArea className="w-full flex-1 min-h-0">
                <div className="flex" style={{ minWidth: SIDEBAR_WIDTH + days * px, minHeight: gridHeight }}>
                  {/* Cột trái: Danh sách công việc */}
                  <div
                    className="shrink-0 border-r border-border/60 sticky left-0 bg-card z-20 shadow-xs"
                    style={{ width: SIDEBAR_WIDTH, minHeight: gridHeight }}
                  >
                    <div className="h-8 border-b border-border/60 px-3 flex items-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/20">
                      Công việc & Phân công
                    </div>
                    {groups.map((g) => (
                      <React.Fragment key={g.id}>
                        <div className="h-[38px] px-3 flex items-center text-xs font-semibold bg-muted/40 border-b border-border/40 text-foreground">
                          {g.name}
                        </div>
                        {g.tasks.map((t) => {
                          const b = bar(t);
                          return (
                            <Tooltip key={t.id} delayDuration={150}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  onClick={() => setSelectedId(t.id)}
                                  className="h-[38px] w-full justify-between px-3 text-xs rounded-none border-b border-border/30 gap-2 hover:bg-muted/60 text-left font-normal cursor-pointer"
                                >
                                  <div className="flex items-center gap-2 truncate min-w-0">
                                    <span className="font-mono text-[11px] font-semibold text-muted-foreground shrink-0">
                                      {taskKeyOf(project.key, t)}
                                    </span>
                                    <span className="truncate text-foreground font-medium">{t.title}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {t.assignees && t.assignees.length > 0 && (
                                      <UserAvatar
                                        name={t.assignees[0].fullName}
                                        avatar={t.assignees[0].avatarUrl ?? undefined}
                                        size="sm"
                                        showTooltip={false}
                                        className="h-5 w-5 text-[9px]"
                                      />
                                    )}
                                  </div>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent
                                side="right"
                                align="center"
                                sideOffset={8}
                                className="z-50 p-3 bg-popover/95 text-popover-foreground border border-border/80 shadow-xl rounded-xl w-80 backdrop-blur-sm pointer-events-none"
                              >
                                <TaskHoverCard
                                  task={t}
                                  projectKey={project.key}
                                  columnName={columnMap.get(t.columnId)}
                                  isOverdue={b.overdue}
                                  today={today}
                                />
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>

                  {/* Vùng Timeline biểu đồ Gantt bên phải */}
                  <div className="relative flex-1" style={{ width: days * px, minHeight: gridHeight, height: gridHeight }}>
                    {/* Trục ngày header */}
                    <div className="h-8 border-b border-border/60 sticky top-0 bg-background/95 backdrop-blur-xs z-10 text-[10px] text-muted-foreground">
                      {Array.from({ length: days }).map((_, i) => {
                        const d = range.start + i;
                        const date = new Date(d * DAY);
                        const dow = date.getUTCDay();
                        const show = zoom === "day" || (zoom === "week" && dow === 1) || (zoom === "month" && date.getUTCDate() === 1);
                        if (!show) return null;
                        const span = zoom === "day" ? 1 : zoom === "week" ? 7 : 30;
                        return (
                          <div
                            key={i}
                            className="absolute bottom-0 h-full border-l border-border/40 pl-1 flex items-end pb-0.5 whitespace-nowrap font-mono"
                            style={{ left: i * px, width: span * px }}
                          >
                            {fmt(d)}
                          </div>
                        );
                      })}
                    </div>

                    {/* Nền hàng + cuối tuần */}
                    {Array.from({ length: days }).map((_, i) => {
                      const dow = new Date((range.start + i) * DAY).getUTCDay();
                      return dow === 0 || dow === 6 ? (
                        <div key={i} className="absolute top-8 bottom-0 bg-muted/25 pointer-events-none" style={{ left: i * px, width: px }} />
                      ) : null;
                    })}

                    {/* Đường phân cách hàng */}
                    {Array.from({ length: idx }).map((_, r) => (
                      <div
                        key={r}
                        className="absolute left-0 right-0 border-b border-border/20 pointer-events-none"
                        style={{ top: (r + 1) * ROW, height: 1 }}
                      />
                    ))}

                    {/* Hôm nay */}
                    <div
                      className="absolute top-0 bottom-0 w-[2px] bg-destructive z-10 pointer-events-none"
                      style={{ left: (today - range.start) * px + px / 2 }}
                      title="Hôm nay"
                    >
                      <div className="absolute -top-1 -translate-x-1/2 bg-destructive text-destructive-foreground text-[9px] font-bold px-1 rounded shadow-xs">
                        Hôm nay
                      </div>
                    </div>

                    {/* Thanh công việc */}
                    {groups.flatMap((g) =>
                      g.tasks.map((t) => {
                        const b = bar(t);
                        const r = rowIndex.get(t.id) ?? 0;
                        const isDragging = drag?.id === t.id;

                        return (
                          <Tooltip key={t.id} delayDuration={150} open={isDragging ? false : undefined}>
                            <TooltipTrigger asChild>
                              <div
                                role="button"
                                tabIndex={0}
                                onPointerDown={(e) => onPointerDown(e, t, "move")}
                                onPointerMove={onPointerMove}
                                onPointerUp={() => onPointerUp(t)}
                                onKeyDown={(e) => e.key === "Enter" && setSelectedId(t.id)}
                                className={cn(
                                  "absolute h-7 px-2.5 flex items-center text-[11px] rounded-md border shadow-2xs select-none transition-shadow",
                                  project.canEdit && !t.completedAt
                                    ? "cursor-grab active:cursor-grabbing hover:shadow-sm"
                                    : "cursor-pointer",
                                  isDragging && "ring-2 ring-ring z-30 shadow-md",
                                  b.overdue
                                    ? "bg-destructive/15 border-destructive/50 text-destructive font-medium"
                                    : t.completedAt
                                    ? "bg-success/15 border-success/40 text-success-foreground"
                                    : "bg-primary/15 border-primary/40 text-primary-foreground font-medium",
                                )}
                                style={{
                                  top: r * ROW + 5,
                                  left: b.left,
                                  width: Math.max(b.width, px),
                                  zIndex: isDragging ? 30 : 15,
                                }}
                              >
                                <span className="truncate mr-1 font-medium">{t.title}</span>
                                {t.progress > 0 && (
                                  <span className="ml-auto font-mono text-[10px] opacity-80 shrink-0">
                                    {t.progress}%
                                  </span>
                                )}
                                {project.canEdit && !t.completedAt && t.dueDate && (
                                  <span
                                    onPointerDown={(e) => onPointerDown(e, t, "resize")}
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
                              <TaskHoverCard
                                task={t}
                                projectKey={project.key}
                                columnName={columnMap.get(t.columnId)}
                                isOverdue={b.overdue}
                                today={today}
                              />
                            </TooltipContent>
                          </Tooltip>
                        );
                      }),
                    )}

                    {/* Phụ thuộc (mũi tên từ cuối thanh trước → đầu thanh sau) */}
                    <svg
                      className="absolute inset-0 pointer-events-none"
                      width={days * px}
                      height={gridHeight}
                    >
                      {rows.flatMap((t) =>
                        t.dependsOnIds.map((depId) => {
                          const dep = rows.find((x) => x.id === depId);
                          if (!dep) return null;
                          const a = bar(dep);
                          const b = bar(t);
                          const y1 = (rowIndex.get(dep.id) ?? 0) * ROW + ROW / 2;
                          const y2 = (rowIndex.get(t.id) ?? 0) * ROW + ROW / 2;
                          const x1 = a.left + a.width;
                          const x2 = b.left;
                          return (
                            <path
                              key={`${depId}-${t.id}`}
                              d={`M${x1},${y1} C${x1 + 14},${y1} ${x2 - 14},${y2} ${x2},${y2}`}
                              fill="none"
                              stroke="hsl(var(--muted-foreground))"
                              strokeWidth={1.5}
                              strokeDasharray="4 2"
                              markerEnd="url(#arrow)"
                            />
                          );
                        }),
                      )}
                      <defs>
                        <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                          <path d="M0,0 L6,3 L0,6 z" fill="hsl(var(--muted-foreground))" />
                        </marker>
                      </defs>
                    </svg>
                  </div>
                </div>
                <ScrollBar orientation="horizontal" />
                <ScrollBar orientation="vertical" />
              </ScrollArea>
            </CardContent>

            <CardFooter className="p-2.5 px-4 border-t border-border/40 shrink-0 flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap bg-muted/15">
              {(["URGENT", "HIGH", "MEDIUM", "LOW"] as const).map((p) => (
                <Badge key={p} variant={priorityToVariant(p)} className="text-[9px] px-1 py-0">
                  {p}
                </Badge>
              ))}
              <span className="ml-auto flex items-center gap-1 font-mono text-[11px]">
                <Link2 className="h-3 w-3" /> {rows.reduce((n, t) => n + t.dependsOnIds.length, 0)} phụ thuộc
              </span>
            </CardFooter>
          </Card>
        )}

        <TaskDetailModal
          taskId={selectedId}
          project={project}
          open={!!selectedId}
          onOpenChange={(o) => !o && setSelectedId(null)}
        />
      </div>
    </TooltipProvider>
  );
}
