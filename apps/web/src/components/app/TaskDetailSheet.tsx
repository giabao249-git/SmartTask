"use client";

import * as React from "react";
import { AtSign, Download, FileText, Loader2, MessageSquare, Paperclip, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorState } from "@/components/app/ErrorState";
import { UserAvatar } from "@/components/app/UserAvatar";
import { PriorityBadge } from "@/components/app/PriorityBadge";
import { describeError } from "@/lib/api";
import type { ProjectDetail, TaskDetail, TaskPriority } from "@/lib/types";
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

export interface TaskDetailSheetProps {
  taskId: string | null;
  project: ProjectDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Chi tiết task từ GET /tasks/:id — sửa trường qua PATCH có version (409 → toast + tải lại), subtask, bình luận @mention, đính kèm. */
export function TaskDetailSheet({ taskId, project, open, onOpenChange }: TaskDetailSheetProps) {
  const q = useTask(open ? taskId : null);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col overflow-hidden">
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
          <TaskBody task={q.data} project={project} onRefresh={() => q.refetch()} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function TaskBody({ task, project, onRefresh }: { task: TaskDetail; project: ProjectDetail; onRefresh: () => void }) {
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
    toast.error(`${what} thất bại`, { description: `${code}: ${message}` });
  };
  const patch = (fields: Record<string, unknown>, what = "Cập nhật") =>
    m.update.mutate({ id: task.id, version: task.version, patch: fields }, { onSuccess: () => toast.success(`${what} xong`), onError: (e) => fail(e, what) });
  const busy = m.update.isPending || m.assignees.isPending || m.move.isPending || m.progress.isPending;
  const doneColumn = project.columns.find((c) => c.isDone);

  return (
    <>
      <SheetHeader className="p-4 pb-3 border-b border-border/60 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="font-mono text-xs">
            {taskKeyOf(project.key, task)}
          </Badge>
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
        </div>
        <SheetTitle className="text-left">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title.trim() !== task.title && patch({ title: title.trim() }, "Đổi tiêu đề")}
            disabled={!project.canEdit || busy}
            className="text-base font-semibold h-9 border-transparent hover:border-border focus-visible:border-border px-2"
          />
        </SheetTitle>
        <SheetDescription className="text-left text-[11px]">
          Tạo bởi {task.createdBy.shortName ?? task.createdBy.fullName} · {fmtDay(task.createdAt)} · sửa lần cuối {fmtDay(task.updatedAt)}
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Thuộc tính */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Trạng thái (cột)">
            <Select
              value={task.columnId}
              disabled={!project.canEdit || busy}
              onValueChange={(columnId) => m.move.mutate({ id: task.id, version: task.version, columnId }, { onSuccess: () => toast.success("Đã chuyển cột"), onError: (e) => fail(e, "Chuyển cột") })}
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
          <Field label="Ưu tiên">
            <Select value={task.priority} disabled={!project.canEdit || busy} onValueChange={(priority) => patch({ priority: priority as TaskPriority }, "Đổi ưu tiên")}>
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
          <Field label="Người thực hiện">
            <AssigneePicker
              value={task.assignees.map((a) => a.id)}
              members={project.members}
              disabled={!project.canEdit || busy}
              onChange={(userIds) => m.assignees.mutate({ id: task.id, version: task.version, userIds }, { onSuccess: () => toast.success("Đã đổi người thực hiện"), onError: (e) => fail(e, "Giao việc") })}
            />
          </Field>
          <Field label="Sprint">
            <Select
              value={task.sprintId ?? "__backlog"}
              disabled={!project.canEdit || busy}
              onValueChange={(v) => patch({ sprintId: v === "__backlog" ? null : v }, "Đổi sprint")}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__backlog" className="text-xs">
                  Backlog
                </SelectItem>
                {project.activeSprint && (
                  <SelectItem value={project.activeSprint.id} className="text-xs">
                    {project.activeSprint.name} (đang chạy)
                  </SelectItem>
                )}
                {task.sprint && task.sprint.id !== project.activeSprint?.id && (
                  <SelectItem value={task.sprint.id} className="text-xs">
                    {task.sprint.name}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </Field>
          <NumberField label="Ước lượng (giờ)" value={task.estimateHours} disabled={!project.canEdit || busy} onCommit={(v) => patch({ estimateHours: v }, "Đổi ước lượng")} />
          <NumberField
            label="Giờ còn lại"
            value={task.remainingHours}
            disabled={!project.canEdit || busy}
            onCommit={(v) => m.progress.mutate({ id: task.id, version: task.version, remainingHours: v ?? undefined }, { onSuccess: () => toast.success("Đã cập nhật giờ còn lại"), onError: (e) => fail(e, "Cập nhật") })}
          />
          <DateField label="Bắt đầu" value={task.startDate} disabled={!project.canEdit || busy} onCommit={(v) => patch({ startDate: v }, "Đổi ngày bắt đầu")} />
          <DateField label="Hạn" value={task.dueDate} disabled={!project.canEdit || busy} onCommit={(v) => patch({ dueDate: v }, "Đổi hạn")} />
          <Field label="Độ khó (1–5)">
            <Select value={String(task.difficulty)} disabled={!project.canEdit || busy} onValueChange={(v) => patch({ difficulty: Number(v) }, "Đổi độ khó")}>
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
          <Field label={`Tiến độ ${task.progress}%`}>
            <Input
              type="range"
              min={0}
              max={100}
              step={5}
              defaultValue={task.progress}
              disabled={!project.canEdit || busy}
              onMouseUp={(e) => {
                const v = Number((e.target as HTMLInputElement).value);
                if (v !== task.progress) m.progress.mutate({ id: task.id, version: task.version, progress: v }, { onError: (err) => fail(err, "Cập nhật tiến độ") });
              }}
              className="h-8 px-0 border-0 shadow-none"
            />
          </Field>
        </div>

        {task.requiredSkills.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Kỹ năng</span>
            {task.requiredSkills.map((s) => (
              <Badge key={s.id} variant="outline" className="text-[10px]">
                {s.name} ≥ {s.minLevel}
              </Badge>
            ))}
          </div>
        )}

        <Field label="Mô tả">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => description !== (task.description ?? "") && patch({ description: description || null }, "Sửa mô tả")}
            disabled={!project.canEdit || busy}
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
        </Tabs>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
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

function AssigneePicker({ value, members, disabled, onChange }: { value: string[]; members: ProjectDetail["members"]; disabled: boolean; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<string[]>(value);
  React.useEffect(() => setDraft(value), [value]);
  const selected = members.filter((m) => value.includes(m.id));
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o && JSON.stringify([...draft].sort()) !== JSON.stringify([...value].sort())) onChange(draft);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="h-8 w-full justify-start gap-1.5 text-xs font-normal">
          {selected.length === 0 ? (
            <span className="text-muted-foreground">Chưa giao</span>
          ) : (
            <>
              <div className="flex -space-x-1.5">
                {selected.slice(0, 3).map((m) => (
                  <UserAvatar key={m.id} name={m.shortName ?? m.fullName} avatar={m.avatarUrl ?? undefined} size="sm" showTooltip={false} className="ring-2 ring-background" />
                ))}
              </div>
              <span className="truncate">{selected.map((m) => m.shortName ?? m.fullName).join(", ")}</span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 space-y-1" align="start">
        {members.map((m) => (
          <label key={m.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer text-xs">
            <Checkbox checked={draft.includes(m.id)} onCheckedChange={(c) => setDraft((d) => (c ? [...d, m.id] : d.filter((x) => x !== m.id)))} />
            <UserAvatar name={m.shortName ?? m.fullName} avatar={m.avatarUrl ?? undefined} size="sm" showTooltip={false} />
            <span className="flex-1 truncate">{m.fullName}</span>
            <span className="text-[10px] text-muted-foreground">{m.role}</span>
          </label>
        ))}
        <p className="text-[10px] text-muted-foreground px-1 pt-1">Đóng để lưu</p>
      </PopoverContent>
    </Popover>
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

