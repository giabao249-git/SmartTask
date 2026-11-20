"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AtSign,
  ChevronDown,
  Clock,
  Download,
  FileText,
  Flame,
  History,
  Layers,
  ListChecks,
  Loader2,
  Maximize2,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { ActivityList } from "@/features/activity/ActivityList";
import { useTasks } from "@/features/board/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorState } from "@/components/app/ErrorState";
import { UserAvatar } from "@/components/app/UserAvatar";
import { PriorityBadge } from "@/components/app/PriorityBadge";
import { api, describeError, isApiError } from "@/lib/api";

import type { ProjectDetail, TaskDetail, TaskListItem, TaskPriority } from "@/lib/types";
import { sprintStatusLabel } from "@/lib/status";
import { useSprints } from "@/lib/hooks/queries";
import { TaskTypeBadge } from "./TaskTypeBadge";
import { DerivedBugs, OriginPicker, ReviewCard, WorklogPanel } from "./TaskWorklog";
import { AssigneePicker, LabelPicker, SkillPicker } from "./TaskFieldPickers";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  downloadAttachment,
  useAttachments,
  useCommentMutations,
  useComments,
  useDeleteAttachment,
  useSuggestMembers,
  useTask,
  useTaskMutations,
  useUploadAttachment,
} from "@/features/board/hooks";
import { fmtDay, taskKeyOf } from "./TaskCard";

export interface TaskDetailModalProps {
  taskId: string | null;
  project: ProjectDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Bấm nút phóng to trong modal — nơi gọi tự điều hướng sang trang riêng. */
  onOpenFullPage?: () => void;
}

/**
 * Chi tiết task từ GET /tasks/:id — sửa trường qua PATCH có version (409 → toast + tải lại),
 * subtask, bình luận @mention, đính kèm.
 *
 * Mở dạng modal giữa màn: bố cục hai cột rộng rãi trên màn vừa/lớn (md+), tự động xếp gọn
 * và cuộn mượt trên màn nhỏ.
 */
export function TaskDetailModal({ taskId, project, open, onOpenChange, onOpenFullPage }: TaskDetailModalProps) {
  const q = useTask(open ? taskId : null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:w-[calc(100vw-2.5rem)] sm:max-w-4xl lg:max-w-5xl p-0 flex flex-col max-h-[92vh] sm:max-h-[88vh] rounded-xl overflow-hidden gap-0 shadow-2xl border-border/80">
        {q.isPending || !taskId ? (
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-20 rounded-md" />
              <Skeleton className="h-6 w-24 rounded-md" />
            </div>
            <Skeleton className="h-9 w-3/4 rounded-lg" />
            <div className="grid grid-cols-1 md:grid-cols-[1fr_18rem] gap-6 pt-2">
              <div className="space-y-4">
                <Skeleton className="h-28 w-full rounded-lg" />
                <Skeleton className="h-40 w-full rounded-lg" />
              </div>
              <div className="space-y-3">
                <Skeleton className="h-36 w-full rounded-lg" />
                <Skeleton className="h-36 w-full rounded-lg" />
              </div>
            </div>
          </div>
        ) : q.isError ? (
          <div className="p-6">
            <ErrorState code={describeError(q.error).code} message={describeError(q.error).message} onRetry={() => q.refetch()} />
          </div>
        ) : (
          <TaskDetailBody task={q.data} project={project} onRefresh={() => q.refetch()} onOpenFullPage={onOpenFullPage} />
        )}
      </DialogContent>
    </Dialog>
  );
}

type Variant = "modal" | "page" | "panel";
const HeaderWrap = ({ variant, children }: { variant: Variant; children: React.ReactNode }) =>
  variant === "modal" ? (
    <DialogHeader className="px-4 sm:px-6 pt-3.5 pb-3 border-b border-border/60 bg-muted/15 space-y-2 shrink-0 text-left">{children}</DialogHeader>
  ) : (
    <div className="px-4 sm:px-6 pt-3.5 pb-3 border-b border-border/60 bg-muted/15 space-y-2 shrink-0 text-left">{children}</div>
  );
const TitleWrap = ({ variant, children }: { variant: Variant; children: React.ReactNode }) =>
  variant === "modal" ? <DialogTitle className="text-left">{children}</DialogTitle> : <h1 className="text-left">{children}</h1>;
const DescWrap = ({ variant, children }: { variant: Variant; children: React.ReactNode }) =>
  variant === "modal" ? (
    <DialogDescription asChild>
      <div className="text-left text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">{children}</div>
    </DialogDescription>
  ) : (
    <div className="text-left text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">{children}</div>
  );

/**
 * Thân màn chi tiết — dùng chung cho CẢ modal (bấm thẻ trên bảng), side panel đè cạnh phải
 * và trang riêng /projects/:id/tasks/ST-n. Một nguồn sự thật, ba khung chứa: `variant` đổi phần
 * tiêu đề và responsive layout.
 */
