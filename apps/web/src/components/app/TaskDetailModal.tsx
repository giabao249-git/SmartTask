"use client";

import * as React from "react";
import {
  AlignLeft,
  AtSign,
  ChevronDown,
  Download,
  FileText,
  Flag,
  ListChecks,
  Loader2,
  Maximize2,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
  Sparkles,
  Tag,
  Timer,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { ActivityList } from "@/features/activity/ActivityList";
import { useTasks } from "@/features/board/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorState } from "@/components/app/ErrorState";
import { UserAvatar } from "@/components/app/UserAvatar";
import { PriorityBadge } from "@/components/app/PriorityBadge";
import { describeError } from "@/lib/api";
import type { ProjectDetail, TaskDetail, TaskListItem, TaskPriority, TaskType } from "@/lib/types";
import { TASK_TYPES, typeToHint, typeToLabel } from "@/lib/status";
import { TaskTypeBadge } from "./TaskTypeBadge";
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
 * Mở dạng modal giữa màn chứ không phải ngăn trượt bên phải: nội dung dàn hai cột nên cần bề
 * ngang, và modal giữ được mạch "xem rồi đóng, bảng vẫn nguyên chỗ cũ".
 */
export function TaskDetailModal({ taskId, project, open, onOpenChange, onOpenFullPage }: TaskDetailModalProps) {
  const q = useTask(open ? taskId : null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] w-full max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl sm:rounded-xl">
        {q.isPending || !taskId ? (
          <TaskDetailSkeleton />
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

/** Khung chờ đúng hình dạng màn thật (docs 10 §2): tiêu đề + hai cột, không nhảy layout. */
function TaskDetailSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="space-y-3 border-b border-border/60 bg-muted/30 px-4 py-4">
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <div className="flex flex-col gap-4 px-4 py-4 lg:flex-row">
        <div className="flex-1 space-y-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
        <div className="w-full space-y-3 lg:w-72 lg:shrink-0">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-44 w-full" />
        </div>
      </div>
    </div>
  );
}

type Variant = "modal" | "page";
const HeaderWrap = ({ variant, children }: { variant: Variant; children: React.ReactNode }) =>
  variant === "modal" ? (
    <DialogHeader className="space-y-2 border-b border-border/60 bg-muted/30 px-4 py-4">{children}</DialogHeader>
  ) : (
    <div className="space-y-2 border-b border-border/60 bg-muted/30 px-4 py-4">{children}</div>
  );
const TitleWrap = ({ variant, children }: { variant: Variant; children: React.ReactNode }) =>
  variant === "modal" ? <DialogTitle className="text-left">{children}</DialogTitle> : <h1 className="text-left">{children}</h1>;
const DescWrap = ({ variant, children }: { variant: Variant; children: React.ReactNode }) =>
  variant === "modal" ? (
    <DialogDescription className="text-left text-[11px]">{children}</DialogDescription>
  ) : (
    <p className="text-left text-[11px] text-muted-foreground">{children}</p>
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
  const [title, setTitle] = React.useState(task.title);
  const [description, setDescription] = React.useState(task.description ?? "");
  React.useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? "");
  }, [task.id, task.version, task.title, task.description]);

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
   *
   * Nhưng mỗi PATCH tăng `version`, nên nếu cho hai lời gọi chạy song song với cùng version thì
   * lời thứ hai chắc chắn 409. Cách làm: giao diện vẫn bấm được ngay, còn các lời gọi được nối
   * vào MỘT hàng đợi tuần tự phía client, mỗi lời lấy version mới nhất từ phản hồi trước.
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

  return (
    <>
      <HeaderWrap variant={variant}>
        {/* pr-8 chừa chỗ cho nút đóng của Dialog (absolute right-4) khỏi đè lên nút phóng to */}
        <div className={cn("flex flex-wrap items-center gap-1.5", variant === "modal" && "pr-8")}>
          <Badge variant="outline" className="gap-1 font-mono text-xs tabular-nums">
            {taskKeyOf(project.key, task)}
          </Badge>
          <TaskTypeBadge type={task.type} />
          {task.source === "AI" && (
            <Badge variant="info" className="gap-1 text-[10px]">
              <Sparkles className="h-2.5 w-2.5" /> AI
            </Badge>
          )}
          <Badge variant="secondary" className="text-[10px]">
            {task.column.name}
          </Badge>
          {task.sprint && (
            <Badge variant="outline" className="text-[10px]">
              {task.sprint.name}
            </Badge>
          )}
          <span className="ml-auto flex items-center gap-1.5">
            <Badge variant="outline" className="font-mono text-[10px] font-normal tabular-nums text-muted-foreground">
              v{task.version}
            </Badge>
            {variant === "modal" && onOpenFullPage && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label="Mở toàn màn hình"
                title="Mở toàn màn hình (Ctrl+click mã công việc để mở tab mới)"
                onClick={onOpenFullPage}
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </span>
        </div>
        <TitleWrap variant={variant}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title.trim() !== task.title && patch({ title: title.trim() }, "Đổi tiêu đề")}
            disabled={!project.canEdit || isSaving("title")}
            aria-label="Tiêu đề công việc"
            className="h-10 w-full border-transparent bg-card px-2.5 text-base font-semibold shadow-none hover:border-border focus-visible:border-border focus-visible:bg-background"
          />
        </TitleWrap>
        <DescWrap variant={variant}>
          Tạo bởi {task.createdBy.shortName ?? task.createdBy.fullName} · {fmtDay(task.createdAt)} · sửa lần cuối {fmtDay(task.updatedAt)}
        </DescWrap>
      </HeaderWrap>

      <div className="flex flex-1 flex-col items-start gap-5 overflow-y-auto px-4 py-4 text-sm lg:flex-row">
        {/* Cột trái: nội dung — mô tả, việc con, bình luận, đính kèm, hoạt động */}
        <div className="min-w-0 flex-1 space-y-4">
          <Section icon={AlignLeft} title="Mô tả" saving={isSaving("description")}>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => description !== (task.description ?? "") && patch({ description: description || null }, "Sửa mô tả")}
              disabled={!project.canEdit || isSaving("description")}
              className="min-h-[96px] w-full resize-y border-border/60 bg-muted/30 px-2.5 py-2 text-sm shadow-none focus-visible:border-border focus-visible:bg-background"
              placeholder="Mô tả (markdown nhẹ)…"
            />
          </Section>

          <Separator />

          <Tabs defaultValue="subtasks">
            <TabsList className="h-9 w-full p-0.5">
              <TabsTrigger value="subtasks" className="flex-1 gap-1 px-2 text-xs">
                Việc con <span className="font-mono tabular-nums opacity-70">({task.subtasks.length})</span>
              </TabsTrigger>
              <TabsTrigger value="comments" className="flex-1 gap-1 px-2 text-xs">
                Bình luận <span className="font-mono tabular-nums opacity-70">({task.commentCount})</span>
              </TabsTrigger>
              <TabsTrigger value="files" className="flex-1 gap-1 px-2 text-xs">
                Đính kèm <span className="font-mono tabular-nums opacity-70">({task.attachmentCount})</span>
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex-1 px-2 text-xs">
                Hoạt động
              </TabsTrigger>
            </TabsList>
            <TabsContent value="subtasks" className="space-y-3 pt-3">
              {task.subtasks.length > 0 && (
                <Card className="divide-y divide-border/60 overflow-hidden p-0 shadow-none">
                  {task.subtasks.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-muted/50"
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
                      <span className={cn("min-w-0 flex-1 truncate text-sm", s.completedAt && "text-muted-foreground line-through")}>
                        <span className="font-mono text-[11px] text-muted-foreground">{taskKeyOf(project.key, s)}</span>
                        <span className="mx-1 text-muted-foreground/60">·</span>
                        {s.title}
                      </span>
                      {s.estimateHours != null && (
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">{s.estimateHours}h</span>
                      )}
                    </div>
                  ))}
                </Card>
              )}
              {task.subtasks.length === 0 && <TabEmpty icon={ListChecks}>Chưa có việc con.</TabEmpty>}
              {project.canEdit && (
                <form
                  className="flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const t = String(f.get("title") ?? "").trim();
                    if (!t) return;
                    const form = e.currentTarget;
                    m.subtask.mutate({ parentId: task.id, title: t, estimateHours: Number(f.get("hours")) || undefined }, { onSuccess: () => form.reset(), onError: (err) => fail(err, "Thêm việc con") });
                  }}
                >
                  <Input name="title" placeholder="Thêm việc con…" className="h-9 min-w-0 flex-1 text-sm" required />
                  <Input name="hours" type="number" step="0.5" min={0} placeholder="Giờ" className="h-9 w-20 shrink-0 text-sm tabular-nums" />
                  <Button type="submit" size="sm" className="h-9 shrink-0 gap-1 px-3 text-sm" disabled={m.subtask.isPending}>
                    <Plus className="h-3.5 w-3.5" /> Thêm
                  </Button>
                </form>
              )}
            </TabsContent>
            <TabsContent value="comments" className="pt-3">
              <CommentsPanel taskId={task.id} project={project} />
            </TabsContent>
            <TabsContent value="files" className="pt-3">
              <AttachmentsPanel taskId={task.id} canEdit={project.canEdit} />
            </TabsContent>
            <TabsContent value="activity" className="pt-3">
              <ActivityList projectId={project.id} taskId={task.id} compact />
            </TabsContent>
          </Tabs>
        </div>

        {/* Cột phải: thuộc tính, gom 3 nhóm; nhóm ít đụng tới nhất thu gọn sẵn (docs 02/05 §D1) */}
        <aside className="w-full shrink-0 lg:w-72">
          <Card className="space-y-4 border-border/60 bg-muted/20 p-4 shadow-none">
            <PropGroup icon={UserRound} title="Phân công">
              <Field label="Người thực hiện" saving={isSaving("assignees")}>
                <AssigneePicker
                  value={task.assignees.map((a) => a.id)}
                  members={project.members}
                  disabled={!project.canEdit || isSaving("assignees")}
                  onChange={(userIds) => enqueue("assignees", "Đổi người thực hiện", (version) => m.assignees.mutateAsync({ id: task.id, version, userIds }))}
                />
              </Field>
              <Field label="Trạng thái (cột)" saving={isSaving("column")}>
                <Select
                  value={task.columnId}
                  disabled={!project.canEdit || isSaving("column")}
                  onValueChange={(columnId) => enqueue("column", "Chuyển cột", (version) => m.move.mutateAsync({ id: task.id, version, columnId }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {project.columns.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-sm">
                        {c.name}
                        {c.wipLimit ? ` (WIP ${c.wipLimit})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Sprint" saving={isSaving("sprintId")}>
                <Select
                  value={task.sprintId ?? "__backlog"}
                  disabled={!project.canEdit || isSaving("sprintId")}
                  onValueChange={(v) => patch({ sprintId: v === "__backlog" ? null : v }, "Đổi sprint")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__backlog" className="text-sm">
                      Backlog
                    </SelectItem>
                    {project.activeSprint && (
                      <SelectItem value={project.activeSprint.id} className="text-sm">
                        {project.activeSprint.name} (đang chạy)
                      </SelectItem>
                    )}
                    {task.sprint && task.sprint.id !== project.activeSprint?.id && (
                      <SelectItem value={task.sprint.id} className="text-sm">
                        {task.sprint.name}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Ưu tiên" saving={isSaving("priority")}>
                <Select value={task.priority} disabled={!project.canEdit || isSaving("priority")} onValueChange={(priority) => patch({ priority: priority as TaskPriority }, "Đổi ưu tiên")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((p) => (
                      <SelectItem key={p} value={p} className="text-sm">
                        <PriorityBadge priority={p} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Cờ khẩn" saving={isSaving("isUrgent")}>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-xs transition-colors",
                    task.isUrgent ? "border-warning/50 bg-warning/10" : "border-border/60 hover:bg-muted/50",
                  )}
                  title="Gấp về thời gian — xếp vào ô Làm ngay của ma trận Eisenhower. Khác với mức ưu tiên (mức quan trọng)."
                >
                  <Checkbox checked={task.isUrgent} disabled={!project.canEdit || isSaving("isUrgent")} onCheckedChange={(c) => patch({ isUrgent: c === true }, "Đổi cờ khẩn")} />
                  <span className="flex-1 leading-relaxed">
                    <Flag className="mr-1 inline h-3 w-3 -translate-y-px" />
                    Gấp — xếp vào ô &quot;Làm ngay&quot;
                  </span>
                </label>
              </Field>
            </PropGroup>

            <Separator />

            <PropGroup icon={Timer} title="Thời gian & công sức">
              <NumberField label="Ước lượng (giờ)" value={task.estimateHours} disabled={!project.canEdit || isSaving("estimateHours")} onCommit={(v) => patch({ estimateHours: v }, "Đổi ước lượng")} />
              <NumberField
                label="Giờ còn lại"
                value={task.remainingHours}
                disabled={!project.canEdit || isSaving("remaining")}
                onCommit={(v) => enqueue("remaining", "Cập nhật giờ còn lại", (version) => m.progress.mutateAsync({ id: task.id, version, remainingHours: v ?? undefined }))}
              />
              <Field
                label="Tiến độ"
                saving={isSaving("progress")}
                right={
                  <span className="rounded-md border border-border/60 bg-card px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums">
                    {task.progress}%
                  </span>
                }
              >
                <Input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  defaultValue={task.progress}
                  disabled={!project.canEdit || isSaving("progress")}
                  onMouseUp={(e) => {
                    const v = Number((e.target as HTMLInputElement).value);
                    if (v !== task.progress) enqueue("progress", "Cập nhật tiến độ", (version) => m.progress.mutateAsync({ id: task.id, version, progress: v }));
                  }}
                  className="h-6 w-full cursor-pointer border-0 bg-transparent px-0 shadow-none accent-primary"
                  aria-label="Tiến độ phần trăm"
                />
              </Field>
              <DateField label="Bắt đầu" value={task.startDate} disabled={!project.canEdit || isSaving("startDate")} onCommit={(v) => patch({ startDate: v }, "Đổi ngày bắt đầu")} />
              <DateField label="Hạn" value={task.dueDate} disabled={!project.canEdit || isSaving("dueDate")} onCommit={(v) => patch({ dueDate: v }, "Đổi hạn")} />
            </PropGroup>

            <Separator />

            <PropGroup
              icon={Tag}
              title="Phân loại & liên kết"
              collapsible
              count={[task.labels.length, task.requiredSkills.length, task.dependsOnIds.length].filter(Boolean).length}
            >
              <Field label="Loại công việc" saving={isSaving("type")}>
                <Select
                  value={task.type}
                  disabled={!project.canEdit || isSaving("type")}
                  onValueChange={(v) => patch({ type: v as TaskType }, "Đổi loại")}
                >
                  <SelectTrigger title={typeToHint(task.type)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="text-sm" title={typeToHint(t)}>
                        {typeToLabel(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Nhãn" saving={isSaving("labels")}>
                <LabelPicker
                  value={task.labels.map((l) => l.id)}
                  labels={project.labels}
                  disabled={!project.canEdit || isSaving("labels")}
                  onChange={(labelIds) => enqueue("labels", "Đổi nhãn", (version) => m.labels.mutateAsync({ id: task.id, version, labelIds }))}
                />
              </Field>
              <Field label="Kỹ năng yêu cầu" saving={isSaving("skills")}>
                <SkillPicker
                  value={task.requiredSkills.map((s) => ({ skillId: s.id, minLevel: s.minLevel }))}
                  workspaceId={project.workspaceId}
                  disabled={!project.canEdit || isSaving("skills")}
                  onChange={(skills) => enqueue("skills", "Đổi kỹ năng", (version) => m.skills.mutateAsync({ id: task.id, version, skills }))}
                />
              </Field>
              <Field label="Độ khó (1–5)" saving={isSaving("difficulty")}>
                <Select value={String(task.difficulty)} disabled={!project.canEdit || isSaving("difficulty")} onValueChange={(v) => patch({ difficulty: Number(v) }, "Đổi độ khó")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((d) => (
                      <SelectItem key={d} value={String(d)} className="text-sm tabular-nums">
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
          </Card>
        </aside>
      </div>

      {project.canManage && (
        <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-muted/30 px-4 py-2.5">
          <p className="truncate text-[11px] text-muted-foreground">
            Thay đổi tự lưu khi rời ô nhập · {taskKeyOf(project.key, task)}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={m.remove.isPending}
            onClick={() => m.remove.mutate(task.id, { onSuccess: () => toast.success(`Đã xoá ${taskKeyOf(project.key, task)}`), onError: (e) => fail(e, "Xoá") })}
          >
            <Trash2 className="h-3.5 w-3.5" /> Xoá công việc
          </Button>
        </div>
      )}
    </>
  );
}

/** Tiêu đề mục có icon — cùng kích thước chữ với PropGroup để hai cột trông khớp nhau. */
function Section({
  icon: Icon,
  title,
  saving,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  saving?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span>{title}</span>
        {saving && <Loader2 className="h-3 w-3 animate-spin" />}
      </div>
      {children}
    </section>
  );
}

/** Trạng thái rỗng của từng tab: icon + một dòng, viền đứt cho nhẹ. */
function TabEmpty({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 bg-muted/20 px-4 py-8 text-center">
      <Icon className="h-5 w-5 text-muted-foreground/70" />
      <p className="text-xs text-muted-foreground">{children}</p>
    </div>
  );
}

/** Nhóm thuộc tính ở cột phải; `collapsible` cho nhóm ít đụng tới nhất, có đếm số đã đặt. */
function PropGroup({
  title,
  icon: Icon,
  children,
  collapsible = false,
  count = 0,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  collapsible?: boolean;
  count?: number;
}) {
  const [open, setOpen] = React.useState(!collapsible);
  const heading = (
    <span className="inline-flex items-center gap-1.5">
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {title}
      {count > 0 && <span className="font-mono font-normal tabular-nums opacity-70">· {count}</span>}
    </span>
  );
  return (
    <div className="space-y-2">
      {collapsible ? (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-full justify-between px-0 text-[11px] font-semibold text-muted-foreground hover:bg-transparent">
              {heading}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2">{children}</CollapsibleContent>
        </Collapsible>
      ) : (
        <>
          <div className="text-[11px] font-semibold text-muted-foreground">{heading}</div>
          <div className="space-y-3">{children}</div>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  saving,
  right,
}: {
  label: string;
  children: React.ReactNode;
  saving?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          {label}
          {saving && <Loader2 className="h-3 w-3 animate-spin" />}
        </label>
        {right}
      </div>
      {children}
    </div>
  );
}

function NumberField({ label, value, disabled, onCommit }: { label: string; value: number | null; disabled: boolean; onCommit: (v: number | null) => void }) {
  const [v, setV] = React.useState(value == null ? "" : String(value));
  React.useEffect(() => setV(value == null ? "" : String(value)), [value]);
  return (
    <Field label={label}>
      <Input
        type="number"
        step="0.5"
        min={0}
        value={v}
        disabled={disabled}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const n = v === "" ? null : Number(v);
          if (n !== value) onCommit(n);
        }}
        className="h-9 text-sm tabular-nums"
      />
    </Field>
  );
}

function DateField({ label, value, disabled, onCommit }: { label: string; value: string | null; disabled: boolean; onCommit: (v: string | null) => void }) {
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
        className="h-9 text-sm"
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
        <TabEmpty icon={MessageSquare}>Chưa có bình luận.</TabEmpty>
      ) : (
        <div className="space-y-3">
          {comments.data.map((c) => (
            <div key={c.id} className="group flex gap-2.5">
              <UserAvatar name={c.author.shortName ?? c.author.fullName} avatar={c.author.avatarUrl ?? undefined} size="sm" showTooltip={false} />
              <div className="min-w-0 flex-1 rounded-lg rounded-tl-sm border border-border/60 bg-muted/30 px-3 py-2">
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="truncate font-semibold text-foreground">{c.author.fullName}</span>
                  <span className="shrink-0 text-muted-foreground">{fmtDay(c.createdAt)}</span>
                  {c.mentions.length > 0 && <span className="truncate text-muted-foreground">· nhắc {c.mentions.map((u) => u.shortName ?? u.fullName).join(", ")}</span>}
                  {project.canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Xoá bình luận"
                      className="ml-auto h-6 w-6 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                      onClick={() => mut.remove.mutate(c.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {project.canEdit && (
        <div className="relative space-y-2 rounded-lg border border-border/60 bg-muted/20 p-2.5 transition-colors focus-within:border-border focus-within:bg-background">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Viết bình luận… gõ @ để nhắc thành viên"
            className="min-h-[64px] resize-none border-0 bg-transparent px-0 py-0.5 text-sm shadow-none focus-visible:ring-0"
          />
          {at && suggest.data && suggest.data.length > 0 && (
            <div className="absolute left-0 right-0 top-0 z-10 -translate-y-full rounded-lg border border-border bg-popover p-1 shadow-lg">
              {suggest.data.map((u) => (
                <Button key={u.id} variant="ghost" size="sm" onClick={() => pick(u)} className="h-8 w-full justify-start gap-2 text-sm">
                  <AtSign className="h-3.5 w-3.5 text-info" />
                  <span className="truncate">{u.fullName}</span>
                  {u.email && <span className="ml-auto truncate text-[11px] text-muted-foreground">{u.email}</span>}
                </Button>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              {mentions.map((u) => (
                <Badge key={u.id} variant="info" className="gap-1 text-[10px] font-normal">
                  @{u.name}
                </Badge>
              ))}
            </div>
            <Button
              size="sm"
              className="h-8 shrink-0 gap-1.5 text-xs"
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
              <Send className="h-3.5 w-3.5" /> Gửi
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
    <div className="space-y-3">
      {list.isPending ? (
        <Skeleton className="h-12 w-full" />
      ) : list.isError ? (
        <ErrorState code={describeError(list.error).code} message={describeError(list.error).message} onRetry={() => list.refetch()} />
      ) : list.data.length === 0 ? (
        <TabEmpty icon={Paperclip}>Chưa có tệp đính kèm (≤ 10 MB).</TabEmpty>
      ) : (
        <Card className="divide-y divide-border/60 overflow-hidden p-0 shadow-none">
          {list.data.map((a) => (
            <div key={a.id} className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{a.fileName}</p>
                <p className="font-mono text-[10px] tabular-nums text-muted-foreground">{(a.sizeBytes / 1024).toFixed(0)} KB</p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Tải xuống ${a.fileName}`}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    void downloadAttachment(a.id)
                      .then((url) => window.open(url, "_blank", "noopener"))
                      .catch((e) => toast.error(describeError(e).message))
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Xoá tệp ${a.fileName}`}
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => del.mutate(a.id, { onError: (e) => toast.error(describeError(e).message) })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </Card>
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
          <Button variant="outline" size="sm" className="h-9 w-full gap-1.5 text-sm" disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
            {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Tải tệp lên
          </Button>
        </>
      )}
    </div>
  );
}




/** Phụ thuộc: chọn task cùng dự án phải xong trước (PUT /tasks/:id/dependencies; 422 khi tạo vòng). */
function DependencyPicker({ taskId, value, projectId, projectKey, disabled, onChange }: { taskId: string; value: string[]; projectId: string; projectKey: string; disabled: boolean; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = React.useState(false);
  // Chỉ kéo danh sách khi người dùng thật sự mở ô chọn phụ thuộc, không phải mỗi lần mở modal.
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
        <Button variant="outline" size="sm" disabled={disabled} className="h-9 w-full justify-start gap-1.5 overflow-hidden text-sm font-normal">
          {value.length === 0 ? <span className="text-muted-foreground">Không phụ thuộc</span> : value.map((id) => <Badge key={id} variant="outline" className="px-1.5 py-0 font-mono text-[10px] font-normal tabular-nums">{byId.get(id) ? `${projectKey}-${byId.get(id)!.number}` : "…"}</Badge>)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-1 p-2" align="start">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm ST-… hoặc tiêu đề" className="h-8 text-sm" />
        <div className="max-h-56 overflow-y-auto space-y-0.5">
          {list.slice(0, 50).map((t) => (
            <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-md p-1.5 text-sm hover:bg-muted">
              <Checkbox checked={draft.includes(t.id)} onCheckedChange={(c) => setDraft((d) => (c ? [...d, t.id] : d.filter((x) => x !== t.id)))} />
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {projectKey}-{t.number}
              </span>
              <span className={cn("min-w-0 flex-1 truncate", t.completedAt && "text-muted-foreground line-through")}>{t.title}</span>
            </label>
          ))}
        </div>
        <p className="px-1 pt-1 text-[10px] text-muted-foreground">Đóng để lưu · Gantt vẽ mũi tên theo phụ thuộc</p>
      </PopoverContent>
    </Popover>
  );
}
