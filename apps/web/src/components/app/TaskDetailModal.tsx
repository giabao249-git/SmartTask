"use client";

import * as React from "react";
import { AtSign, ChevronDown, Download, FileText, History, Loader2, Maximize2, MessageSquare, Paperclip, Plus, Sparkles, Trash2, Upload } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
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
      <DialogContent className="w-full sm:max-w-3xl p-0 flex flex-col max-h-[88vh] overflow-hidden gap-0">
        {q.isPending || !taskId ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
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
    <DialogHeader className="p-4 pb-3 border-b border-border/60 space-y-2">{children}</DialogHeader>
  ) : (
    <div className="p-4 pb-3 border-b border-border/60 space-y-2">{children}</div>
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
  const sprints = useSprints(project.id);
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
        <div className={cn("flex items-center gap-2 flex-wrap", variant === "modal" && "pr-8")}>
          <Badge variant="outline" className="font-mono text-xs">
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
          <span className="text-[10px] text-muted-foreground ml-auto font-mono">v{task.version}</span>
          {variant === "modal" && onOpenFullPage && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              aria-label="Mở toàn màn hình"
              title="Mở toàn màn hình (Ctrl+click mã công việc để mở tab mới)"
              onClick={onOpenFullPage}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <TitleWrap variant={variant}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title.trim() !== task.title && patch({ title: title.trim() }, "Đổi tiêu đề")}
            disabled={!project.canEdit || isSaving("title")}
            className="text-base font-semibold h-9 border-transparent hover:border-border focus-visible:border-border px-2"
          />
        </TitleWrap>
        <DescWrap variant={variant}>
          Tạo bởi {task.createdBy.shortName ?? task.createdBy.fullName} · {fmtDay(task.createdAt)} · sửa lần cuối {fmtDay(task.updatedAt)}
        </DescWrap>
      </HeaderWrap>

      <div className="flex-1 overflow-y-auto p-4 text-xs flex flex-col lg:flex-row gap-4 items-start">
        {/* Cột trái: nội dung — mô tả, việc con, bình luận, đính kèm, hoạt động */}
        <div className="flex-1 min-w-0 space-y-4">
        <Field label="Mô tả" saving={isSaving("description")}>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => description !== (task.description ?? "") && patch({ description: description || null }, "Sửa mô tả")}
            disabled={!project.canEdit || isSaving("description")}
            className="text-xs min-h-[90px]"
            placeholder="Mô tả (markdown nhẹ)…"
          />
        </Field>

        <Separator />

        <Tabs defaultValue="subtasks">
          <TabsList className="h-8">
            <TabsTrigger value="subtasks" className="text-xs">
              Việc con ({task.subtasks.length})
            </TabsTrigger>
            <TabsTrigger value="comments" className="text-xs gap-1">
              <MessageSquare className="h-3 w-3" /> Bình luận ({task.commentCount})
            </TabsTrigger>
            <TabsTrigger value="files" className="text-xs gap-1">
              <Paperclip className="h-3 w-3" /> Đính kèm ({task.attachmentCount})
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs gap-1">
              <History className="h-3 w-3" /> Hoạt động
            </TabsTrigger>
          </TabsList>
          <TabsContent value="subtasks" className="space-y-2 pt-2">
            {task.subtasks.map((s) => (
              <div key={s.id} className="flex items-center gap-2 p-2 rounded-md border border-border/60 bg-muted/20">
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
                <span className={cn("flex-1 text-xs", s.completedAt && "line-through text-muted-foreground")}>
                  {taskKeyOf(project.key, s)} · {s.title}
                </span>
                {s.estimateHours != null && <span className="text-[10px] text-muted-foreground font-mono">{s.estimateHours}h</span>}
              </div>
            ))}
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
                <Input name="title" placeholder="Thêm việc con…" className="h-8 text-xs" required />
                <Input name="hours" type="number" step="0.5" min={0} placeholder="giờ" className="h-8 text-xs w-20" />
                <Button type="submit" size="sm" className="h-8 text-xs" disabled={m.subtask.isPending}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </form>
            )}
          </TabsContent>
          <TabsContent value="comments" className="pt-2">
            <CommentsPanel taskId={task.id} project={project} />
          </TabsContent>
          <TabsContent value="files" className="pt-2">
            <AttachmentsPanel taskId={task.id} canEdit={project.canEdit} />
          </TabsContent>
          <TabsContent value="activity" className="pt-2">
            <ActivityList projectId={project.id} taskId={task.id} compact />
          </TabsContent>
        </Tabs>
        </div>

        {/* Cột phải: thuộc tính, gom 3 nhóm; nhóm ít đụng tới nhất thu gọn sẵn (docs 02/05 §D1) */}
        <aside className="w-full lg:w-72 shrink-0 space-y-4 lg:border-l lg:border-border/60 lg:pl-4">
          <PropGroup title="Phân công">
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
                <SelectTrigger className="h-8 text-xs">
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
            </Field>
            <Field label="Sprint" saving={isSaving("sprintId")}>
              <Select
                value={task.sprintId ?? "__backlog"}
                disabled={!project.canEdit || isSaving("sprintId")}
                onValueChange={(v) => patch({ sprintId: v === "__backlog" ? null : v }, "Đổi sprint")}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__backlog" className="text-xs">
                    Backlog
                  </SelectItem>
                  {/* Mọi sprint chưa đóng — trước đây chỉ có sprint đang chạy nên không lên kế hoạch được cho sprint sau */}
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
            </Field>
            <Field label="Ưu tiên" saving={isSaving("priority")}>
              <Select value={task.priority} disabled={!project.canEdit || isSaving("priority")} onValueChange={(priority) => patch({ priority: priority as TaskPriority }, "Đổi ưu tiên")}>
                <SelectTrigger className="h-8 text-xs">
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
            </Field>
            <Field label="Cờ khẩn (gấp về thời gian)" saving={isSaving("isUrgent")}>
              <label
                className="flex items-center gap-2 h-8 text-xs"
                title="Gấp về thời gian — xếp vào ô Làm ngay của ma trận Eisenhower. Khác với mức ưu tiên (mức quan trọng)."
              >
                <Checkbox checked={task.isUrgent} disabled={!project.canEdit || isSaving("isUrgent")} onCheckedChange={(c) => patch({ isUrgent: c === true }, "Đổi cờ khẩn")} />
                Gấp — xếp vào ô &quot;Làm ngay&quot;
              </label>
            </Field>
          </PropGroup>

          <PropGroup title="Thời gian & công sức">
            <NumberField label="Ước lượng (giờ)" value={task.estimateHours} disabled={!project.canEdit || isSaving("estimateHours")} onCommit={(v) => patch({ estimateHours: v }, "Đổi ước lượng")} />
            <NumberField
              label="Giờ còn lại"
              value={task.remainingHours}
              disabled={!project.canEdit || isSaving("remaining")}
              onCommit={(v) => enqueue("remaining", "Cập nhật giờ còn lại", (version) => m.progress.mutateAsync({ id: task.id, version, remainingHours: v ?? undefined }))}
            />
            <Field label={`Tiến độ ${task.progress}%`} saving={isSaving("progress")}>
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
                className="h-8 px-0 border-0 shadow-none"
              />
            </Field>
            <DateField label="Bắt đầu" value={task.startDate} disabled={!project.canEdit || isSaving("startDate")} onCommit={(v) => patch({ startDate: v }, "Đổi ngày bắt đầu")} />
            <DateField label="Hạn" value={task.dueDate} disabled={!project.canEdit || isSaving("dueDate")} onCommit={(v) => patch({ dueDate: v }, "Đổi hạn")} />
          </PropGroup>

          <PropGroup
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
                <SelectTrigger className="h-8 text-xs">
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
                <SelectTrigger className="h-8 text-xs">
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

      {project.canManage && (
        <div className="p-3 border-t border-border/60 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-destructive gap-1.5"
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

/** Nhóm thuộc tính ở cột phải; `collapsible` cho nhóm ít đụng tới nhất, có đếm số đã đặt. */
function PropGroup({
  title,
  children,
  collapsible = false,
  count = 0,
}: {
  title: string;
  children: React.ReactNode;
  collapsible?: boolean;
  count?: number;
}) {
  const [open, setOpen] = React.useState(!collapsible);
  return (
    <div className="space-y-2">
      {collapsible ? (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-full justify-between px-0 text-[11px] font-semibold text-muted-foreground hover:bg-transparent">
              <span>
                {title}
                {count > 0 && <span className="ml-1 font-normal">· {count}</span>}
              </span>
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2">{children}</CollapsibleContent>
        </Collapsible>
      ) : (
        <>
          <div className="text-[11px] font-semibold text-muted-foreground">{title}</div>
          <div className="space-y-3">{children}</div>
        </>
      )}
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
        className="h-8 text-xs font-mono"
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
        className="h-8 text-xs"
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
            <div key={c.id} className="flex gap-2 p-2 rounded-md border border-border/60 bg-muted/20">
              <UserAvatar name={c.author.shortName ?? c.author.fullName} avatar={c.author.avatarUrl ?? undefined} size="sm" showTooltip={false} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{c.author.fullName}</span>
                  <span>{fmtDay(c.createdAt)}</span>
                  {c.mentions.length > 0 && <span>· nhắc {c.mentions.map((u) => u.shortName ?? u.fullName).join(", ")}</span>}
                  {project.canManage && (
                    <Button variant="ghost" size="icon" className="h-4 w-4 ml-auto text-muted-foreground hover:text-destructive" onClick={() => mut.remove.mutate(c.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <p className="text-xs whitespace-pre-wrap">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {project.canEdit && (
        <div className="space-y-1.5 relative">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Viết bình luận… gõ @ để nhắc thành viên" className="text-xs min-h-[64px]" />
          {at && suggest.data && suggest.data.length > 0 && (
            <div className="absolute left-0 right-0 z-10 rounded-md border border-border bg-popover shadow-md p-1 text-xs">
              {suggest.data.map((u) => (
                <Button key={u.id} variant="ghost" size="sm" onClick={() => pick(u)} className="w-full justify-start h-7 gap-2 text-xs">
                  <AtSign className="h-3 w-3 text-info" /> {u.fullName}
                  {u.email && <span className="text-muted-foreground">{u.email}</span>}
                </Button>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 flex-wrap">
              {mentions.map((u) => (
                <Badge key={u.id} variant="info" className="text-[10px] gap-1">
                  @{u.name}
                </Badge>
              ))}
            </div>
            <Button
              size="sm"
              className="h-7 text-xs"
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
          <div key={a.id} className="flex items-center gap-2 p-2 rounded-md border border-border/60 bg-muted/20 text-xs">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 truncate">{a.fileName}</span>
            <span className="text-[10px] text-muted-foreground font-mono">{(a.sizeBytes / 1024).toFixed(0)} KB</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() =>
                void downloadAttachment(a.id)
                  .then((url) => window.open(url, "_blank", "noopener"))
                  .catch((e) => toast.error(describeError(e).message))
              }
            >
              <Download className="h-3 w-3" />
            </Button>
            {canEdit && (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => del.mutate(a.id, { onError: (e) => toast.error(describeError(e).message) })}>
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
        <Button variant="outline" size="sm" disabled={disabled} className="h-8 w-full justify-start gap-1 text-xs font-normal overflow-hidden">
          {value.length === 0 ? <span className="text-muted-foreground">Không phụ thuộc</span> : value.map((id) => <Badge key={id} variant="outline" className="text-[10px] px-1 py-0 font-mono font-normal">{byId.get(id) ? `${projectKey}-${byId.get(id)!.number}` : "…"}</Badge>)}
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
