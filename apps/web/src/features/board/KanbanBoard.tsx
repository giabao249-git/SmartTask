"use client";

import * as React from "react";
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
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, MoreHorizontal, AlertTriangle, Users, Sparkles, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskCard } from "@/components/app/TaskCard";
import { TaskDetailSheet } from "@/components/app/TaskDetailSheet";
import { UserAvatar } from "@/components/app/UserAvatar";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { StateToggle, type ScreenState } from "@/components/app/StateToggle";
import { INITIAL_TASKS, type TaskItem } from "@/mocks/tasks";
import { MEMBERS } from "@/mocks/members";
import { type TaskStatus } from "@/lib/status";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ColumnDef {
  id: TaskStatus;
  title: string;
  wipLimit?: number;
}

const COLUMNS: ColumnDef[] = [
  { id: "TODO", title: "Cần làm" },
  { id: "IN_PROGRESS", title: "Đang làm", wipLimit: 3 },
  { id: "REVIEW", title: "Review" },
  { id: "DONE", title: "Hoàn thành" },
];

// Sortable wrapper for individual task card
function SortableTaskItem({
  task,
  onClick,
}: {
  task: TaskItem;
  onClick: (t: TaskItem) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: "Task", task },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} onClick={onClick} isDragging={isDragging} />
    </div>
  );
}

