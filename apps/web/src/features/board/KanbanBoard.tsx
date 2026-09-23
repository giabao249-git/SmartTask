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
import { Plus, MoreHorizontal, AlertTriangle, ShieldCheck, User, Scale, Bot, Filter, Loader2, ChevronDown, Copy, Trash2, UserPlus, Flag, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskCard, taskKeyOf } from "@/components/app/TaskCard";
import { AssigneePicker, LabelPicker, SkillPicker } from "@/components/app/TaskFieldPickers";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TaskDetailSheet } from "@/components/app/TaskDetailSheet";
import { UserAvatar } from "@/components/app/UserAvatar";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { describeError, isApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { useWorkFilters } from "@/features/work/filters";
import type { BoardColumn, ProjectDetail, TaskListItem } from "@/lib/types";
import { TASK_TYPES, typeToHint, typeToLabel } from "@/lib/status";
import { PriorityBadge } from "@/components/app/PriorityBadge";
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
/** Dán nhầm cả tệp thì không tạo hàng trăm việc — chặn cứng ở đây (docs 02/05 §A2). */
const MAX_PASTE_LINES = 50;

/** Mốc hạn hay dùng trong menu nhanh của thẻ; tính theo ngày địa phương, trả YYYY-MM-DD. */
const dayFromNow = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const DUE_PRESETS = [
  { label: "Hôm nay", value: () => dayFromNow(0) },
  { label: "Ngày mai", value: () => dayFromNow(1) },
  { label: "Cuối tuần này", value: () => dayFromNow((7 - new Date().getDay()) % 7 || 7) },
  { label: "Tuần sau", value: () => dayFromNow(7) },
];

/**
 * Tách nội dung dán thành danh sách tiêu đề: bỏ dòng trắng, bỏ tiền tố gạch đầu dòng và
 * số thứ tự, cắt 200 ký tự cho khớp MaxLength của CreateTaskDto. Thuần tất định, không AI.
 */
function splitTitles(raw: string, keepAll = false): string[] {
  const all = raw
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*+•]|\d+[.)])\s+/, "").trim())
    .filter(Boolean)
    .map((l) => l.slice(0, 200));
  return keepAll ? all : all.slice(0, MAX_PASTE_LINES);
}


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
  /** Cột nào đang mở ô tạo nhanh (mỗi lúc chỉ một). */
  const [composerColId, setComposerColId] = React.useState<string | null>(null);
  const [draftTitle, setDraftTitle] = React.useState("");
  /** Các ô chọn nâng cao trong hộp thoại tạo — Popover nên FormData không đọc được, phải giữ state. */
  const [newAssignees, setNewAssignees] = React.useState<string[]>([]);
  const [newLabels, setNewLabels] = React.useState<string[]>([]);
  const [newSkills, setNewSkills] = React.useState<{ skillId: string; minLevel: number }[]>([]);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const resetCreateForm = React.useCallback(() => {
    setNewAssignees([]);
    setNewLabels([]);
    setNewSkills([]);
    setMoreOpen(false);
    setDraftTitle("");
  }, []);

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

  /**
   * Tạo nhanh từ ô trong cột — tuần tự từng việc để không hai POST cùng lúc tranh `task_counter`
   * và không đụng giới hạn 100 req/phút. Lỗi thì dừng, giữ nguyên phần chưa tạo cho người dùng.
   */
  const quickCreate = React.useCallback(
    async (columnId: string, titles: string[]) => {
      for (const title of titles) {
        try {
          await mut.create.mutateAsync({
            title,
            columnId,
            sprintId: createSprintId,
          });
        } catch (err) {
          const { code, message } = describeError(err);
          toast.error(`Không tạo được "${title.slice(0, 40)}"`, { description: `${code}: ${message}` });
          throw err;
        }
      }
      if (titles.length > 1) toast.success(`Đã tạo ${titles.length} công việc`);
    },
    [mut.create, createSprintId],
  );

  const openComposer = React.useCallback(
    (colId?: string) => {
      setComposerColId(colId || columns[0]?.id || null);
    },
    [columns],
  );

  // Shortcuts: Q để bật/tắt "Việc của tôi", C để mở ô tạo nhanh ở cột đầu
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
        openComposer();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openComposer, project.canEdit, f]);

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

  /**
   * Thao tác nhanh trên thẻ (docs 02/05 §B3) — dùng lại đúng các mutation đã có, mang `version`
   * và phát task:* như thường; không mở đường ghi mới. Giao việc từ bảng còn 2 thao tác thay vì 4.
   */
  const quickPatch = React.useCallback(
    (task: TaskListItem, patch: Record<string, unknown>, what: string) => {
      mut.update.mutate(
        { id: task.id, version: task.version, patch },
        {
          onSuccess: () => toast.success(`${what} — ${taskKeyOf(project.key, task)}`),
          onError: (e) => {
            const { code, message } = describeError(e);
            if (code === "TASK_VERSION_CONFLICT") toast.error(`${taskKeyOf(project.key, task)} vừa được người khác sửa — đã tải lại`, { description: code });
            else toast.error(`${what} thất bại`, { description: `${code}: ${message}` });
            void tasksQuery.refetch();
          },
        },
      );
    },
    [mut.update, project.key, tasksQuery],
  );

  const quickAssign = React.useCallback(
    (task: TaskListItem, userIds: string[], what: string) => {
      mut.assignees.mutate(
        { id: task.id, version: task.version, userIds },
        {
          onSuccess: () => toast.success(`${what} — ${taskKeyOf(project.key, task)}`),
          onError: (e) => {
            toast.error("Giao việc thất bại", { description: describeError(e).code });
            void tasksQuery.refetch();
          },
        },
      );
    },
    [mut.assignees, project.key, tasksQuery],
  );

  const [confirmDelete, setConfirmDelete] = React.useState<TaskListItem | null>(null);

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
            <>
              <Button size="sm" variant="outline" onClick={() => openComposer()} className="gap-1.5" title="Tạo nhanh trong cột đầu">
                <Plus className="h-4 w-4" /> Tạo nhanh
                <kbd className="hidden sm:inline-block ml-1 text-[10px] font-mono px-1 py-0.2 rounded bg-muted text-muted-foreground border">C</kbd>
              </Button>
              <Button size="sm" onClick={() => openCreateDialog()} className="gap-1.5 shadow-xs">
                <Plus className="h-4 w-4" /> Tạo công việc
              </Button>
            </>
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
                  members={project.members}
                  selfId={auth.user?.id}
                  onPatch={quickPatch}
                  onAssign={quickAssign}
                  onDuplicate={(t) =>
                    mut.duplicate.mutate(
                      { id: t.id },
                      {
                        onSuccess: (copy) => toast.success(`Đã nhân bản thành ${taskKeyOf(project.key, copy)} (ở cột đầu)`),
                        onError: (e) => toast.error("Nhân bản thất bại", { description: describeError(e).code }),
                      },
                    )
                  }
                  onAskDelete={setConfirmDelete}
                  onAddTask={openComposer}
                  composerOpen={composerColId === col.id}
                  onCloseComposer={() => setComposerColId(null)}
                  onQuickCreate={(titles) => quickCreate(col.id, titles)}
                  onOpenFull={(title) => {
                    setComposerColId(null);
                    setDraftTitle(title);
                    openCreateDialog(col.id);
                  }}
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

      {/* Xoá là hành động không hoàn tác được (chưa có endpoint khôi phục) → AlertDialog theo docs 10 §4. */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">
              Xoá {confirmDelete ? taskKeyOf(project.key, confirmDelete) : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              &quot;{confirmDelete?.title}&quot; sẽ bị xoá cùng mọi việc con. Hiện chưa có chức năng khôi phục.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const t = confirmDelete;
                setConfirmDelete(null);
                if (!t) return;
                mut.remove.mutate(t.id, {
                  onSuccess: () => toast.success(`Đã xoá ${taskKeyOf(project.key, t)}`),
                  onError: (e) => toast.error("Xoá thất bại", { description: describeError(e).code }),
                });
              }}
            >
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) resetCreateForm();
        }}
      >
        <DialogContent className="sm:max-w-lg" key={draftTitle}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const col = String(f.get("columnId") ?? "") || selectedColumnId;
              const desc = String(f.get("description") ?? "").trim();
              mut.create.mutate(
                {
                  title: String(f.get("title") ?? "").trim(),
                  description: desc || undefined,
                  type: String(f.get("type") ?? "TASK"),
                  priority: String(f.get("priority") ?? "MEDIUM"),
                  difficulty: Number(f.get("difficulty")) || undefined,
                  estimateHours: Number(f.get("estimateHours")) || undefined,
                  startDate: String(f.get("startDate") ?? "") || undefined,
                  dueDate: String(f.get("dueDate") ?? "") || undefined,
                  columnId: col && col !== "__first" ? col : undefined,
                  sprintId: createSprintId,
                  assigneeIds: newAssignees,
                  labelIds: newLabels,
                  requiredSkills: newSkills,
                },
                {
                  onSuccess: (t) => {
                    setCreateOpen(false);
                    resetCreateForm();
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
                <Input name="title" defaultValue={draftTitle} placeholder="Ví dụ: Thiết kế giao diện chi tiết task..." className="text-xs h-9" required minLength={1} maxLength={200} autoFocus />
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
                  <AssigneePicker value={newAssignees} members={project.members} disabled={mut.create.isPending} onChange={setNewAssignees} />
                </div>
              </div>

              {/*
                Nhãn, kỹ năng yêu cầu, độ khó, ngày bắt đầu: để sau nút thu gọn cho form khỏi dài,
                nhưng PHẢI có mặt ở bước tạo — kỹ năng và độ khó là đầu vào của tính tải (UC-24) và
                bảng năng lực (UC-26); tạo xong bỏ trống thì việc đó vô hình với màn Cân bằng tải.
              */}
              <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="h-7 w-full justify-between px-2 text-xs text-muted-foreground">
                    <span>
                      Thêm chi tiết
                      {newLabels.length + newSkills.length > 0 && (
                        <span className="ml-1 text-foreground">· đã đặt {newLabels.length + newSkills.length}</span>
                      )}
                    </span>
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", moreOpen && "rotate-180")} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-foreground mb-1 block">Nhãn</label>
                      <LabelPicker value={newLabels} labels={project.labels} disabled={mut.create.isPending} onChange={setNewLabels} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground mb-1 block">Kỹ năng yêu cầu</label>
                      <SkillPicker value={newSkills} workspaceId={project.workspaceId} disabled={mut.create.isPending} onChange={setNewSkills} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground mb-1 block">Độ khó (1–5)</label>
                      <Select name="difficulty" defaultValue="3">
                        <SelectTrigger className="text-xs h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((d) => (
                            <SelectItem key={d} value={String(d)} className="text-xs">
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground mb-1 block">Ngày bắt đầu</label>
                      <Input name="startDate" type="date" className="text-xs h-9" />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
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

/**
 * Ô tạo nhanh trong cột (docs 02/05 §A1, §A2) — Enter tạo xong ô vẫn mở cho việc kế tiếp,
 * dán nhiều dòng thì hỏi tách thành nhiều công việc. Không có endpoint mới: vẫn là
 * POST /projects/:id/tasks, chỉ khác là không phải mở hộp thoại cho từng việc.
 */
function ColumnComposer({
  columnName,
  onCreate,
  onOpenFull,
  onClose,
}: {
  columnName: string;
  onCreate: (titles: string[]) => Promise<void>;
  onOpenFull: (title: string) => void;
  onClose: () => void;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);

  // Ô bị `disabled` trong lúc lưu nên mất focus; lấy lại ngay khi lưu xong để gõ tiếp việc kế.
  React.useEffect(() => {
    if (!busy) ref.current?.focus();
  }, [busy]);
  // Ô cao dần theo nội dung, không cần thư viện autosize
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const lines = React.useMemo(() => splitTitles(value), [value]);
  const many = lines.length > 1;

  const submit = async (titles: string[]) => {
    if (!titles.length || busy) return;
    setBusy(true);
    setProgress(titles.length > 1 ? { done: 0, total: titles.length } : null);
    try {
      for (let i = 0; i < titles.length; i += 1) {
        await onCreate([titles[i]]);
        setProgress((p) => (p ? { ...p, done: i + 1 } : null));
      }
      setValue("");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-2 space-y-2">
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!many) void submit(lines);
          }
        }}
        placeholder={`Tiêu đề công việc trong "${columnName}"…`}
        disabled={busy}
        rows={1}
        maxLength={MAX_PASTE_LINES * 210}
        className="text-xs min-h-9 resize-none py-2"
      />

      {many && (
        <Alert className="p-2">
          <AlertDescription className="text-[11px] flex items-center justify-between gap-2 flex-wrap">
            <span>
              Phát hiện <strong>{lines.length}</strong> dòng
              {splitTitles(value, true).length > MAX_PASTE_LINES && ` (đã cắt còn ${MAX_PASTE_LINES})`}
            </span>
            <span className="flex items-center gap-1.5 shrink-0">
              <Button size="sm" className="h-6 text-[11px]" disabled={busy} onClick={() => void submit(lines)}>
                Tạo {lines.length} công việc
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[11px]"
                disabled={busy}
                onClick={() => void submit([lines.join(" ").slice(0, 200)])}
              >
                Giữ một công việc
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      )}

      {progress && <Progress value={(progress.done / progress.total) * 100} className="h-1" />}

      <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span>
          {busy ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {progress ? `Đang tạo ${progress.done}/${progress.total}…` : "Đang tạo…"}
            </span>
          ) : (
            <>
              <kbd className="px-1 rounded border bg-background font-mono">Enter</kbd> tạo ·{" "}
              <kbd className="px-1 rounded border bg-background font-mono">Shift+Enter</kbd> xuống dòng ·{" "}
              <kbd className="px-1 rounded border bg-background font-mono">Esc</kbd> đóng
            </>
          )}
        </span>
        <Button
          variant="link"
          size="sm"
          className="h-5 px-0 text-[10px]"
          disabled={busy}
          onClick={() => onOpenFull(lines[0] ?? "")}
        >
          Mở đầy đủ…
        </Button>
      </div>
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
  members,
  selfId,
  onPatch,
  onAssign,
  onDuplicate,
  onAskDelete,
  onAddTask,
  composerOpen,
  onCloseComposer,
  onQuickCreate,
  onOpenFull,
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
  members: ProjectDetail["members"];
  selfId?: string;
  onPatch: (t: TaskListItem, patch: Record<string, unknown>, what: string) => void;
  onAssign: (t: TaskListItem, userIds: string[], what: string) => void;
  onDuplicate: (t: TaskListItem) => void;
  onAskDelete: (t: TaskListItem) => void;
  onAddTask?: (colId: string) => void;
  composerOpen: boolean;
  onCloseComposer: () => void;
  onQuickCreate: (titles: string[]) => Promise<void>;
  onOpenFull: (title: string) => void;
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
                    <DropdownMenuContent align="end" className="w-56 text-xs" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="text-xs gap-2">
                          <UserPlus className="h-3.5 w-3.5" /> Giao cho
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="text-xs">
                          {selfId && (
                            <DropdownMenuItem onClick={() => onAssign(task, [selfId], "Đã giao cho tôi")}>Giao cho tôi</DropdownMenuItem>
                          )}
                          {members.map((m) => (
                            <DropdownMenuItem key={m.id} onClick={() => onAssign(task, [m.id], `Đã giao cho ${m.shortName ?? m.fullName}`)}>
                              {m.fullName}
                            </DropdownMenuItem>
                          ))}
                          {task.assignees.length > 0 && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => onAssign(task, [], "Đã bỏ giao")}>Bỏ giao</DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>

                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="text-xs gap-2">
                          <Flag className="h-3.5 w-3.5" /> Đặt ưu tiên
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="text-xs">
                          {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((p) => (
                            <DropdownMenuItem key={p} disabled={task.priority === p} onClick={() => onPatch(task, { priority: p }, "Đã đổi ưu tiên")}>
                              <PriorityBadge priority={p} />
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>

                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="text-xs gap-2">
                          <CalendarDays className="h-3.5 w-3.5" /> Đặt hạn
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="text-xs">
                          {DUE_PRESETS.map((d) => (
                            <DropdownMenuItem key={d.label} onClick={() => onPatch(task, { dueDate: d.value() }, `Đã đặt hạn ${d.label.toLowerCase()}`)}>
                              {d.label}
                            </DropdownMenuItem>
                          ))}
                          {task.dueDate && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => onPatch(task, { dueDate: null }, "Đã bỏ hạn")}>Bỏ hạn</DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>

                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-[10px] font-normal text-muted-foreground">Chuyển sang cột</DropdownMenuLabel>
                      {columns
                        .filter((c) => c.id !== task.columnId)
                        .map((c) => (
                          <DropdownMenuItem key={c.id} onClick={() => onMove(task, c.id)}>
                            {c.name}
                          </DropdownMenuItem>
                        ))}

                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onOpen(task)}>Xem chi tiết</DropdownMenuItem>
                      <DropdownMenuItem className="gap-2" onClick={() => onDuplicate(task)}>
                        <Copy className="h-3.5 w-3.5" /> Nhân bản
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={() => onAskDelete(task)}>
                        <Trash2 className="h-3.5 w-3.5" /> Xoá công việc
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          ))}
          {tasks.length === 0 && <div className="flex flex-1 items-center justify-center p-6 border border-dashed border-border/60 rounded-lg text-xs text-muted-foreground">Kéo thẻ vào đây</div>}
          {canEdit &&
            (composerOpen ? (
              <ColumnComposer
                columnName={col.name}
                onCreate={onQuickCreate}
                onOpenFull={onOpenFull}
                onClose={onCloseComposer}
              />
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAddTask?.(col.id)}
                className="w-full justify-start text-xs text-muted-foreground hover:text-foreground hover:bg-background/80 border border-dashed border-border/50 hover:border-border mt-1 h-8 gap-1.5 rounded-lg transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Thêm công việc
              </Button>
            ))}
        </div>
      </SortableContext>
    </div>
  );
}
