"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { CalendarRange, ZoomIn, ZoomOut, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { TaskDetailSheet } from "@/components/app/TaskDetailSheet";
import { taskKeyOf } from "@/components/app/TaskCard";
import { describeError } from "@/lib/api";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { useSprints } from "@/lib/hooks/queries";
import { priorityToVariant } from "@/lib/status";
import type { TaskListItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useTaskMutations, useTasks } from "@/features/board/hooks";
import { describeError as errInfo } from "@/lib/api";
import { toast } from "sonner";

const DAY = 86_400_000;
const ZOOM = { day: 40, week: 18, month: 7 } as const;
type Zoom = keyof typeof ZOOM;

const toDay = (iso: string) => Math.floor(new Date(iso).getTime() / DAY);
const fmt = (dayIdx: number) => {
  const d = new Date(dayIdx * DAY);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** Gantt chỉ đọc (UC-13): thanh theo ngày bắt đầu–hạn, nhóm theo sprint, đường hôm nay, quá hạn, mũi tên phụ thuộc, thu phóng. */
export function TimelineGanttView() {
  const project = useCurrentProject();
  const params = useSearchParams();
  const sprints = useSprints(project.id);
  const [sprintFilter, setSprintFilter] = React.useState<string>("__all");
  const [zoom, setZoom] = React.useState<Zoom>("week");
  const [selectedId, setSelectedId] = React.useState<string | null>(params.get("task"));
  const tasksQuery = useTasks(project.id, { sprintId: sprintFilter !== "__all" ? sprintFilter : undefined });
  const px = ZOOM[zoom];
  const today = Math.floor(Date.now() / DAY);
  const m = useTaskMutations(project.id);
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
    const patch = d.mode === "move" ? { ...(t.startDate ? { startDate: iso(s0 + d.delta) } : {}), ...(t.dueDate ? { dueDate: iso(e0 + d.delta) } : {}) } : { dueDate: iso(Math.max(s0, e0 + d.delta)) };
    m.update.mutate(
      { id: t.id, version: t.version, patch },
      {
        onSuccess: () => toast.success(`${taskKeyOf(project.key, t)}: ${d.mode === "move" ? `dời ${d.delta > 0 ? "+" : ""}${d.delta} ngày` : "đổi hạn"}`),
        onError: (err) => {
          const { code, message } = errInfo(err);
          toast.error(code === "TASK_VERSION_CONFLICT" ? "Công việc vừa được người khác sửa — đã tải lại" : message, { description: code });
          tasksQuery.refetch();
        },
      },
    );
  };

  const rows = React.useMemo(() => (tasksQuery.data ?? []).filter((t) => t.startDate || t.dueDate), [tasksQuery.data]);
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
    return [...bySprint.entries()].map(([id, list]) => ({ id, name: name(id), tasks: list.sort((a, b) => (a.startDate ?? a.dueDate ?? "").localeCompare(b.startDate ?? b.dueDate ?? "")) }));
  }, [rows, sprints.data]);
  // Hàng 0 = trục ngày (h-8), mỗi nhóm 1 hàng tiêu đề rồi tới task
  const rowIndex = new Map<string, number>();
  let idx = 1;
  for (const g of groups) {
    idx += 1;
    for (const t of g.tasks) rowIndex.set(t.id, idx++);
  }
  const ROW = 32;

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

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Gantt / Timeline · ${project.key}`}
        description={project.canEdit ? "Kéo thanh để dời ngày, kéo mép phải để đổi hạn (lưu kèm version). Bấm thanh để mở chi tiết." : "Chỉ đọc. Bấm thanh để mở chi tiết."}
        breadcrumbs={[{ label: "Workspace", href: "/workspaces" }, { label: project.name, href: `/projects/${project.id}/dashboard` }, { label: "Timeline" }]}
      >
        <div className="flex items-center gap-2">
          <Select value={sprintFilter} onValueChange={setSprintFilter}>
            <SelectTrigger className="h-8 text-xs w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all" className="text-xs">
                Mọi sprint
              </SelectItem>
              {(sprints.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center rounded-md border border-border/80">
            {(["day", "week", "month"] as Zoom[]).map((z) => (
              <Button key={z} variant={zoom === z ? "default" : "ghost"} size="sm" className="h-8 text-xs rounded-none first:rounded-l-md last:rounded-r-md" onClick={() => setZoom(z)}>
                {z === "day" ? <ZoomIn className="h-3.5 w-3.5" /> : z === "month" ? <ZoomOut className="h-3.5 w-3.5" /> : "Tuần"}
              </Button>
            ))}
          </div>
        </div>
      </PageHeader>

      {tasksQuery.isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : tasksQuery.isError ? (
        <ErrorState code={describeError(tasksQuery.error).code} message={describeError(tasksQuery.error).message} onRetry={() => tasksQuery.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon={CalendarRange} title="Chưa có công việc có ngày" description="Đặt ngày bắt đầu/hạn cho công việc để hiện trên timeline." />
      ) : (
        <Card className="border-border/80">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">{rows.length} công việc · {groups.length} nhóm</CardTitle>
            <CardDescription className="text-xs">Đường đỏ = hôm nay · thanh đỏ = quá hạn · mũi tên = phụ thuộc</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="w-full">
              <div className="flex" style={{ minWidth: 260 + days * px }}>
                <div className="w-[260px] shrink-0 border-r border-border/60 sticky left-0 bg-card z-10">
                  <div className="h-8 border-b border-border/60" />
                  {groups.map((g) => (
                    <React.Fragment key={g.id}>
                      <div className="h-8 px-3 flex items-center text-xs font-semibold bg-muted/40 border-b border-border/40">{g.name}</div>
                      {g.tasks.map((t) => (
                        <Button key={t.id} variant="ghost" onClick={() => setSelectedId(t.id)} className="h-8 w-full justify-start px-3 text-xs rounded-none border-b border-border/30 gap-2">
                          <span className="font-mono text-muted-foreground">{taskKeyOf(project.key, t)}</span>
                          <span className="truncate">{t.title}</span>
                        </Button>
                      ))}
                    </React.Fragment>
                  ))}
                </div>
                <div className="relative" style={{ width: days * px, height: idx * ROW }}>
                  {/* Trục ngày */}
                  <div className="h-8 border-b border-border/60 relative text-[10px] text-muted-foreground">
                    {Array.from({ length: days }).map((_, i) => {
                      const d = range.start + i;
                      const date = new Date(d * DAY);
                      const dow = date.getUTCDay();
                      const show = zoom === "day" || (zoom === "week" && dow === 1) || (zoom === "month" && date.getUTCDate() === 1);
                      if (!show) return null;
                      const span = zoom === "day" ? 1 : zoom === "week" ? 7 : 30;
                      return (
                        <div key={i} className="absolute bottom-0 h-full border-l border-border/40 pl-1 flex items-end pb-0.5 whitespace-nowrap" style={{ left: i * px, width: span * px }}>
                          {fmt(d)}
                        </div>
                      );
                    })}
                  </div>
                  {/* Nền hàng + cuối tuần */}
                  {Array.from({ length: days }).map((_, i) => {
                    const dow = new Date((range.start + i) * DAY).getUTCDay();
                    return dow === 0 || dow === 6 ? <div key={i} className="absolute top-8 bottom-0 bg-muted/30" style={{ left: i * px, width: px }} /> : null;
                  })}
                  {/* Hôm nay */}
                  <div className="absolute top-0 bottom-0 w-px bg-destructive z-10" style={{ left: (today - range.start) * px + px / 2 }} title="Hôm nay" />
                  {/* Thanh */}
                  {groups.flatMap((g) =>
                    g.tasks.map((t) => {
                      const b = bar(t);
                      const r = rowIndex.get(t.id) ?? 0;
                      return (
                        <div
                          key={t.id}
                          role="button"
                          tabIndex={0}
                          onPointerDown={(e) => onPointerDown(e, t, "move")}
                          onPointerMove={onPointerMove}
                          onPointerUp={() => onPointerUp(t)}
                          onKeyDown={(e) => e.key === "Enter" && setSelectedId(t.id)}
                          className={cn(
                            "absolute h-6 px-2 flex items-center text-[11px] rounded-md border overflow-hidden select-none",
                            project.canEdit && !t.completedAt ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                            drag?.id === t.id && "ring-2 ring-ring z-20",
                            b.overdue ? "bg-destructive/15 border-destructive/50 text-destructive" : t.completedAt ? "bg-success/15 border-success/40" : "bg-primary/10 border-primary/40",
                          )}
                          style={{ top: r * ROW + 4, left: b.left, width: Math.max(b.width, px) }}
                          title={`${taskKeyOf(project.key, t)} · ${t.startDate?.slice(0, 10) ?? "?"} → ${t.dueDate?.slice(0, 10) ?? "?"}`}
                        >
                          <span className="truncate">{t.title}</span>
                          {t.progress > 0 && <span className="ml-auto font-mono text-[10px]">{t.progress}%</span>}
                          {project.canEdit && !t.completedAt && t.dueDate && (
                            <span onPointerDown={(e) => onPointerDown(e, t, "resize")} className="absolute right-0 top-0 h-full w-2 cursor-ew-resize hover:bg-foreground/10" aria-label="Kéo đổi hạn" />
                          )}
                        </div>
                      );
                    }),
                  )}
                  {/* Phụ thuộc (mũi tên đơn giản từ cuối thanh trước → đầu thanh sau) */}
                  <svg className="absolute inset-0 pointer-events-none" width={days * px} height={(idx + 1) * ROW}>
                    {rows.flatMap((t) =>
                      t.dependsOnIds.map((depId) => {
                        const dep = rows.find((x) => x.id === depId);
                        if (!dep) return null;
                        const a = bar(dep);
                        const b = bar(t);
                        const y1 = (rowIndex.get(dep.id) ?? 0) * ROW + 16;
                        const y2 = (rowIndex.get(t.id) ?? 0) * ROW + 16;
                        const x1 = a.left + a.width;
                        const x2 = b.left;
                        return <path key={`${depId}-${t.id}`} d={`M${x1},${y1} C${x1 + 12},${y1} ${x2 - 12},${y2} ${x2},${y2}`} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth={1} markerEnd="url(#arrow)" />;
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
            </ScrollArea>
            <div className="p-3 border-t border-border/40 flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
              {(["URGENT", "HIGH", "MEDIUM", "LOW"] as const).map((p) => (
                <Badge key={p} variant={priorityToVariant(p)} className="text-[9px] px-1 py-0">
                  {p}
                </Badge>
              ))}
              <span className="ml-auto flex items-center gap-1">
                <Link2 className="h-3 w-3" /> {rows.reduce((n, t) => n + t.dependsOnIds.length, 0)} phụ thuộc
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <TaskDetailSheet taskId={selectedId} project={project} open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)} />
    </div>
  );
}