export function KanbanBoard() {
  const [screenState, setScreenState] = React.useState<ScreenState>("data");
  const [tasks, setTasks] = React.useState<TaskItem[]>(INITIAL_TASKS);
  const [activeTask, setActiveTask] = React.useState<TaskItem | null>(null);
  const [selectedTask, setSelectedTask] = React.useState<TaskItem | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  // DnD Sensors: Mouse/Touch + Keyboard
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Tránh kích hoạt nhầm khi click mở modal
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Realtime toast simulation on initial mount
  React.useEffect(() => {
    const timer = setTimeout(() => {
      toast.info("Thẻ ST-7 vừa được Lan cập nhật", {
        description: "Mô tả yêu cầu kỹ thuật và tiêu chí kiểm thử đã thay đổi.",
      });
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  const getColumnTasks = (status: TaskStatus) => {
    return tasks.filter((t) => t.status === status);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    // Determine target column
    const isOverAColumn = COLUMNS.some((col) => col.id === overId);
    let targetStatus: TaskStatus | null = null;

    if (isOverAColumn) {
      targetStatus = overId as TaskStatus;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) {
        targetStatus = overTask.status;
      }
    }

    if (targetStatus && activeTask && activeTask.status !== targetStatus) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === activeId ? { ...t, status: targetStatus! } : t
        )
      );
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id;
    const movedTask = tasks.find((t) => t.id === activeId);

    if (movedTask) {
      // Check WIP limit warning
      const inProgressCount = tasks.filter((t) => t.status === "IN_PROGRESS").length;
      if (movedTask.status === "IN_PROGRESS" && inProgressCount > 3) {
        toast.warning("Cảnh báo vượt giới hạn WIP (Đang làm)", {
          description: `Cột Đang làm hiện có ${inProgressCount}/3 việc. Vui lòng cân nhắc cân bằng tải.`,
        });
      } else {
        toast.success(`Đã chuyển thẻ ${movedTask.code} sang cột ${movedTask.status}`);
      }
    }
  };

  const handleCardClick = (task: TaskItem) => {
    setSelectedTask(task);
    setSheetOpen(true);
  };

  // Keyboard shortcut to move columns via dropdown menu
  const moveTaskToStatus = (taskId: string, targetStatus: TaskStatus) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: targetStatus } : t))
    );
    toast.success("Đã chuyển trạng thái thẻ thành công");
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Bảng Kanban Sprint 3"
        description="Quản trị công việc Agile thời gian thực · Sprint 3 · 23/10–29/10"
        breadcrumbs={[
          { label: "VNPT Dev Team", href: "/workspaces" },
          { label: "SmartTask v1", href: "/projects/ST/dashboard" },
          { label: "Bảng Kanban" },
        ]}
      >
        {/* Presence Avatars of team in top-right */}
        <div className="flex items-center gap-3">
          <div className="flex items-center -space-x-2 border-r border-border/60 pr-3">
            {MEMBERS.map((m) => (
              <UserAvatar
                key={m.id}
                name={m.name}
                avatar={m.avatar}
                role={m.role}
                initials={m.initials}
                isOnline={m.isOnline}
                workloadPercent={m.utilization}
                size="sm"
              />
            ))}
          </div>

          <Button
            size="sm"
            onClick={() => {
              const newTask: TaskItem = {
                id: `task-quick-${Date.now()}`,
                code: `ST-${tasks.length + 1}`,
                title: "Công việc mới cần xử lý trong Sprint",
                description: "Nhập mô tả chi tiết yêu cầu...",
                status: "TODO",
                priority: "MEDIUM",
                assigneeId: "user-an",
                assignee: MEMBERS.find((m) => m.id === "user-an")!,
                estimateHours: 4,
                actualHours: 0,
                remainingHours: 4,
                startDate: "2026-10-27",
                dueDate: "2026-10-29",
                labels: ["frontend"],
                subtasks: [],
                requiredSkills: [{ name: "React", level: 2 }],
                dependencies: [],
                comments: [],
                activities: [],
                sprint: "Sprint 3 · 23/10–29/10",
              };
              setTasks([newTask, ...tasks]);
              toast.success(`Đã tạo nhanh thẻ ${newTask.code}`);
            }}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Tạo công việc
          </Button>
        </div>
      </PageHeader>

      {/* Screen State Handling */}
      {screenState === "loading" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/60 p-4 space-y-3 bg-card/40">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-8 rounded-full" />
              </div>
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-28 w-full rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {screenState === "empty" && (
        <EmptyState
          title="Sprint chưa có công việc nào"
          description="Hiện chưa có thẻ nào trong bảng Kanban của Sprint 3. Bạn có thể sử dụng AI Agent để tự động phân rã yêu cầu hoặc thêm thẻ thủ công."
          actionLabel="Phân rã bằng AI Agent"
          onAction={() => setScreenState("data")}
        />
      )}

      {screenState === "error" && (
        <ErrorState
          code="WIP_LIMIT_EXCEEDED"
          message="Cột Đang làm hiện vượt quá giới hạn WIP cho phép (4/3). Vui lòng chuyển bớt việc sang Review hoặc điều chỉnh tải nhân sự."
          onRetry={() => setScreenState("data")}
        />
      )}

      {screenState === "data" && (
        <DndContext
          id="kanban-board"
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {/* Kanban Columns Grid */}
          <ScrollArea className="w-full pb-4">
            <div className="grid grid-cols-4 gap-4 items-start min-w-[1080px]">
            {COLUMNS.map((col) => {
              const colTasks = getColumnTasks(col.id);
              const isOverWip = col.wipLimit !== undefined && colTasks.length > col.wipLimit;

              return (
                <div
                  key={col.id}
                  className={cn(
                    "flex flex-col rounded-xl border bg-muted/25 transition-all p-3 min-h-[550px]",
                    // Viền warning khi cột Đang làm vượt WIP 4/3
                    isOverWip
                      ? "border-warning ring-1 ring-warning/40 bg-warning/5"
                      : "border-border/70"
                  )}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">
                        {col.title}
                      </h3>
                      {col.wipLimit ? (
                        <Badge
                          variant={isOverWip ? "warning" : "secondary"}
                          className="font-mono text-xs tabular-nums px-1.5 py-0"
                          title={isOverWip ? "Vượt giới hạn việc đang làm!" : "Giới hạn WIP"}
                        >
                          {colTasks.length}/{col.wipLimit}
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="font-mono text-xs tabular-nums px-1.5 py-0"
                        >
                          {colTasks.length}
                        </Badge>
                      )}
                    </div>

                    {isOverWip && (
                      <div className="flex items-center gap-1 text-[11px] font-medium text-warning-foreground" title="Đang vượt WIP limit">
                        <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                        <span className="hidden xl:inline">Vượt WIP</span>
                      </div>
                    )}
                  </div>

                  {/* Task List Sortable Container */}
                  <SortableContext
                    id={col.id}
                    items={colTasks.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="flex flex-col gap-2.5 flex-1 min-h-[100px]">
                      {colTasks.map((task) => (
                        <div key={task.id} className="group relative">
                          <SortableTaskItem
                            task={task}
                            onClick={handleCardClick}
                          />

                          {/* Quick Dropdown Actions (Hỗ trợ bàn phím / truy cập theo doc-10) */}
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 rounded bg-background/90 shadow-xs hover:bg-muted"
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label="Tùy chọn thẻ"
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 text-xs">
                                <DropdownMenuLabel>Chuyển sang cột:</DropdownMenuLabel>
                                {COLUMNS.filter((c) => c.id !== task.status).map((c) => (
                                  <DropdownMenuItem
                                    key={c.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      moveTaskToStatus(task.id, c.id);
                                    }}
                                  >
                                    Cột: {c.title}
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCardClick(task);
                                  }}
                                >
                                  Xem chi tiết (Sheet)
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}

                      {colTasks.length === 0 && (
                        <div className="flex flex-1 items-center justify-center p-6 border border-dashed border-border/60 rounded-lg text-xs text-muted-foreground">
                          Kéo thẻ vào đây
                        </div>
                      )}
                    </div>
                  </SortableContext>
                </div>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

          {/* Drag Overlay (Ghost Card while dragging) */}
          <DragOverlay>
            {activeTask ? (
              <TaskCard task={activeTask} isGhost={true} />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Task Detail Sheet (Screen 6) */}
      <TaskDetailSheet
        task={selectedTask}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdateTask={(updated) => {
          setTasks((prev) =>
            prev.map((t) => (t.id === updated.id ? updated : t))
          );
        }}
      />

      {/* Mockup 4-State Toggle Floating Pill */}
      <StateToggle state={screenState} onChange={setScreenState} />
    </div>
  );
}
