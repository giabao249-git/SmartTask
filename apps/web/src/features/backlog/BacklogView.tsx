"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Filter, GripVertical, Inbox, Maximize2, Plus, Scale } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { PriorityBadge } from "@/components/app/PriorityBadge";
import { QuickCreateComposer } from "@/components/app/QuickCreateComposer";
import { TaskDetailModal } from "@/components/app/TaskDetailModal";
import { TaskTypeBadge } from "@/components/app/TaskTypeBadge";
import { UserAvatar } from "@/components/app/UserAvatar";
import { fmtDay, taskKeyOf } from "@/components/app/TaskCard";
import { describeError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { useSkills } from "@/lib/hooks/queries";
import { useBoardRealtime, useMoveTask, useTaskMutations, useTasks } from "@/features/board/hooks";
import { useWorkFilters } from "@/features/work/filters";
import { useWorkSelection } from "@/features/work/selection";
import type { TaskListItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { QuickParseDicts, QuickParseResult } from "@smarttask/shared";
import { toast } from "sonner";

/** Khớp POSITION_STEP của backend (apps/api/src/tasks/domain/position.ts). */
const POSITION_STEP = 1024;

function Row({
  task,
  projectId,
  projectKey,
  onOpen,
  orderedIds,
  canEdit,
  isFocused,
}: {
  task: TaskListItem;
  projectId: string;
  projectKey: string;
  onOpen: (t: TaskListItem) => void;
  orderedIds: string[];
  canEdit: boolean;
  isFocused: boolean;
}) {
  const sel = useWorkSelection();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const selected = sel.isSelected(task.id);
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} data-task-id={task.id} data-focused={isFocused ? "true" : undefined}>
      <Card
        onClick={() => onOpen(task)}
        className={cn(
          "flex items-center gap-2 p-2 cursor-pointer transition-all hover:border-primary/50",
          isDragging && "opacity-30 border-dashed",
          selected && "border-primary bg-primary/5",
          isFocused && !selected && "border-primary ring-1 ring-primary/40",
        )}
      >
        {canEdit && (
          <>
            <span
              {...attributes}
              {...listeners}
              className="cursor-grab text-muted-foreground hover:text-foreground"
              aria-label={`Kéo để xếp thứ tự ${taskKeyOf(projectKey, task)}`}
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-4 w-4" />
            </span>
            <span onClick={(e) => e.stopPropagation()}>
              <Checkbox
                aria-label={`Chọn ${taskKeyOf(projectKey, task)}`}
                checked={selected}
                onClick={(e) => sel.toggle(task.id, orderedIds, (e as React.MouseEvent).shiftKey)}
              />
            </span>
          </>
        )}
        <Badge variant="outline" className="font-mono text-xs shrink-0">
          {taskKeyOf(projectKey, task)}
        </Badge>
        <TaskTypeBadge type={task.type} size="icon" />
        <PriorityBadge priority={task.priority} showIcon={false} />
        <span className="flex-1 truncate text-sm">{task.title}</span>
        {task.estimateHours != null && (
          <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{task.estimateHours}h</span>
        )}
        {task.dueDate && <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{fmtDay(task.dueDate)}</span>}
        <div className="flex -space-x-1.5 shrink-0">
          {task.assignees.slice(0, 2).map((a) => (
            <UserAvatar key={a.id} name={a.shortName ?? a.fullName} avatar={a.avatarUrl ?? undefined} size="sm" className="ring-2 ring-card" />
          ))}
        </div>
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label={`Mở trang chi tiết ${taskKeyOf(projectKey, task)}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Link href={`/projects/${projectId}/tasks/${taskKeyOf(projectKey, task)}`}>
            <Maximize2 className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </Card>
    </div>
  );
}

/**
 * Backlog: việc chưa thuộc sprint nào, xếp thứ tự bằng kéo thả (docs 02/05 §B7).
 *
 * Dùng chung `GET /projects/:id/tasks?backlog=true` và chung bộ lọc/lựa chọn với các cách nhìn
 * khác, nên đưa việc vào sprint hàng loạt đã có sẵn ở thanh thao tác (B1) — không cần gì thêm.
 *
 * Tạo nhanh inline (§A1) dùng chung `QuickCreateComposer` với cột Kanban: việc tạo ra để trống
 * `sprintId` nên backend gán vào backlog. Phím tắt C/J/K/X/Enter/Esc kiểu Jira (§C1).
 *
 * Thứ tự lưu bằng `position` qua `PATCH /tasks/:id/move` (giữ nguyên cột, chỉ đổi vị trí), mang
 * `version` như mọi lần ghi khác. Lưu ý: `position` vốn là thứ tự TRONG MỘT CỘT của bảng Kanban;
 * ở đây xếp chung cả backlog nên hai việc khác cột có thể nhận giá trị xen kẽ nhau — vô hại, vì
 * Kanban chỉ so vị trí giữa các thẻ cùng cột.
 */
export function BacklogView() {
  const project = useCurrentProject();
  const auth = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const f = useWorkFilters();
  const sel = useWorkSelection();
  const tasksQuery = useTasks(project.id, f.query);
  const move = useMoveTask(project.id);
  const mut = useTaskMutations(project.id);
  useBoardRealtime(project.id);

  const [local, setLocal] = React.useState<TaskListItem[]>([]);
  React.useEffect(() => {
    if (tasksQuery.data) setLocal(tasksQuery.data);
  }, [tasksQuery.data]);
  const [activeTask, setActiveTask] = React.useState<TaskListItem | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(params.get("task"));
  const [detailOpen, setDetailOpen] = React.useState(!!params.get("task"));
  const [composerOpen, setComposerOpen] = React.useState(false);
  const [focusedId, setFocusedId] = React.useState<string | null>(null);
  const urlTaskId = params.get("task");
  React.useEffect(() => {
    if (!urlTaskId) return;
    setSelectedId(urlTaskId);
    setDetailOpen(true);
  }, [urlTaskId]);

  const rows = React.useMemo(
    () => f.applyQuick(local, auth.user?.id).slice().sort((a, b) => a.position - b.position),
    [local, f, auth.user?.id],
  );
  const orderedIds = React.useMemo(() => rows.map((t) => t.id), [rows]);
  const totalHours = rows.reduce((s, t) => s + (t.estimateHours ?? 0), 0);

  /** Danh mục để cú pháp nhanh so khớp @người #nhãn ~kỹ-năng — chỉ khớp thứ có thật, không bịa. */
  const skills = useSkills(project.workspaceId);
  const dicts = React.useMemo<QuickParseDicts>(
    () => ({
      members: project.members.map((m) => ({ id: m.id, fullName: m.fullName, shortName: m.shortName })),
      labels: project.labels.map((l) => ({ id: l.id, name: l.name })),
      skills: (skills.data ?? []).map((s) => ({ id: s.id, name: s.name })),
    }),
    [project.members, project.labels, skills.data],
  );

  /**
   * Tạo nhanh từ ô inline — không truyền sprintId nên việc mới nằm trong backlog; cột lấy cột
   * đầu (backend cũng chọn cột đầu khi bỏ trống). Tuỗin tự từng việc như Kanban để không hai
   * POST cùng lúc tranh `task_counter`.
   */
  const quickCreate = React.useCallback(
    async (items: QuickParseResult[]) => {
      const firstColumnId = project.columns.slice().sort((a, b) => a.position - b.position)[0]?.id;
      for (const it of items) {
        try {
          await mut.create.mutateAsync({
            title: it.title,
            ...(firstColumnId ? { columnId: firstColumnId } : {}),
            ...(it.priority ? { priority: it.priority } : {}),
            ...(it.estimateHours ? { estimateHours: it.estimateHours } : {}),
            ...(it.dueDate ? { dueDate: it.dueDate } : {}),
            ...(it.assigneeIds.length ? { assigneeIds: it.assigneeIds } : {}),
            ...(it.labelIds.length ? { labelIds: it.labelIds } : {}),
            ...(it.requiredSkills.length ? { requiredSkills: it.requiredSkills } : {}),
          });
        } catch (err) {
          const { code, message } = describeError(err);
          toast.error(`Không tạo được "${it.title.slice(0, 40)}"`, { description: `${code}: ${message}` });
          throw err;
        }
      }
      if (items.length > 1) toast.success(`Đã tạo ${items.length} công việc`);
    },
    [mut.create, project.columns],
  );

  const openTask = React.useCallback((t: TaskListItem) => {
    setSelectedId(t.id);
    setDetailOpen(true);
  }, []);

  const openComposer = React.useCallback(() => {
    if (project.canEdit) setComposerOpen(true);
  }, [project.canEdit]);

  /** Di chuyển ô trỏ dọc danh sách phẳng; chưa trỏ gì thì bắt đầu từ đầu/cuối danh sách. */
  const moveFocus = React.useCallback(
    (dy: number) => {
      if (!rows.length) return;
      const idx = focusedId ? rows.findIndex((t) => t.id === focusedId) : -1;
      const next = idx < 0 ? (dy > 0 ? 0 : rows.length - 1) : Math.min(rows.length - 1, Math.max(0, idx + dy));
      setFocusedId(rows[next].id);
    },
    [rows, focusedId],
  );

  // Cuộn việc đang trỏ vào tầm nhìn
  React.useEffect(() => {
    if (!focusedId) return;
    document.querySelector(`[data-task-id="${focusedId}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [focusedId]);

  /**
   * Phím tắt trên backlog, kiểu Jira (docs 02/05 §C1). Bỏ qua khi con trỏ đang ở ô nhập,
   * khi có phím bổ trợ, hoặc khi đang mở modal chi tiết/hộp thoại/menu — để không giành phím của Radix.
   */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Radix giữ node lại lúc chạy hiệu ứng đóng (data-state="closed"), nên phải loại trừ,
      // không thì đóng modal xong là mọi phím tắt chết cho tới khi render lại.
      if (document.querySelector('[role="dialog"]:not([data-state="closed"]),[role="alertdialog"]:not([data-state="closed"]),[role="menu"],[cmdk-root]')) return;

      const focused = focusedId ? rows.find((t) => t.id === focusedId) ?? null : null;
      const take = () => e.preventDefault();

      switch (e.key) {
        case "c":
        case "C":
          if (!project.canEdit) return;
          take();
          openComposer();
          return;
        case "j":
        case "J":
        case "ArrowDown":
          take();
          moveFocus(1);
          return;
        case "k":
        case "K":
        case "ArrowUp":
          take();
          moveFocus(-1);
          return;
        case "Enter":
        case "o":
        case "O":
          if (!focused) return;
          take();
          openTask(focused);
          return;
        case "x":
        case "X":
          if (!focused || !project.canEdit) return;
          take();
          sel.toggle(focused.id, orderedIds);
          return;
        case "Escape":
          take();
          if (sel.active) sel.clear();
          else setFocusedId(null);
          return;
        default:
          return;
      }
    };
    // Bắt ở pha capture: Radix xử lý Escape trước rồi đặt data-state="closed", nên nếu nghe ở
    // pha bubble thì đúng phím Escape đóng modal sẽ lọt qua guard và xoá luôn ô trỏ.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [focusedId, rows, project.canEdit, openComposer, moveFocus, openTask, orderedIds, sel]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));

  const onDragStart = (e: DragStartEvent) => setActiveTask(rows.find((t) => t.id === e.active.id) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveTask(null);
    if (!over || active.id === over.id) return;
    const from = rows.findIndex((t) => t.id === active.id);
    const to = rows.findIndex((t) => t.id === over.id);
    if (from < 0 || to < 0) return;
    const task = rows[from];
    const others = rows.filter((t) => t.id !== task.id);
    const prev = others[to - 1]?.position ?? null;
    const next = others[to]?.position ?? null;
    const position =
      prev === null && next === null ? POSITION_STEP : prev === null ? (next as number) - POSITION_STEP : next === null ? prev + POSITION_STEP : (prev + next) / 2;
    move.mutate(
      { task, columnId: task.columnId, position },
      {
        onError: (err) => {
          const { code, message } = describeError(err);
          toast.error(`Không xếp được ${taskKeyOf(project.key, task)}`, { description: `${code}: ${message}` });
          void tasksQuery.refetch();
        },
      },
    );
  };

  /**
   * Hai trạng thái rỗng khác nhau (docs 10 §2): backlog chưa có việc nào thì mời tạo;
   * còn lọc ra 0 kết quả thì vẫn giữ ô tạo nhanh, chỉ báo là bộ lọc đang ẩn hết.
   */
  const emptyByFilter = rows.length === 0 && f.isFiltered;
  const emptyProject = rows.length === 0 && !f.isFiltered;
  const isLeader = project.canManage || project.myRole === "PM";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <Inbox className="h-3.5 w-3.5" />
        <span>
          <strong className="text-foreground">{rows.length}</strong> việc chưa vào sprint
          {totalHours > 0 && <> · tổng ước lượng <strong className="text-foreground tabular-nums">{totalHours}h</strong></>}
        </span>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {rows.length > 0 && project.canEdit && (
            <span className="hidden lg:inline">Kéo để xếp thứ tự · chọn nhiều rồi dùng “Sprint” ở thanh dưới để đưa vào sprint</span>
          )}
          {isLeader && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/projects/${project.id}/people?tab=balance`)}
              className="h-7 text-xs gap-1 text-info hover:text-info border-info/30 hover:bg-info/10"
              title="UC-39: backend tính tải, Trợ lý AI chọn người, PM duyệt bản nhập"
            >
              <Scale className="h-3.5 w-3.5" /> Đề xuất phân công
            </Button>
          )}
          {project.canEdit && (
            <Button size="sm" variant="outline" onClick={() => setComposerOpen((v) => !v)} className="h-7 gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> Tạo nhanh
              <kbd className="hidden sm:inline-block text-[10px] font-mono px-1 rounded bg-muted text-muted-foreground border">C</kbd>
            </Button>
          )}
        </div>
      </div>

      {composerOpen && project.canEdit && (
        <QuickCreateComposer label="Backlog" dicts={dicts} onCreate={quickCreate} onClose={() => setComposerOpen(false)} />
      )}

      {tasksQuery.isPending ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : tasksQuery.isError ? (
        <ErrorState code={describeError(tasksQuery.error).code} message={describeError(tasksQuery.error).message} onRetry={() => tasksQuery.refetch()} />
      ) : emptyByFilter ? (
        <Alert>
          <Filter className="h-4 w-4" />
          <AlertTitle className="text-sm">Bộ lọc đang ẩn hết công việc</AlertTitle>
          <AlertDescription className="text-xs flex items-center justify-between gap-3 flex-wrap">
            <span>Không có công việc nào khớp bộ lọc hiện tại. Nút “Tạo nhanh” phía trên vẫn dùng được để thêm việc mới.</span>
            <Button variant="outline" size="sm" className="h-7 text-xs shrink-0" onClick={() => f.clear()}>
              Xoá bộ lọc
            </Button>
          </AlertDescription>
        </Alert>
      ) : emptyProject ? (
        <EmptyState
          icon={Inbox}
          title="Backlog trống"
          description="Mọi công việc đều đã nằm trong một sprint. Việc mới chưa gán sprint sẽ xuất hiện ở đây."
          actionLabel={project.canEdit ? "Tạo công việc đầu tiên" : "Về bảng Kanban"}
          onAction={() => (project.canEdit ? setComposerOpen(true) : f.setView("board"))}
        />
      ) : (
        <DndContext id="backlog" sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {rows.map((t) => (
                <Row
                  key={t.id}
                  task={t}
                  projectId={project.id}
                  projectKey={project.key}
                  orderedIds={orderedIds}
                  canEdit={project.canEdit}
                  isFocused={focusedId === t.id}
                  onOpen={openTask}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeTask ? (
              <Card className="flex items-center gap-2 p-2 shadow-xl border-primary">
                <Badge variant="outline" className="font-mono text-xs">
                  {taskKeyOf(project.key, activeTask)}
                </Badge>
                <span className="truncate text-sm">{activeTask.title}</span>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <TaskDetailModal
        taskId={selectedId}
        project={project}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onOpenFullPage={() => {
          const t = rows.find((x) => x.id === selectedId);
          if (!t) return;
          setDetailOpen(false);
          router.push(`/projects/${project.id}/tasks/${taskKeyOf(project.key, t)}`);
        }}
      />
    </div>
  );
}
