"use client";

import * as React from "react";
import {
  AtSign,
  Calendar,
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
  Sparkles,
  Trash2,
  Upload,
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
import { describeError } from "@/lib/api";
import type { ProjectDetail, TaskDetail, TaskListItem, TaskPriority, TaskType } from "@/lib/types";
import { TASK_TYPES, sprintStatusLabel, typeToHint, typeToLabel } from "@/lib/status";
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

type Variant = "modal" | "page";
const HeaderWrap = ({ variant, children }: { variant: Variant; children: React.ReactNode }) =>
  variant === "modal" ? (
    <DialogHeader className="px-4 sm:px-6 pt-3.5 pb-3 border-b border-border/60 bg-muted/15 space-y-2 shrink-0 text-left">{children}</DialogHeader>
  ) : (
    <div className="px-4 sm:px-6 pt-4 pb-3.5 border-b border-border/60 bg-muted/15 space-y-2 shrink-0 text-left">{children}</div>
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
 * Thân màn chi tiết — dùng chung cho CẢ modal (bấm thẻ trên bảng) và trang riêng
 * /projects/:id/tasks/ST-n. Một nguồn sự thật, hai khung chứa: `variant` chỉ đổi phần
 * tiêu đề, vì DialogTitle/DialogDescription của Radix cần context Dialog nên không dùng
 * được ngoài modal (docs 02/05 §D2).
 */
export function TaskDetailBody({
  task,
  project,
  onRefresh,
  variant = "modal",
  onOpenFullPage,
}: {
  task: TaskDetail;
  project: ProjectDetail;
  onRefresh: () => void;
  variant?: "modal" | "page";
  onOpenFullPage?: () => void;
}) {
  const m = useTaskMutations(project.id);
  const sprints = useSprints(project.id);
  const [title, setTitle] = React.useState(task.title);
  const [description, setDescription] = React.useState(task.description ?? "");
  const [progressDraft, setProgressDraft] = React.useState(task.progress);
  React.useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? "");
    setProgressDraft(task.progress);
  }, [task.id, task.version, task.title, task.description, task.progress]);

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
            {variant === "modal" && onOpenFullPage && (
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
                    onSuccess: () => toast.success(`Đã xoá ${taskKeyOf(project.key, task)}`),
                    onError: (e) => fail(e, "Xoá"),
                  })
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Xoá công việc</span>
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

      {/* Thân 2 cột: từ màn md (768px) trở lên chia 2 cột cuộn độc lập; trên mobile xếp dọc gọn gàng */}
      <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden flex flex-col md:grid md:grid-cols-[minmax(0,1fr)_19.5rem] lg:grid-cols-[minmax(0,1fr)_21.5rem] text-xs">
        {/* Cột trái: nội dung — mô tả, đánh giá, việc con, bình luận, đính kèm, giờ làm, hoạt động */}
        <div className="min-w-0 md:overflow-y-auto p-4 sm:p-6 space-y-5">
          <div className="space-y-1.5">
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
              className="text-xs sm:text-[13px] leading-relaxed min-h-[96px] sm:min-h-[112px] bg-muted/20 hover:bg-muted/30 focus-visible:bg-background rounded-lg p-3 resize-y transition-colors"
              placeholder="Mô tả (markdown nhẹ)…"
            />
          </div>

          <ReviewCard task={task} project={project} />
          <DerivedBugs task={task} projectId={project.id} />

          <Tabs defaultValue="subtasks" className="space-y-3">
            <div className="overflow-x-auto -mx-1 px-1">
              <TabsList className="w-full sm:w-auto inline-flex h-9 p-1 bg-muted/60 rounded-lg gap-0.5 justify-start">
                <TabsTrigger value="subtasks" className="text-xs h-7 px-2.5 gap-1.5 shrink-0">
                  <ListChecks className="h-3.5 w-3.5" />
                  <span>Việc con</span>
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 font-mono h-4">
                    {task.subtasks.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="comments" className="text-xs h-7 px-2.5 gap-1.5 shrink-0">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Bình luận</span>
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 font-mono h-4">
                    {task.commentCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="files" className="text-xs h-7 px-2.5 gap-1.5 shrink-0">
                  <Paperclip className="h-3.5 w-3.5" />
                  <span>Đính kèm</span>
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 font-mono h-4">
                    {task.attachmentCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="worklog" className="text-xs h-7 px-2.5 gap-1.5 shrink-0">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Giờ làm</span>
                </TabsTrigger>
                <TabsTrigger value="activity" className="text-xs h-7 px-2.5 gap-1.5 shrink-0">
                  <History className="h-3.5 w-3.5" />
                  <span>Hoạt động</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="subtasks" className="space-y-2.5 mt-0">
              {task.subtasks.length > 0 && (
                <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-success transition-all rounded-full"
                      style={{ width: `${Math.round((doneSubtasks / task.subtasks.length) * 100)}%` }}
                    />
                  </div>
                  <span className="font-mono shrink-0">
                    {doneSubtasks}/{task.subtasks.length} xong
                  </span>
                </div>
              )}
              {task.subtasks.length === 0 && !project.canEdit && (
                <p className="text-[11px] text-muted-foreground py-2">Chưa có việc con nào.</p>
              )}
              <div className="space-y-1.5">
                {task.subtasks.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border/60 bg-card hover:border-border transition-colors"
                  >
                    <Checkbox
                      checked={!!s.completedAt}
                      disabled={!project.canEdit || !doneColumn || m.move.isPending}
                      onCheckedChange={(checked) =>
                        m.move.mutate(
                          { id: s.id, version: s.version, columnId: checked ? doneColumn!.id : project.columns[0].id },
                          { onError: (e) => fail(e, "Đổi trạng thái việc con") },
                        )
                      }
                    />
                    <span className="font-mono text-[11px] text-muted-foreground shrink-0">{taskKeyOf(project.key, s)}</span>
                    <span className={cn("flex-1 text-xs min-w-0 truncate", s.completedAt && "line-through text-muted-foreground")}>
                      {s.title}
                    </span>
                    {s.estimateHours != null && (
                      <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 shrink-0">
                        {s.estimateHours}h
                      </Badge>
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
                      { onSuccess: () => form.reset(), onError: (err) => fail(err, "Thêm việc con") },
                    );
                  }}
                >
                  <Input name="title" placeholder="Thêm việc con…" className="h-8 text-xs flex-1" required />
                  <Input name="hours" type="number" step="0.5" min={0} placeholder="giờ" className="h-8 text-xs w-20" />
                  <Button type="submit" size="sm" className="h-8 text-xs gap-1 shrink-0" disabled={m.subtask.isPending}>
                    <Plus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Thêm</span>
                  </Button>
                </form>
              )}
            </TabsContent>

            <TabsContent value="worklog" className="mt-0">
              <WorklogPanel task={task} project={project} />
            </TabsContent>
            <TabsContent value="comments" className="mt-0">
              <CommentsPanel taskId={task.id} project={project} />
            </TabsContent>
            <TabsContent value="files" className="mt-0">
              <AttachmentsPanel taskId={task.id} canEdit={project.canEdit} />
            </TabsContent>
            <TabsContent value="activity" className="mt-0">
              <ActivityList projectId={project.id} taskId={task.id} compact />
            </TabsContent>
          </Tabs>
        </div>

        {/* Cột phải: thuộc tính, chia thành 3 thẻ thông tin gọn gàng & dễ quét mắt */}
        <aside className="w-full md:overflow-y-auto border-t md:border-t-0 md:border-l border-border/60 bg-muted/20 p-4 sm:p-5 space-y-3.5 shrink-0">
          {/* Nhóm 1: Phân công & Trạng thái */}
          <PropGroup title="Phân công & Trạng thái">
            <PropRow label="Trạng thái" saving={isSaving("column")}>
              <Select
                value={task.columnId}
                disabled={!project.canEdit || isSaving("column")}
                onValueChange={(columnId) => enqueue("column", "Chuyển cột", (version) => m.move.mutateAsync({ id: task.id, version, columnId }))}
              >
                <SelectTrigger className="h-8 text-xs bg-background/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {project.columns.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.name}
                      {c.wipLimit ? ` (WIP ${c.wipLimit})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PropRow>

            <PropRow label="Người làm" saving={isSaving("assignees")}>
              <AssigneePicker
                value={task.assignees.map((a) => a.id)}
                members={project.members}
                disabled={!project.canEdit || isSaving("assignees")}
                onChange={(userIds) => enqueue("assignees", "Đổi người thực hiện", (version) => m.assignees.mutateAsync({ id: task.id, version, userIds }))}
              />
            </PropRow>

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
                  {task.sprint && !(sprints.data ?? []).some((s) => s.id === task.sprint?.id && s.status !== "CLOSED") && (
                    <SelectItem value={task.sprint.id} className="text-xs">
                      {task.sprint.name}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </PropRow>

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
          </PropGroup>

          {/* Nhóm 2: Thời gian & Tiến độ */}
          <PropGroup title="Thời gian & Công sức" icon={Calendar}>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-muted-foreground inline-flex items-center gap-1">
                  Tiến độ
                  {isSaving("progress") && <Loader2 className="h-3 w-3 animate-spin" />}
                </span>
                <span className="font-mono font-semibold text-foreground">{progressDraft}%</span>
              </div>
              <Input
                type="range"
                min={0}
                max={100}
                step={5}
                value={progressDraft}
                disabled={!project.canEdit || isSaving("progress")}
                onChange={(e) => setProgressDraft(Number(e.target.value))}
                onMouseUp={() => {
                  if (progressDraft !== task.progress) {
                    enqueue("progress", "Cập nhật tiến độ", (version) =>
                      m.progress.mutateAsync({ id: task.id, version, progress: progressDraft }),
                    );
                  }
                }}
                onTouchEnd={() => {
                  if (progressDraft !== task.progress) {
                    enqueue("progress", "Cập nhật tiến độ", (version) =>
                      m.progress.mutateAsync({ id: task.id, version, progress: progressDraft }),
                    );
                  }
                }}
                className="h-5 px-0 border-0 shadow-none accent-primary cursor-pointer"
              />
              {project.canEdit && (
                <div className="grid grid-cols-5 gap-1">
                  {[0, 25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      disabled={isSaving("progress")}
                      onClick={() => {
                        setProgressDraft(pct);
                        if (pct !== task.progress) {
                          enqueue("progress", "Cập nhật tiến độ", (version) =>
                            m.progress.mutateAsync({ id: task.id, version, progress: pct }),
                          );
                        }
                      }}
                      className={cn(
                        "h-6 rounded text-[10px] font-mono border transition-colors",
                        task.progress === pct
                          ? "bg-primary text-primary-foreground border-primary font-semibold"
                          : "bg-background/70 border-border/60 text-muted-foreground hover:text-foreground hover:bg-background",
                      )}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <NumberField
                label="Ước lượng (giờ)"
                value={task.estimateHours}
                disabled={!project.canEdit || isSaving("estimateHours")}
                onCommit={(v) => patch({ estimateHours: v }, "Đổi ước lượng")}
              />
              <NumberField
                label="Giờ còn lại"
                value={task.remainingHours}
                disabled={!project.canEdit || isSaving("remaining")}
                onCommit={(v) =>
                  enqueue("remaining", "Cập nhật giờ còn lại", (version) =>
                    m.progress.mutateAsync({ id: task.id, version, remainingHours: v ?? undefined }),
                  )
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <DateField
                label="Bắt đầu"
                value={task.startDate}
                disabled={!project.canEdit || isSaving("startDate")}
                onCommit={(v) => patch({ startDate: v }, "Đổi ngày bắt đầu")}
              />
              <DateField
                label="Hạn chót"
                value={task.dueDate}
                overdue={isOverdue}
                disabled={!project.canEdit || isSaving("dueDate")}
                onCommit={(v) => patch({ dueDate: v }, "Đổi hạn")}
              />
            </div>
          </PropGroup>

          {/* Nhóm 3: Phân loại & Liên kết */}
          <PropGroup
            title="Phân loại & Liên kết"
            icon={Layers}
            collapsible
            defaultOpen
            count={[task.labels.length, task.requiredSkills.length, task.dependsOnIds.length, task.origin ? 1 : 0].filter(Boolean).length}
          >
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Loại việc" saving={isSaving("type")}>
                <Select
                  value={task.type}
                  disabled={!project.canEdit || isSaving("type")}
                  onValueChange={(v) => patch({ type: v as TaskType }, "Đổi loại")}
                >
                  <SelectTrigger className="h-8 text-xs bg-background/80">
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
              </Field>
              <Field label="Độ khó (1–5)" saving={isSaving("difficulty")}>
                <Select
                  value={String(task.difficulty)}
                  disabled={!project.canEdit || isSaving("difficulty")}
                  onValueChange={(v) => patch({ difficulty: Number(v) }, "Đổi độ khó")}
                >
                  <SelectTrigger className="h-8 text-xs bg-background/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((d) => (
                      <SelectItem key={d} value={String(d)} className="text-xs">
                        Mức {d}/5
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {task.type === "BUG" && (
              <Field label="Sinh ra từ việc" saving={isSaving("originTaskId")}>
                <OriginPicker
                  task={task}
                  project={project}
                  disabled={!project.canEdit || isSaving("originTaskId")}
                  onChange={(id) => patch({ originTaskId: id }, "Gắn việc gốc")}
                />
              </Field>
            )}

            <Field label="Nhãn" saving={isSaving("labels")}>
              <LabelPicker
                value={task.labels.map((l) => l.id)}
                labels={project.labels}
                disabled={!project.canEdit || isSaving("labels")}
                onChange={(labelIds) =>
                  enqueue("labels", "Đổi nhãn", (version) => m.labels.mutateAsync({ id: task.id, version, labelIds }))
                }
              />
            </Field>

            <Field label="Kỹ năng yêu cầu" saving={isSaving("skills")}>
              <SkillPicker
                value={task.requiredSkills.map((s) => ({ skillId: s.id, minLevel: s.minLevel }))}
                workspaceId={project.workspaceId}
                disabled={!project.canEdit || isSaving("skills")}
                onChange={(skills) =>
                  enqueue("skills", "Đổi kỹ năng", (version) => m.skills.mutateAsync({ id: task.id, version, skills }))
                }
              />
            </Field>

            <Field label="Phụ thuộc (xong trước)" saving={isSaving("dependencies")}>
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
            </Field>
          </PropGroup>
        </aside>
      </div>
    </>
  );
}

/** Thẻ nhóm thuộc tính ở cột phải. */
function PropGroup({
  title,
  icon: Icon,
  children,
  collapsible = false,
  defaultOpen = false,
  count = 0,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  count?: number;
}) {
  const [open, setOpen] = React.useState(collapsible ? defaultOpen : true);
  return (
    <div className="rounded-lg border border-border/60 bg-card/85 p-3.5 shadow-2xs">
      {collapsible ? (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-full justify-between px-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-transparent hover:text-foreground"
            >
              <span className="inline-flex items-center gap-1.5">
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {title}
                {count > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono normal-case">
                    {count}
                  </Badge>
                )}
              </span>
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2.5 pt-3">{children}</CollapsibleContent>
        </Collapsible>
      ) : (
        <div className="space-y-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {title}
          </div>
          <div className="space-y-2.5">{children}</div>
        </div>
      )}
    </div>
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

function Field({ label, children, saving }: { label: string; children: React.ReactNode; saving?: boolean }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-muted-foreground inline-flex items-center gap-1">
        {label}
        {saving && <Loader2 className="h-3 w-3 animate-spin" />}
      </label>
      {children}
    </div>
  );
}

function NumberField({
  label,
  value,
  disabled,
  onCommit,
}: {
  label: string;
  value: number | null;
  disabled: boolean;
  onCommit: (v: number | null) => void;
}) {
  const [v, setV] = React.useState(value == null ? "" : String(value));
  React.useEffect(() => setV(value == null ? "" : String(value)), [value]);
  return (
    <Field label={label}>
      <div className="relative">
        <Input
          type="number"
          step="0.5"
          min={0}
          value={v}
          disabled={disabled}
          placeholder="—"
          onChange={(e) => setV(e.target.value)}
          onBlur={() => {
            const n = v === "" ? null : Number(v);
            if (n !== value) onCommit(n);
          }}
          className="h-8 text-xs font-mono pr-6 bg-background/80"
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono">
          h
        </span>
      </div>
    </Field>
  );
}

function DateField({
  label,
  value,
  overdue,
  disabled,
  onCommit,
}: {
  label: string;
  value: string | null;
  overdue?: boolean;
  disabled: boolean;
  onCommit: (v: string | null) => void;
}) {
  const cur = value ? value.slice(0, 10) : "";
  return (
    <Field label={label}>
      <Input
        type="date"
        value={cur}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value || null;
          if (next !== (value ? value.slice(0, 10) : null)) onCommit(next);
        }}
        className={cn("h-8 text-xs bg-background/80 px-2", overdue && "border-destructive/60 text-destructive font-medium")}
      />
    </Field>
  );
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
                <p className="text-xs whitespace-pre-wrap leading-relaxed">{c.body}</p>
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