export function TaskDetailBody({
  task,
  project,
  onRefresh,
  variant = "modal",
  onOpenFullPage,
  onClose,
}: {
  task: TaskDetail;
  project: ProjectDetail;
  onRefresh: () => void;
  variant?: Variant;
  onOpenFullPage?: () => void;
  onClose?: () => void;
}) {
  const qc = useQueryClient();
  const m = useTaskMutations(project.id);
  const sprints = useSprints(project.id);
  const [title, setTitle] = React.useState(task.title);
  const [description, setDescription] = React.useState(task.description ?? "");
  const [estimateDraft, setEstimateDraft] = React.useState(task.estimateHours == null ? "" : String(task.estimateHours));
  const [aiSubtasks, setAiSubtasks] = React.useState<
    Array<{ title: string; estimateHours?: number; selected: boolean }>
  >([]);
  const [decomposingSubtasks, setDecomposingSubtasks] = React.useState(false);
  const [applyingSubtasks, setApplyingSubtasks] = React.useState(false);

  React.useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? "");
    setEstimateDraft(task.estimateHours == null ? "" : String(task.estimateHours));
    setAiSubtasks([]);
  }, [task.id, task.version, task.title, task.description, task.estimateHours]);

  const handleDecomposeSubtasks = async () => {
    setDecomposingSubtasks(true);
    try {
      const res = await api.post<{
        subtasks: Array<{ title: string; estimateHours?: number }>;
      }>(`/tasks/${task.id}/ai/decompose-subtasks`);

      if (res?.subtasks && res.subtasks.length > 0) {
        setAiSubtasks(
          res.subtasks.map((s) => ({
            title: s.title,
            estimateHours: s.estimateHours,
            selected: true,
          }))
        );
        toast.success(`AI đã gợi ý ${res.subtasks.length} việc con!`);
      } else {
        toast.info("Không có việc con nào được đề xuất.");
      }
    } catch (err) {
      toast.error(describeError(err).message);
    } finally {
      setDecomposingSubtasks(false);
    }
  };

  const handleApplyAiSubtasks = async () => {
    const selected = aiSubtasks.filter((s) => s.selected);
    if (selected.length === 0) return;
    setApplyingSubtasks(true);
    try {
      await api.post(`/tasks/${task.id}/subtasks/batch`, {
        subtasks: selected.map((s) => ({
          title: s.title,
          estimateHours: s.estimateHours,
        })),
      });
      toast.success(`Đã thêm thành công ${selected.length} việc con!`);
      setAiSubtasks([]);
      void qc.invalidateQueries({ queryKey: ["tasks", task.id] });
      void qc.invalidateQueries({ queryKey: ["projects", project.id] });
      onRefresh();
    } catch (err) {
      toast.error(describeError(err).message);
    } finally {
      setApplyingSubtasks(false);
    }
  };


  const fail = (e: unknown, what: string) => {
    const { code, message } = describeError(e);
    if (code === "TASK_VERSION_CONFLICT") {
      toast.error("Công việc vừa được người khác cập nhật — đã tải lại bản mới", { description: "409 TASK_VERSION_CONFLICT" });
      onRefresh();
      return;
    }
    if (code === "DEPENDENCY_CYCLE") {
      toast.error("Phụ thuộc tạo thành vòng — bỏ chọn task đang chờ task này", { description: "422 DEPENDENCY_CYCLE" });
      return;
    }
    if (code === "UNCOMPLETED_SUBTASKS") {
      const details = isApiError(e) ? e.detail<{ uncompletedCount?: number }>() : undefined;
      const count = details?.uncompletedCount;
      toast.error(
        `Không thể hoàn thành: còn ${count ? `${count} ` : ""}việc con chưa xong!`,
        { description: "Hãy hoàn thành tất cả việc con trước khi chuyển công việc chính sang hoàn thành." },
      );
      return;
    }
    toast.error(`${what} thất bại`, { description: `${code}: ${message}` });
  };

  /**
   * Chỉ khoá ĐÚNG trường đang ghi, không khoá cả màn (docs 02/05 §C4).
   * Các lời gọi được nối vào một hàng đợi tuần tự phía client, mỗi lời lấy version mới nhất.
   */
  const versionRef = React.useRef(task.version);
  React.useEffect(() => {
    versionRef.current = task.version;
  }, [task.version]);
  const queueRef = React.useRef<Promise<unknown>>(Promise.resolve());
  const [pendingFields, setPendingFields] = React.useState<string[]>([]);
  const isSaving = (field: string) => pendingFields.includes(field);

  const enqueue = (field: string, what: string, run: (version: number) => Promise<TaskDetail>) => {
    setPendingFields((p) => [...p, field]);
    queueRef.current = queueRef.current
      .catch(() => undefined)
      .then(() => run(versionRef.current))
      .then((updated) => {
        versionRef.current = updated.version;
        toast.success(`${what} xong`);
      })
      .catch((e) => fail(e, what))
      .finally(() =>
        setPendingFields((p) => {
          const i = p.indexOf(field);
          return i < 0 ? p : [...p.slice(0, i), ...p.slice(i + 1)];
        }),
      );
  };

  const patch = (fields: Record<string, unknown>, what = "Cập nhật", field = Object.keys(fields)[0]) =>
    enqueue(field, what, (version) => m.update.mutateAsync({ id: task.id, version, patch: fields }));

  const doneColumn = project.columns.find((c) => c.isDone);
  const doneSubtasks = task.subtasks.filter((s) => !!s.completedAt).length;
  const todayIso = new Date().toISOString().slice(0, 10);
  const isOverdue = !!task.dueDate && !task.completedAt && task.dueDate.slice(0, 10) < todayIso;

  return (
    <>
      <HeaderWrap variant={variant}>
        {/* pr-8 chừa chỗ cho nút đóng của Dialog (absolute right-4) khỏi đè lên cụm hành động */}
        <div className={cn("flex items-center gap-1.5 sm:gap-2 flex-wrap", variant === "modal" && "pr-8")}>
          <Badge variant="outline" className="font-mono text-xs font-semibold bg-primary/10 text-primary border-primary/25 px-2 py-0.5">
            {taskKeyOf(project.key, task)}
          </Badge>
          <TaskTypeBadge type={task.type} />
          {task.source === "AI" && (
            <Badge variant="info" className="gap-1 text-[10px] px-1.5 py-0">
              <Sparkles className="h-2.5 w-2.5" /> AI
            </Badge>
          )}
          <Badge variant="secondary" className="text-[11px] font-medium">
            {task.column.name}
          </Badge>
          {task.sprint && (
            <Badge variant="outline" className="text-[10px] hidden sm:inline-flex">
              {task.sprint.name}
            </Badge>
          )}
          {isOverdue && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              Quá hạn
            </Badge>
          )}

          <div className="ml-auto flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.5 rounded">
              v{task.version}
            </span>
            {(variant === "modal" || variant === "panel") && onOpenFullPage && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-foreground"
                aria-label="Mở toàn màn hình"
                title="Mở toàn màn hình (Ctrl+click mã công việc để mở tab mới)"
                onClick={onOpenFullPage}
              >
                <Maximize2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Mở rộng</span>
              </Button>
            )}
            {project.canManage && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                disabled={m.remove.isPending}
                title="Xoá công việc"
                onClick={() =>
                  m.remove.mutate(task.id, {
                    onSuccess: () => {
                      toast.success(`Đã xoá ${taskKeyOf(project.key, task)}`);
                      onClose?.();
                    },
                    onError: (e) => fail(e, "Xoá"),
                  })
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Xoá công việc</span>
              </Button>
            )}
            {variant === "panel" && onClose && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted ml-0.5"
                aria-label="Đóng panel (Esc)"
                title="Đóng panel (Esc)"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onClose();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <TitleWrap variant={variant}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title.trim() !== task.title && patch({ title: title.trim() }, "Đổi tiêu đề")}
            disabled={!project.canEdit || isSaving("title")}
            className="text-base sm:text-lg font-semibold tracking-tight h-10 border-transparent bg-transparent hover:bg-muted/60 focus-visible:bg-background focus-visible:border-border px-2 -mx-2 rounded-lg transition-colors"
          />
        </TitleWrap>

        <DescWrap variant={variant}>
          <UserAvatar
            name={task.createdBy.shortName ?? task.createdBy.fullName}
            avatar={task.createdBy.avatarUrl ?? undefined}
            size="sm"
            showTooltip={false}
            className="h-4 w-4 text-[8px]"
          />
          <span>
            Tạo bởi <strong className="font-medium text-foreground/80">{task.createdBy.shortName ?? task.createdBy.fullName}</strong> · {fmtDay(task.createdAt)} · sửa lần cuối {fmtDay(task.updatedAt)}
          </span>
        </DescWrap>
      </HeaderWrap>

      {/* Thân cuộn dọc đơn luồng chuẩn Jira/Linear: Thoáng đãng, không co cụm, tối ưu cho Panel lẫn Modal */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
        {/* KHỐI 1: Thuộc tính công việc gọn gàng (Quick Properties) */}
        <div className="rounded-xl border border-border/70 bg-card/70 p-3 sm:p-4 shadow-2xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Trạng thái */}
            <PropRow label="Trạng thái" saving={isSaving("column")}>
              <Select
                value={task.columnId}
                disabled={!project.canEdit || isSaving("column")}
                onValueChange={(columnId) => {
                  const targetCol = project.columns.find((c) => c.id === columnId);
                  const uncompletedCount = task.subtasks.filter((s) => !s.completedAt).length;
                  if (targetCol?.isDone && uncompletedCount > 0) {
                    toast.error(
                      `Không thể hoàn thành: còn ${uncompletedCount} việc con chưa xong!`,
                      { description: "Hãy đánh dấu hoàn thành tất cả việc con trước khi hoàn thành công việc chính." },
                    );
                    return;
                  }
                  enqueue("column", "Chuyển cột", (version) => m.move.mutateAsync({ id: task.id, version, columnId }));
                }}
              >
                <SelectTrigger className="h-8 text-xs bg-background/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {project.columns.map((c) => {
                    const uncompletedCount = task.subtasks.filter((s) => !s.completedAt).length;
                    const isBlocked = c.isDone && uncompletedCount > 0;
                    return (
                      <SelectItem
                        key={c.id}
                        value={c.id}
                        disabled={isBlocked}
                        className="text-xs"
                      >
                        <div className="flex items-center justify-between w-full gap-2">
                          <span>{c.name} {c.wipLimit ? ` (WIP ${c.wipLimit})` : ""}</span>
                          {isBlocked && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">
                              (còn {uncompletedCount} việc con)
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </PropRow>

            {/* Người làm */}
            <PropRow label="Người làm" saving={isSaving("assignees")}>
              <AssigneePicker
                value={task.assignees.map((a) => a.id)}
                members={project.members}
                disabled={!project.canEdit || isSaving("assignees")}
                onChange={(userIds) =>
                  enqueue("assignees", "Đổi người thực hiện", (version) =>
                    m.assignees.mutateAsync({ id: task.id, version, userIds })
                  )
                }
              />
            </PropRow>

            {/* Sprint */}
            <PropRow label="Sprint" saving={isSaving("sprintId")}>
              <Select
                value={task.sprintId ?? "__backlog"}
                disabled={!project.canEdit || isSaving("sprintId")}
                onValueChange={(v) => patch({ sprintId: v === "__backlog" ? null : v }, "Đổi sprint")}
              >
                <SelectTrigger className="h-8 text-xs bg-background/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__backlog" className="text-xs">
                    Backlog
                  </SelectItem>
                  {(sprints.data ?? [])
                    .filter((s) => s.status !== "CLOSED")
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        {s.name} · {sprintStatusLabel(s.status)}
                      </SelectItem>
                    ))}
                  {task.sprint &&
                    !(sprints.data ?? []).some((s) => s.id === task.sprint?.id && s.status !== "CLOSED") && (
                      <SelectItem value={task.sprint.id} className="text-xs">
                        {task.sprint.name}
                      </SelectItem>
                    )}
                </SelectContent>
              </Select>
            </PropRow>

            {/* Ưu tiên & Gấp */}
            <PropRow label="Ưu tiên" saving={isSaving("priority") || isSaving("isUrgent")}>
              <div className="flex items-center gap-1.5">
                <Select
                  value={task.priority}
                  disabled={!project.canEdit || isSaving("priority")}
                  onValueChange={(priority) => patch({ priority: priority as TaskPriority }, "Đổi ưu tiên")}
                >
                  <SelectTrigger className="h-8 text-xs flex-1 min-w-0 bg-background/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((p) => (
                      <SelectItem key={p} value={p} className="text-xs">
                        <PriorityBadge priority={p} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  disabled={!project.canEdit || isSaving("isUrgent")}
                  onClick={() => patch({ isUrgent: !task.isUrgent }, "Đổi cờ khẩn")}
                  title="Cờ khẩn (gấp về thời gian) — xếp vào ô Làm ngay của ma trận Eisenhower"
                  className={cn(
                    "h-8 px-2 rounded-md border text-[11px] font-medium inline-flex items-center gap-1 shrink-0 transition-colors",
                    task.isUrgent
                      ? "bg-destructive/15 border-destructive/50 text-destructive"
                      : "bg-background/80 border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Flame className={cn("h-3.5 w-3.5", task.isUrgent && "fill-current")} />
                  Gấp
                </button>
              </div>
            </PropRow>

            {/* Hạn chót */}
            <PropRow label="Hạn chót" saving={isSaving("dueDate")}>
              <Input
                type="date"
                value={task.dueDate ? task.dueDate.slice(0, 10) : ""}
                disabled={!project.canEdit || isSaving("dueDate")}
                onChange={(e) => {
                  const next = e.target.value || null;
                  if (next !== (task.dueDate ? task.dueDate.slice(0, 10) : null)) patch({ dueDate: next }, "Đổi hạn chót");
                }}
                className={cn("h-8 text-xs bg-background/80 px-2", isOverdue && "border-destructive/60 text-destructive font-medium")}
              />
            </PropRow>

            {/* Nhãn */}
            <PropRow label="Nhãn" saving={isSaving("labels")}>
              <LabelPicker
                value={task.labels.map((l) => l.id)}
                labels={project.labels}
                disabled={!project.canEdit || isSaving("labels")}
                onChange={(labelIds) =>
                  enqueue("labels", "Đổi nhãn", (version) => m.labels.mutateAsync({ id: task.id, version, labelIds }))
                }
              />
            </PropRow>
          </div>

          {/* Dòng bổ trợ: Ngày bắt đầu & Giờ ước lượng */}
          {(task.startDate || task.estimateHours != null || project.canEdit) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
              <PropRow label="Bắt đầu" saving={isSaving("startDate")}>
                <Input
                  type="date"
                  value={task.startDate ? task.startDate.slice(0, 10) : ""}
                  disabled={!project.canEdit || isSaving("startDate")}
                  onChange={(e) => {
                    const next = e.target.value || null;
                    if (next !== (task.startDate ? task.startDate.slice(0, 10) : null)) patch({ startDate: next }, "Đổi ngày bắt đầu");
                  }}
                  className="h-8 text-xs bg-background/80 px-2"
                />
              </PropRow>

              <PropRow label="Ước lượng" saving={isSaving("estimateHours")}>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.5"
                    min={0}
                    placeholder="—"
                    value={estimateDraft}
                    disabled={!project.canEdit || isSaving("estimateHours")}
                    onChange={(e) => setEstimateDraft(e.target.value)}
                    onBlur={() => {
                      const n = estimateDraft === "" ? null : Number(estimateDraft);
                      if (n !== task.estimateHours) patch({ estimateHours: n }, "Đổi ước lượng");
                    }}
                    className="h-8 text-xs font-mono pr-6 bg-background/80"
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono">
                    h
                  </span>
                </div>
              </PropRow>
            </div>
          )}

          {/* Nếu là Bug sinh từ task khác */}
          {task.type === "BUG" && (
            <div className="pt-2 border-t border-border/40">
              <PropRow label="Sinh từ việc" saving={isSaving("originTaskId")}>
                <OriginPicker
                  task={task}
                  project={project}
                  disabled={!project.canEdit || isSaving("originTaskId")}
                  onChange={(id) => patch({ originTaskId: id }, "Gắn việc gốc")}
                />
              </PropRow>
            </div>
          )}

          {/* Kỹ năng & Phụ thuộc dạng Collapsible tinh gọn */}
          <Collapsible>
            <div className="flex items-center justify-between pt-1 border-t border-border/40">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground gap-1 -ml-1"
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>Kỹ năng & Phụ thuộc</span>
                  {(task.requiredSkills.length > 0 || task.dependsOnIds.length > 0) && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 font-mono h-4 ml-1">
                      {task.requiredSkills.length + task.dependsOnIds.length}
                    </Badge>
                  )}
                  <ChevronDown className="h-3 w-3 ml-0.5" />
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="space-y-2.5 pt-2">
              <PropRow label="Kỹ năng" saving={isSaving("skills")}>
                <SkillPicker
                  value={task.requiredSkills.map((s) => ({ skillId: s.id, minLevel: s.minLevel }))}
                  workspaceId={project.workspaceId}
                  disabled={!project.canEdit || isSaving("skills")}
                  onChange={(skills) =>
                    enqueue("skills", "Đổi kỹ năng", (version) => m.skills.mutateAsync({ id: task.id, version, skills }))
                  }
                />
              </PropRow>
              <PropRow label="Phụ thuộc" saving={isSaving("dependencies")}>
                <DependencyPicker
                  taskId={task.id}
                  value={task.dependsOnIds}
                  projectId={project.id}
                  projectKey={project.key}
                  disabled={!project.canEdit || isSaving("dependencies")}
                  onChange={(dependsOnIds) =>
                    enqueue("dependencies", "Đổi phụ thuộc", (version) =>
                      m.dependencies.mutateAsync({ id: task.id, version, dependsOnIds }),
                    )
                  }
                />
              </PropRow>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* KHỐI 2: Mô tả công việc (Rộng rãi, dễ đọc/viết) */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              Mô tả công việc
              {isSaving("description") && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </label>
          </div>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => description !== (task.description ?? "") && patch({ description: description || null }, "Sửa mô tả")}
            disabled={!project.canEdit || isSaving("description")}
            className="text-xs sm:text-[13px] leading-relaxed min-h-[96px] sm:min-h-[110px] bg-muted/20 hover:bg-muted/30 focus-visible:bg-background rounded-lg p-3 resize-y transition-colors w-full"
            placeholder="Mô tả chi tiết công việc (hỗ trợ markdown nhẹ)…"
          />
        </div>

        <ReviewCard task={task} project={project} />
        <DerivedBugs task={task} projectId={project.id} />

        {/* KHỐI 3: Danh sách việc con (Subtasks) với thanh tiến độ thực tế */}
        <div className="space-y-3 pt-3 border-t border-border/60">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">Danh sách việc con</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono h-4">
                {task.subtasks.length}
              </Badge>
            </div>
            {project.canEdit && !task.parentId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={decomposingSubtasks}
                onClick={handleDecomposeSubtasks}
                className="h-7 text-xs gap-1.5 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 shadow-xs"
              >
                {decomposingSubtasks ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                )}
                <span>AI Bẻ việc con</span>
              </Button>
            )}
          </div>

          {/* Khối gợi ý xem trước của AI */}
          {aiSubtasks.length > 0 && (
            <div className="p-3 rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-950 dark:text-indigo-200">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Gợi ý ({aiSubtasks.filter((s) => s.selected).length}/{aiSubtasks.length} việc con):</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={() => setAiSubtasks([])}
                >
                  Hủy bỏ
                </Button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {aiSubtasks.map((s, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded border text-xs transition-colors",
                      s.selected
                        ? "bg-background/90 border-indigo-200/80 dark:border-indigo-900/60 shadow-xs"
                        : "bg-muted/30 border-border/40 opacity-60",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={s.selected}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setAiSubtasks((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, selected: checked } : item)),
                        );
                      }}
                      className="rounded border-border text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                    />
                    <input
                      type="text"
                      value={s.title}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAiSubtasks((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, title: val } : item)),
                        );
                      }}
                      className="flex-1 bg-transparent border-0 p-0 text-xs font-medium focus:outline-none focus:ring-0 text-foreground"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={s.estimateHours ?? ""}
                        placeholder="0"
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setAiSubtasks((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, estimateHours: isNaN(val) ? undefined : val } : item,
                            ),
                          );
                        }}
                        className="w-12 text-right bg-muted/60 rounded px-1 py-0.5 text-xs font-mono border border-border/40 focus:outline-none"
                      />
                      <span className="text-[11px] text-muted-foreground">h</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  size="sm"
                  disabled={applyingSubtasks || aiSubtasks.filter((s) => s.selected).length === 0}
                  onClick={handleApplyAiSubtasks}
                  className="h-7 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm"
                >
                  {applyingSubtasks ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Zap className="h-3.5 w-3.5" />
                  )}
                  Thêm {aiSubtasks.filter((s) => s.selected).length} việc con này
                </Button>
              </div>
            </div>
          )}

          {/* Thanh tiến độ thực tế dựa trên tỷ lệ việc con hoàn thành */}
          {task.subtasks.length > 0 && (
            <div className="p-2.5 rounded-lg border border-border/60 bg-muted/30 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground font-medium">Tiến độ thực tế</span>
                <span className="font-mono font-semibold text-foreground">
                  {doneSubtasks}/{task.subtasks.length} việc con ({Math.round((doneSubtasks / task.subtasks.length) * 100)}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all rounded-full"
                  style={{ width: `${Math.round((doneSubtasks / task.subtasks.length) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {task.subtasks.length === 0 && !project.canEdit && (
            <p className="text-[11px] text-muted-foreground py-1">Chưa có việc con nào.</p>
          )}

          <div className="space-y-1.5">
            {task.subtasks.map((s) => (
              <div
                key={s.id}
                className="group flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border/60 bg-card hover:border-border transition-colors"
              >
                <Checkbox
                  checked={!!s.completedAt}
                  disabled={!project.canEdit || !doneColumn || m.move.isPending}
                  onCheckedChange={(checked) =>
                    m.move.mutate(
                      { id: s.id, version: s.version, columnId: checked ? doneColumn!.id : project.columns[0].id },
                      {
                        onSuccess: () => {
                          onRefresh();
                          void qc.invalidateQueries({ queryKey: ["projects", project.id] });
                        },
                        onError: (e) => fail(e, "Đổi trạng thái việc con"),
                      },
                    )
                  }
                />
                <span className="font-mono text-[11px] text-muted-foreground shrink-0">{taskKeyOf(project.key, s)}</span>
                <span className={cn("flex-1 text-xs min-w-0 truncate font-medium", s.completedAt && "line-through text-muted-foreground font-normal")}>
                  {s.title}
                </span>
                {s.estimateHours != null && (
                  <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 shrink-0">
                    {s.estimateHours}h
                  </Badge>
                )}
                {project.canEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    title="Xóa việc con này"
                    onClick={() =>
                      m.remove.mutate(s.id, {
                        onSuccess: () => {
                          toast.success(`Đã xoá ${taskKeyOf(project.key, s)}`);
                          onRefresh();
                          void qc.invalidateQueries({ queryKey: ["projects", project.id] });
                        },
                        onError: (e) => fail(e, "Xoá việc con"),
                      })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {project.canEdit && (
            <form
              className="flex items-center gap-2 pt-1"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const t = String(f.get("title") ?? "").trim();
                if (!t) return;
                const form = e.currentTarget;
                m.subtask.mutate(
                  { parentId: task.id, title: t, estimateHours: Number(f.get("hours")) || undefined },
                  {
                    onSuccess: () => {
                      form.reset();
                      onRefresh();
                      void qc.invalidateQueries({ queryKey: ["projects", project.id] });
                    },
                    onError: (err) => fail(err, "Thêm việc con"),
                  },
                );
              }}
            >
              <Input name="title" placeholder="Thêm việc con nhanh…" className="h-8 text-xs flex-1" required />
              <Input name="hours" type="number" step="0.5" min={0} placeholder="giờ" className="h-8 text-xs w-16" />
              <Button type="submit" size="sm" className="h-8 text-xs gap-1 shrink-0" disabled={m.subtask.isPending}>
                <Plus className="h-3.5 w-3.5" />
                <span>Thêm</span>
              </Button>
            </form>
          )}
        </div>

        {/* KHỐI 4: Bình luận & Thảo luận (Hiển thị trực tiếp, không giấu lắt léo) */}
        <div className="space-y-3 pt-3 border-t border-border/60">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span>Bình luận & Thảo luận</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono h-4">
              {task.commentCount}
            </Badge>
          </div>
          <CommentsPanel taskId={task.id} project={project} />
        </div>

        {/* KHỐI 5: Tệp đính kèm, Giờ làm & Hoạt động (Tabs phụ cuối trang) */}
        <div className="pt-3 border-t border-border/60">
          <Tabs defaultValue="files" className="space-y-3">
            <TabsList className="h-8 p-1 bg-muted/60 rounded-lg gap-0.5 justify-start">
              <TabsTrigger value="files" className="text-xs h-6 px-2.5 gap-1.5">
                <Paperclip className="h-3.5 w-3.5" />
                <span>Đính kèm</span>
                <Badge variant="secondary" className="text-[10px] px-1 py-0 font-mono h-3.5">
                  {task.attachmentCount}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="worklog" className="text-xs h-6 px-2.5 gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>Giờ làm</span>
              </TabsTrigger>
              <TabsTrigger value="activity" className="text-xs h-6 px-2.5 gap-1.5">
                <History className="h-3.5 w-3.5" />
                <span>Hoạt động</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="files" className="mt-0">
              <AttachmentsPanel taskId={task.id} canEdit={project.canEdit} />
            </TabsContent>
            <TabsContent value="worklog" className="mt-0">
              <WorklogPanel task={task} project={project} />
            </TabsContent>
            <TabsContent value="activity" className="mt-0">
              <ActivityList projectId={project.id} taskId={task.id} compact />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}

/** Một dòng thuộc tính ngang: nhãn bên trái, control bên phải. */
function PropRow({ label, saving, children }: { label: string; saving?: boolean; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2">
      <label className="text-[11px] font-medium text-muted-foreground inline-flex items-center gap-1 truncate">
        {label}
        {saving && <Loader2 className="h-3 w-3 animate-spin shrink-0" />}
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Parse và hiển thị định dạng Markdown cơ bản (in đậm, in nghiêng, code, @mention) trong bình luận */
function renderCommentBody(text: string): React.ReactNode {
  if (!text) return null;
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|@[a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]+(?:\s*\([^)]+\))?)/gu;
  const parts: React.ReactNode[] = [];
  let cur = 0;
  let keyCounter = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > cur) {
      parts.push(text.slice(cur, match.index));
    }
    const token = match[0];
    if (token.startsWith("`") && token.endsWith("`") && token.length >= 2) {
      parts.push(
        <code key={`c-${keyCounter++}`} className="bg-muted px-1 py-0.5 rounded text-[11px] font-mono text-foreground">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("**") && token.endsWith("**") && token.length >= 4) {
      parts.push(
        <strong key={`b-${keyCounter++}`} className="font-bold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("*") && token.endsWith("*") && token.length >= 2) {
      parts.push(
        <em key={`i-${keyCounter++}`} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith("@")) {
      parts.push(
        <span key={`m-${keyCounter++}`} className="font-semibold text-primary">
          {token}
        </span>
      );
    } else {
      parts.push(token);
    }
    cur = re.lastIndex;
  }
  if (cur < text.length) {
    parts.push(text.slice(cur));
  }
  return parts;
}

/** Bình luận + @mention: gõ "@" → gợi ý từ GET /projects/:id/members/suggest (docs 05 §6 — người chọn tường minh). */
function CommentsPanel({ taskId, project }: { taskId: string; project: ProjectDetail }) {
  const comments = useComments(taskId);
  const mut = useCommentMutations(taskId);
  const [body, setBody] = React.useState("");
  const [mentions, setMentions] = React.useState<{ id: string; name: string }[]>([]);
  const at = /(?:^|\s)@([^\s@]*)$/.exec(body);
  const suggest = useSuggestMembers(project.id, at ? at[1] : "");
  const pick = (u: { id: string; fullName: string; shortName: string | null }) => {
    setBody((b) => b.replace(/@[^\s@]*$/, `@${u.shortName ?? u.fullName} `));
    setMentions((m) => (m.some((x) => x.id === u.id) ? m : [...m, { id: u.id, name: u.shortName ?? u.fullName }]));
  };
  return (
    <div className="space-y-3">
      {comments.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : comments.isError ? (
        <ErrorState code={describeError(comments.error).code} message={describeError(comments.error).message} onRetry={() => comments.refetch()} />
      ) : comments.data.length === 0 ? (
        <p className="text-[11px] text-muted-foreground py-2">Chưa có bình luận.</p>
      ) : (
        <div className="space-y-2">
          {comments.data.map((c) => (
            <div key={c.id} className="flex gap-2.5 p-2.5 rounded-lg border border-border/60 bg-card">
              <UserAvatar name={c.author.shortName ?? c.author.fullName} avatar={c.author.avatarUrl ?? undefined} size="sm" showTooltip={false} />
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                  <span className="font-semibold text-xs text-foreground">{c.author.fullName}</span>
                  <span>{fmtDay(c.createdAt)}</span>
                  {c.mentions.length > 0 && <span>· nhắc {c.mentions.map((u) => u.shortName ?? u.fullName).join(", ")}</span>}
                  {project.canManage && (
                    <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto text-muted-foreground hover:text-destructive" onClick={() => mut.remove.mutate(c.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <p className="text-xs whitespace-pre-wrap leading-relaxed">{renderCommentBody(c.body)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {project.canEdit && (
        <div className="space-y-2 relative">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Viết bình luận… gõ @ để nhắc thành viên"
            className="text-xs min-h-[68px] rounded-lg bg-muted/20 focus-visible:bg-background"
          />
          {at && suggest.data && suggest.data.length > 0 && (
            <div className="absolute left-0 right-0 z-10 rounded-lg border border-border bg-popover shadow-lg p-1 text-xs">
              {suggest.data.map((u) => (
                <Button key={u.id} variant="ghost" size="sm" onClick={() => pick(u)} className="w-full justify-start h-7 gap-2 text-xs">
                  <AtSign className="h-3 w-3 text-info" /> {u.fullName}
                  {u.email && <span className="text-muted-foreground">{u.email}</span>}
                </Button>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 flex-wrap">
              {mentions.map((u) => (
                <Badge key={u.id} variant="info" className="text-[10px] gap-1">
                  @{u.name}
                </Badge>
              ))}
            </div>
            <Button
              size="sm"
              className="h-7 px-3 text-xs"
              disabled={!body.trim() || mut.create.isPending}
              onClick={() =>
                mut.create.mutate(
                  { body: body.trim(), mentionUserIds: mentions.map((u) => u.id) },
                  {
                    onSuccess: () => {
                      setBody("");
                      setMentions([]);
                    },
                    onError: (e) => toast.error(describeError(e).message),
                  },
                )
              }
            >
              Gửi
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AttachmentsPanel({ taskId, canEdit }: { taskId: string; canEdit: boolean }) {
  const list = useAttachments(taskId);
  const upload = useUploadAttachment(taskId);
  const del = useDeleteAttachment(taskId);
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      {list.isPending ? (
        <Skeleton className="h-12 w-full" />
      ) : list.isError ? (
        <ErrorState code={describeError(list.error).code} message={describeError(list.error).message} onRetry={() => list.refetch()} />
      ) : list.data.length === 0 ? (
        <p className="text-[11px] text-muted-foreground py-2">Chưa có tệp đính kèm (≤ 10 MB).</p>
      ) : (
        list.data.map((a) => (
          <div key={a.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-border/60 bg-card text-xs">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="flex-1 truncate font-medium">{a.fileName}</span>
            <span className="text-[10px] text-muted-foreground font-mono shrink-0">{(a.sizeBytes / 1024).toFixed(0)} KB</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() =>
                void downloadAttachment(a.id)
                  .then((url) => window.open(url, "_blank", "noopener"))
                  .catch((e) => toast.error(describeError(e).message))
              }
            >
              <Download className="h-3 w-3" />
            </Button>
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => del.mutate(a.id, { onError: (e) => toast.error(describeError(e).message) })}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))
      )}
      {canEdit && (
        <>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload.mutate(f, { onSuccess: () => toast.success(`Đã tải lên ${f.name}`), onError: (err) => toast.error(describeError(err).message) });
              e.target.value = "";
            }}
          />
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
            {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Tải tệp lên
          </Button>
        </>
      )}
    </div>
  );
}

/** Phụ thuộc: chọn task cùng dự án phải xong trước (PUT /tasks/:id/dependencies; 422 khi tạo vòng). */
function DependencyPicker({
  taskId,
  value,
  projectId,
  projectKey,
  disabled,
  onChange,
}: {
  taskId: string;
  value: string[];
  projectId: string;
  projectKey: string;
  disabled: boolean;
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const tasks = useTasks(projectId, {}, { enabled: open });
  const [draft, setDraft] = React.useState<string[]>(value);
  const [q, setQ] = React.useState("");
  React.useEffect(() => setDraft(value), [value]);
  const all = (tasks.data ?? []).filter((t: TaskListItem) => t.id !== taskId);
  const byId = new Map(all.map((t) => [t.id, t]));
  const list = all.filter((t) => !q || `${projectKey}-${t.number} ${t.title}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o && JSON.stringify([...draft].sort()) !== JSON.stringify([...value].sort())) onChange(draft);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="min-h-8 h-auto py-1 px-2.5 w-full justify-start gap-1 text-xs font-normal flex-wrap bg-background/80 hover:bg-background"
        >
          {value.length === 0 ? (
            <span className="text-muted-foreground">Không phụ thuộc</span>
          ) : (
            value.map((id) => (
              <Badge key={id} variant="outline" className="text-[10px] px-1.5 py-0 font-mono font-normal bg-background">
                {byId.get(id) ? `${projectKey}-${byId.get(id)!.number}` : "…"}
              </Badge>
            ))
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2 space-y-1" align="start">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm ST-… hoặc tiêu đề" className="h-7 text-xs" />
        <div className="max-h-56 overflow-y-auto space-y-0.5">
          {list.slice(0, 50).map((t) => (
            <label key={t.id} className="flex items-center gap-2 p-1 rounded hover:bg-muted cursor-pointer text-xs">
              <Checkbox checked={draft.includes(t.id)} onCheckedChange={(c) => setDraft((d) => (c ? [...d, t.id] : d.filter((x) => x !== t.id)))} />
              <span className="font-mono text-muted-foreground">
                {projectKey}-{t.number}
              </span>
              <span className={cn("flex-1 truncate", t.completedAt && "line-through text-muted-foreground")}>{t.title}</span>
            </label>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground px-1 pt-1">Đóng để lưu · Gantt vẽ mũi tên theo phụ thuộc</p>
      </PopoverContent>
    </Popover>
  );
}
