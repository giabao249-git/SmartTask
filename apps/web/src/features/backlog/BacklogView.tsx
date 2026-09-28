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
import { GripVertical, Inbox, Maximize2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { PriorityBadge } from "@/components/app/PriorityBadge";
import { TaskDetailModal } from "@/components/app/TaskDetailModal";
import { TaskTypeBadge } from "@/components/app/TaskTypeBadge";
import { UserAvatar } from "@/components/app/UserAvatar";
import { fmtDay, taskKeyOf } from "@/components/app/TaskCard";
import { describeError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { useBoardRealtime, useMoveTask, useTasks } from "@/features/board/hooks";
import { useWorkFilters } from "@/features/work/filters";
import { useWorkSelection } from "@/features/work/selection";
import type { TaskListItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const POSITION_STEP = 1000;

function Row({
  task,
  projectId,
  projectKey,
  onOpen,
  orderedIds,
  canEdit,
}: {
  task: TaskListItem;
  projectId: string;
  projectKey: string;
  onOpen: (t: TaskListItem) => void;
  orderedIds: string[];
  canEdit: boolean;
}) {
  const sel = useWorkSelection();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const selected = sel.isSelected(task.id);
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} data-task-id={task.id}>
      <Card
        onClick={() => onOpen(task)}
        className={cn(
          "flex items-center gap-2 p-2 cursor-pointer transition-all hover:border-primary/50",
          isDragging && "opacity-30 border-dashed",
          selected && "border-primary bg-primary/5",
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
  const tasksQuery = useTasks(project.id, f.query);
  const move = useMoveTask(project.id);
  useBoardRealtime(project.id);

  const [local, setLocal] = React.useState<TaskListItem[]>([]);
  React.useEffect(() => {
    if (tasksQuery.data) setLocal(tasksQuery.data);
  }, [tasksQuery.data]);
  const [activeTask, setActiveTask] = React.useState<TaskListItem | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(params.get("task"));
  const [detailOpen, setDetailOpen] = React.useState(!!params.get("task"));
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
  const orderedIds = rows.map((t) => t.id);
  const totalHours = rows.reduce((s, t) => s + (t.estimateHours ?? 0), 0);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <Inbox className="h-3.5 w-3.5" />
        <span>
          <strong className="text-foreground">{rows.length}</strong> việc chưa vào sprint
          {totalHours > 0 && <> · tổng ước lượng <strong className="text-foreground tabular-nums">{totalHours}h</strong></>}
        </span>
        {rows.length > 0 && project.canEdit && (
          <span className="ml-auto">Kéo để xếp thứ tự · chọn nhiều rồi dùng “Sprint” ở thanh dưới để đưa vào sprint</span>
        )}
      </div>

      {tasksQuery.isPending ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : tasksQuery.isError ? (
        <ErrorState code={describeError(tasksQuery.error).code} message={describeError(tasksQuery.error).message} onRetry={() => tasksQuery.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Backlog trống"
          description="Mọi công việc đều đã nằm trong một sprint. Việc mới chưa gán sprint sẽ xuất hiện ở đây."
          actionLabel="Về bảng Kanban"
          onAction={() => f.setView("board")}
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
                  onOpen={(x) => {
                    setSelectedId(x.id);
                    setDetailOpen(true);
                  }}
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
        taskIds={rows.map((t) => t.id)}
        onNavigate={setSelectedId}
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
