"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, MoreHorizontal, AlertTriangle, ShieldCheck, User, Scale, Bot, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TaskCard, taskKeyOf } from "@/components/app/TaskCard";
import { TaskDetailSheet } from "@/components/app/TaskDetailSheet";
import { UserAvatar } from "@/components/app/UserAvatar";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { describeError, isApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { useWorkFilters } from "@/features/work/filters";
import type { BoardColumn, TaskListItem } from "@/lib/types";
import { TASK_TYPES, typeToHint, typeToLabel } from "@/lib/status";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useBoardRealtime, useMoveTask, useTaskMutations, useTasks } from "./hooks";

function SortableTaskItem({
  task,
  projectKey,
  onClick,
  onClaim,
  currentUserId,
}: {
  task: TaskListItem;
  projectKey: string;
  onClick: (t: TaskListItem) => void;
  onClaim?: (t: TaskListItem) => void;
  currentUserId?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, data: { type: "Task", task } });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} {...attributes} {...listeners}>
      <TaskCard task={task} projectKey={projectKey} onClick={onClick} onClaim={onClaim} currentUserId={currentUserId} isDragging={isDragging} />
    </div>
  );
}

const POSITION_STEP = 1000;

/** Bảng Kanban (UC-12): cột từ project.columns, task từ GET /projects/:id/tasks; kéo thả → PATCH move có version. */
export function KanbanBoard() {
  const project = useCurrentProject();
  const auth = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const f = useWorkFilters();
  const sprintFilter = f.sprint;
  /**
   * Sprint của công việc sắp tạo — phải đọc đúng bộ lọc đang đứng.
   * Trước đây lọc "Backlog" vẫn rơi vào sprint đang chạy: thẻ hiện nhờ cache rồi F5 là mất.
   */
  const createSprintId =
    sprintFilter === "__backlog" ? undefined : sprintFilter !== "__all" ? sprintFilter : project.activeSprint?.id;
  const createSprintLabel =
    createSprintId === undefined
      ? "backlog"
      : createSprintId === project.activeSprint?.id
        ? `sprint đang chạy (${project.activeSprint.name})`
        : "sprint đang lọc";
  const tasksQuery = useTasks(project.id, f.query);
  const move = useMoveTask(project.id);
  const mut = useTaskMutations(project.id);
  useBoardRealtime(project.id, {
    selfId: auth.user?.id,
    onTaskEvent: (ev, p) => {
      if (ev === "task:created" || ev === "task:moved") toast.info(ev === "task:created" ? "Có công việc mới từ người khác" : "Một thẻ vừa được người khác kéo", { description: p.task?.id ? `#${p.task.id.slice(0, 8)}` : undefined });
    },
  });

  // Bản sao cục bộ để kéo thả mượt; nguồn sự thật là query
  const [local, setLocal] = React.useState<TaskListItem[]>([]);
  React.useEffect(() => {
    if (tasksQuery.data) setLocal(tasksQuery.data);
  }, [tasksQuery.data]);
  const [activeTask, setActiveTask] = React.useState<TaskListItem | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(params.get("task"));
  const [sheetOpen, setSheetOpen] = React.useState(!!params.get("task"));
  const [createOpen, setCreateOpen] = React.useState(false);
  const [selectedColumnId, setSelectedColumnId] = React.useState<string>("");

  const columns = React.useMemo(
    () => project.columns.slice().sort((a, b) => a.position - b.position),
    [project.columns],
  );

  const openCreateDialog = React.useCallback(
    (colId?: string) => {
      setSelectedColumnId(colId || columns[0]?.id || "");
      setCreateOpen(true);
    },
    [columns],
  );

  // Shortcuts: Q để bật/tắt "Việc của tôi", C để mở tạo công việc thủ công
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement | null)?.isContentEditable;
      if (!isInput && (e.key === "q" || e.key === "Q")) {
        e.preventDefault();
        f.set({ quick: f.quick === "my" ? "all" : "my" });
      }
      if (!isInput && (e.key === "c" || e.key === "C") && project.canEdit) {
        e.preventDefault();
        openCreateDialog();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openCreateDialog, project.canEdit, f]);

  const handleClaimTask = React.useCallback(
    (task: TaskListItem) => {
      const currentUserId = auth.user?.id;
      if (!currentUserId) {
        toast.error("Vui lòng đăng nhập để nhận việc");
        return;
      }
      mut.update.mutate(
        { id: task.id, version: task.version, patch: { assigneeId: currentUserId } },
        {
          onSuccess: () => {
            toast.success(`Bạn đã nhận task ${taskKeyOf(project.key, task)}`);
          },
          onError: (err) => {
            toast.error("Không thể nhận task", { description: describeError(err).message });
          },
        },
      );
    },
    [auth.user?.id, mut.update, project.key],
  );

  const isLeader = project.canManage || project.myRole === "PM";
  const myTasks = React.useMemo(() => {
    const currentUserId = auth.user?.id;
    if (!currentUserId) return [];
    return local.filter((t) => t.assignees.some((a) => a.id === currentUserId));
  }, [local, auth.user?.id]);
  const myHours = myTasks.reduce((s, t) => s + (t.remainingHours ?? t.estimateHours ?? 0), 0);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));
  const colTasks = (colId: string) =>
    local
      .filter((t) => t.columnId === colId)
      .filter((t) => f.applyQuick([t], auth.user?.id).length > 0)
      .sort((a, b) => a.position - b.position);

  /**
   * Hai trạng thái rỗng khác nhau (docs 10 §2): dự án chưa có việc nào thì mời tạo;
   * còn lọc ra 0 kết quả thì VẪN giữ bảng để tạo nhanh được, chỉ báo là bộ lọc đang ẩn hết.
   */
  const visibleCount = f.applyQuick(local, auth.user?.id).length;
  const emptyByFilter = visibleCount === 0 && f.isFiltered;
  const emptyProject = visibleCount === 0 && !f.isFiltered;

  const openTask = (t: TaskListItem) => {
    setSelectedId(t.id);
    setSheetOpen(true);
  };

  const failMove = (e: unknown, task: TaskListItem) => {
    const { code, message } = describeError(e);
    if (code === "TASK_VERSION_CONFLICT") toast.error(`${taskKeyOf(project.key, task)} vừa được người khác cập nhật — đã hoàn tác`, { description: "409 TASK_VERSION_CONFLICT" });
    else if (code === "WIP_LIMIT_EXCEEDED") {
      const d = isApiError(e) ? e.detail<{ limit?: number; count?: number }>() : undefined;
      toast.warning("Cột đã đạt giới hạn WIP — đã hoàn tác", { description: d?.limit ? `Giới hạn ${d.limit}` : message });
    } else toast.error("Không kéo được thẻ", { description: `${code}: ${message}` });
    void tasksQuery.refetch();
  };

  const doMove = (task: TaskListItem, columnId: string, position?: number) =>
    move.mutate(
      { task, columnId, position },
      { onSuccess: (t) => toast.success(`Đã chuyển ${taskKeyOf(project.key, t)} sang ${columns.find((c) => c.id === columnId)?.name ?? "cột"}`), onError: (e) => failMove(e, task) },
    );

  const handleDragStart = (e: DragStartEvent) => setActiveTask(local.find((t) => t.id === e.active.id) ?? null);
  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const targetCol = columns.find((c) => c.id === over.id)?.id ?? local.find((t) => t.id === over.id)?.columnId;
    if (!targetCol) return;
    setLocal((prev) => prev.map((t) => (t.id === active.id && t.columnId !== targetCol ? { ...t, columnId: targetCol } : t)));
  };
  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveTask(null);
    if (!over) return;
    const original = tasksQuery.data?.find((t) => t.id === active.id);
    const moved = local.find((t) => t.id === active.id);
    if (!original || !moved) return;
    const others = colTasks(moved.columnId).filter((t) => t.id !== moved.id);
    const overIdx = others.findIndex((t) => t.id === over.id);
    let position: number;
    if (overIdx < 0) position = (others[others.length - 1]?.position ?? 0) + POSITION_STEP;
    else {
      const prev = others[overIdx - 1]?.position ?? 0;
      position = (prev + others[overIdx].position) / 2;
    }
    if (original.columnId === moved.columnId && Math.abs(position - original.position) < 1e-6) return;
    doMove(original, moved.columnId, position);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-muted-foreground">
          {project.activeSprint ? `${project.activeSprint.name} · ${project.activeSprint.startDate.slice(0, 10)} → ${project.activeSprint.endDate.slice(0, 10)}` : "Chưa có sprint đang chạy"}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden md:flex items-center -space-x-2 border-r border-border/60 pr-3 shrink-0">
            {project.members.map((m) => (
              <UserAvatar key={m.id} name={m.fullName} avatar={m.avatarUrl ?? undefined} role={m.role} size="sm" className="ring-2 ring-background" />
            ))}
          </div>
          {project.canEdit && (
            <Button size="sm" onClick={() => openCreateDialog()} className="gap-1.5 shadow-xs">
              <Plus className="h-4 w-4" /> Tạo công việc
              <kbd className="hidden sm:inline-block ml-1 text-[10px] font-mono px-1 py-0.2 rounded bg-primary-foreground/20 text-primary-foreground">
                C
              </kbd>
            </Button>
          )}
        </div>
      </div>

      {/* Thanh phân vai PM/Leader vs Thành viên thường */}
      {isLeader ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl border border-primary/20 bg-primary/5 text-xs">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary font-semibold text-xs gap-1 py-0.5">
              <ShieldCheck className="h-3.5 w-3.5" /> PM / Trưởng nhóm điều phối
            </Badge>
            <span className="text-muted-foreground">
              Toàn quyền quản trị tiến độ sprint, phân rã WBS và cân bằng tải nhân sự
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/projects/${project.id}/people?tab=balance`)}
              className="h-7 text-xs gap-1 text-info hover:text-info border-info/30 hover:bg-info/10"
            >
              <Scale className="h-3 w-3" /> Cân bằng tải AI
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/projects/${project.id}/assistant`)}
              className="h-7 text-xs gap-1 text-primary hover:text-primary border-primary/30 hover:bg-primary/10"
            >
              <Bot className="h-3 w-3" /> Trợ lý AI
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl border border-border/80 bg-card/60 text-xs">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-border bg-muted/60 text-foreground font-medium text-xs gap-1 py-0.5">
              <User className="h-3.5 w-3.5 text-primary" /> Thành viên dự án
            </Badge>
            <span className="text-muted-foreground">
              Bạn đang phụ trách <strong className="text-foreground">{myTasks.length}</strong> công việc (<strong className="text-foreground">{myHours}h</strong> còn lại).
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>Bấm phím <kbd className="px-1 py-0.5 rounded bg-background border font-mono text-[10px] text-foreground font-semibold">Q</kbd> để lọc nhanh việc của bạn · Nhấn <strong>Nhận việc</strong> trên thẻ chưa giao</span>
          </div>
        </div>
      )}


      {tasksQuery.isPending ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {columns.map((c) => (
            <div key={c.id} className="rounded-xl border border-border/60 p-4 space-y-3 bg-card/40">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-28 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : tasksQuery.isError ? (
        <ErrorState code={describeError(tasksQuery.error).code} message={describeError(tasksQuery.error).message} onRetry={() => tasksQuery.refetch()} />
      ) : emptyProject ? (
        <EmptyState
          title="Chưa có công việc nào"
          description="Dự án chưa có công việc. Tạo thủ công hoặc để Trợ lý AI phân rã yêu cầu thành WBS."
          actionLabel="Phân rã bằng Trợ lý AI"
          onAction={() => router.push(`/projects/${project.id}/assistant`)}
        />
      ) : (
        <DndContext id="kanban-board" sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          {emptyByFilter && (
            <Alert className="mb-4">
              <Filter className="h-4 w-4" />
              <AlertTitle className="text-sm">Bộ lọc đang ẩn hết công việc</AlertTitle>
              <AlertDescription className="text-xs flex items-center justify-between gap-3 flex-wrap">
                <span>Không có công việc nào khớp bộ lọc hiện tại. Các cột vẫn mở để bạn tạo việc mới.</span>
                <Button variant="outline" size="sm" className="h-7 text-xs shrink-0" onClick={() => f.clear()}>
                  Xoá bộ lọc
                </Button>
              </AlertDescription>
            </Alert>
          )}
          <ScrollArea className="w-full pb-4">
            <div className="grid gap-4 items-start" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(260px, 1fr))`, minWidth: columns.length * 270 }}>
              {columns.map((col) => (
                <Column
                  key={col.id}
                  col={col}
                  tasks={colTasks(col.id)}
                  projectKey={project.key}
                  columns={columns}
                  onOpen={openTask}
                  onMove={(t, colId) => doMove(t, colId)}
                  onClaim={handleClaimTask}
                  onAddTask={openCreateDialog}
                  currentUserId={auth.user?.id}
                  canEdit={project.canEdit}
                />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          <DragOverlay>{activeTask ? <TaskCard task={activeTask} projectKey={project.key} currentUserId={auth.user?.id} isGhost /> : null}</DragOverlay>
        </DndContext>
      )}

      <TaskDetailSheet taskId={selectedId} project={project} open={sheetOpen} onOpenChange={setSheetOpen} />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const assignee = String(f.get("assigneeId") ?? "");
              const col = String(f.get("columnId") ?? "") || selectedColumnId;
              const desc = String(f.get("description") ?? "").trim();
              mut.create.mutate(
                {
                  title: String(f.get("title") ?? "").trim(),
                  description: desc || undefined,
                  type: String(f.get("type") ?? "TASK"),
                  priority: String(f.get("priority") ?? "MEDIUM"),
                  estimateHours: Number(f.get("estimateHours")) || undefined,
                  dueDate: String(f.get("dueDate") ?? "") || undefined,
                  columnId: col && col !== "__first" ? col : undefined,
                  sprintId: createSprintId,
                  assigneeIds: assignee && assignee !== "__none" ? [assignee] : [],
                },
                {
                  onSuccess: (t) => {
                    setCreateOpen(false);
                    toast.success(`Đã tạo ${taskKeyOf(project.key, t)}`);
                  },
                  onError: (err) => toast.error(describeError(err).message, { description: describeError(err).code }),
                },
              );
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle className="text-base flex items-center justify-between">
                <span>Tạo công việc thủ công</span>
                <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border">
                  Phím C
                </kbd>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Tạo công việc mới vào {createSprintLabel}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">
                  Tiêu đề công việc <span className="text-destructive">*</span>
                </label>
                <Input name="title" placeholder="Ví dụ: Thiết kế giao diện chi tiết task..." className="text-xs h-9" required minLength={1} maxLength={200} autoFocus />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">
                  Mô tả chi tiết (tuỳ chọn)
                </label>
                <Textarea name="description" placeholder="Ghi chú thêm yêu cầu, checklist hoặc tiêu chí nghiệm thu..." className="text-xs min-h-[65px] resize-none" maxLength={2000} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">Loại công việc</label>
                  <Select name="type" defaultValue="TASK">
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="text-xs" title={typeToHint(t)}>
                          {typeToLabel(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">Cột trạng thái</label>
                  <Select name="columnId" value={selectedColumnId} onValueChange={setSelectedColumnId}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue placeholder="Chọn cột" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">Độ ưu tiên</label>
                  <Select name="priority" defaultValue="MEDIUM">
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW" className="text-xs">Thấp</SelectItem>
                      <SelectItem value="MEDIUM" className="text-xs">Trung bình</SelectItem>
                      <SelectItem value="HIGH" className="text-xs">Cao</SelectItem>
                      <SelectItem value="URGENT" className="text-xs" title="Mức quan trọng cao nhất — gấp về thời gian thì dùng cờ Khẩn trong chi tiết công việc">
                        Rất cao
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">Ước lượng (giờ)</label>
                  <Input name="estimateHours" type="number" step="0.5" min={0} placeholder="Ví dụ: 8" className="text-xs h-9" />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">Hạn chót</label>
                  <Input name="dueDate" type="date" className="text-xs h-9" />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">Người thực hiện</label>
                  <Select name="assigneeId" defaultValue="__none">
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none" className="text-xs">
                        Chưa giao (Unassigned)
                      </SelectItem>
                      {project.members.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="text-xs">
                          {m.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2 border-t border-border/40">
              <Button type="button" variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" size="sm" disabled={mut.create.isPending} className="gap-1.5">
                <Plus className="h-4 w-4" /> Tạo công việc
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Column({
  col,
  tasks,
  projectKey,
  columns,
  onOpen,
  onMove,
  onClaim,
  onAddTask,
  currentUserId,
  canEdit,
}: {
  col: BoardColumn;
  tasks: TaskListItem[];
  projectKey: string;
  columns: BoardColumn[];
  onOpen: (t: TaskListItem) => void;
  onMove: (t: TaskListItem, colId: string) => void;
  onClaim?: (t: TaskListItem) => void;
  onAddTask?: (colId: string) => void;
  currentUserId?: string;
  canEdit: boolean;
}) {
  const isOverWip = col.wipLimit != null && tasks.length > col.wipLimit;
  return (
    <div className={cn("flex flex-col rounded-xl border bg-muted/25 transition-all p-3 min-h-[520px]", isOverWip ? "border-warning ring-1 ring-warning/40 bg-warning/5" : "border-border/70")}>
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">{col.name}</h3>
          <Badge variant={isOverWip ? "warning" : "secondary"} className="font-mono text-xs tabular-nums px-1.5 py-0" title={col.wipLimit ? "Giới hạn WIP" : undefined}>
            {tasks.length}
            {col.wipLimit ? `/${col.wipLimit}` : ""}
          </Badge>
        </div>
        {isOverWip && (
          <div className="flex items-center gap-1 text-[11px] font-medium text-warning" title="Vượt WIP">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">Vượt WIP</span>
          </div>
        )}
      </div>
      <SortableContext id={col.id} items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2.5 flex-1 min-h-[100px]">
          {tasks.map((task) => (
            <div key={task.id} className="group relative">
              <SortableTaskItem task={task} projectKey={projectKey} onClick={onOpen} onClaim={onClaim} currentUserId={currentUserId} />
              {canEdit && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 rounded bg-background/90 shadow-xs hover:bg-muted" onClick={(e) => e.stopPropagation()} aria-label="Tuỳ chọn thẻ">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 text-xs">
                      <DropdownMenuLabel>Chuyển sang cột</DropdownMenuLabel>
                      {columns
                        .filter((c) => c.id !== task.columnId)
                        .map((c) => (
                          <DropdownMenuItem key={c.id} onClick={(e) => { e.stopPropagation(); onMove(task, c.id); }}>
                            {c.name}
                          </DropdownMenuItem>
                        ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpen(task); }}>Xem chi tiết</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          ))}
          {tasks.length === 0 && <div className="flex flex-1 items-center justify-center p-6 border border-dashed border-border/60 rounded-lg text-xs text-muted-foreground">Kéo thẻ vào đây</div>}
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAddTask?.(col.id)}
              className="w-full justify-start text-xs text-muted-foreground hover:text-foreground hover:bg-background/80 border border-dashed border-border/50 hover:border-border mt-1 h-8 gap-1.5 rounded-lg transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm công việc
            </Button>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
