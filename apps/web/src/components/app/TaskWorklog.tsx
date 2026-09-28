"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bug, Clock, Loader2, Pencil, Star, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/app/UserAvatar";
import { useTasks } from "@/features/board/hooks";
import { api, describeError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ProjectDetail, TaskDetail, TaskReviewView, WorklogView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const hrs = (n: number) => `${(Math.round(n * 100) / 100).toLocaleString("vi-VN")} h`;
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const fail = (e: unknown, what: string) => {
  const { code, message } = describeError(e);
  const fields = (e as { details?: { fields?: string[] } })?.details?.fields;
  toast.error(`${what}: ${fields?.[0] ?? message}`, { description: code });
};

/**
 * Giờ làm thực tế (UC-35). Là bằng chứng cho hồ sơ kỹ năng & hệ số ước lượng (docs 02/08) — trước đây không
 * có chỗ ghi nên "thực tế" luôn phải suy từ thời gian nằm ở cột Đang làm.
 */
export function WorklogPanel({ task, project }: { task: TaskDetail; project: ProjectDetail }) {
  const qc = useQueryClient();
  const me = useAuth().user?.id;
  const key = ["tasks", task.id, "time-entries"];
  const q = useQuery({ queryKey: key, queryFn: () => api.get<WorklogView>(`/tasks/${task.id}/time-entries`) });
  const canLog = project.canManage || (project.canEdit && task.assignees.some((a) => a.id === me));
  const [date, setDate] = React.useState(today());
  const [hours, setHours] = React.useState("");
  const [note, setNote] = React.useState("");
  const set = (v: WorklogView) => {
    qc.setQueryData(key, v);
    void qc.invalidateQueries({ queryKey: ["projects", project.id, "skill-profiles"] });
  };
  const add = useMutation({
    mutationFn: () => api.post<WorklogView>(`/tasks/${task.id}/time-entries`, { workDate: date, hours: Number(hours), note: note.trim() || undefined }),
    onSuccess: (v) => {
      set(v);
      setHours("");
      setNote("");
    },
    onError: (e) => fail(e, "Không ghi được giờ"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete<WorklogView>(`/time-entries/${id}`),
    onSuccess: set,
    onError: (e) => fail(e, "Không xoá được"),
  });
  const edit = useMutation({
    mutationFn: (v: { id: string; hours: number }) => api.patch<WorklogView>(`/time-entries/${v.id}`, { hours: v.hours }),
    onSuccess: set,
    onError: (e) => fail(e, "Không sửa được"),
  });

  if (q.isPending) return <Skeleton className="h-24 w-full" />;
  if (q.isError) return <p className="text-xs text-destructive">{describeError(q.error).message}</p>;
  const w = q.data;
  const over = w.estimateHours != null && w.totalHours > w.estimateHours;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-foreground">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="tabular-nums">
          Đã ghi <strong>{hrs(w.totalHours)}</strong>
          {w.estimateHours != null && <> / ước lượng {hrs(w.estimateHours)}</>}
        </span>
        {over && (
          <Badge variant="warning" className="text-[10px] px-1.5 py-0">
            vượt ước lượng
          </Badge>
        )}
      </div>

      {w.entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">Chưa ai ghi giờ cho việc này.</p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-md border border-border/60">
          {w.entries.map((e) => (
            <li key={e.id} className="flex items-center gap-2 px-2.5 py-1.5 text-xs min-w-0">
              <UserAvatar name={e.user.shortName ?? e.user.fullName} avatar={e.user.avatarUrl ?? undefined} size="sm" showTooltip={false} />
              <span className="w-12 shrink-0 tabular-nums text-muted-foreground">{dm(e.workDate)}</span>
              <span className="flex-1 min-w-0 truncate" title={e.note ?? undefined}>
                {e.user.shortName ?? e.user.fullName}
                {e.note ? <span className="text-muted-foreground"> · {e.note}</span> : null}
              </span>
              {e.canEdit ? <HoursEditor value={e.hours} busy={edit.isPending} onCommit={(h) => edit.mutate({ id: e.id, hours: h })} /> : <span className="tabular-nums shrink-0">{hrs(e.hours)}</span>}
              {e.canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  aria-label="Xoá dòng giờ"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(e.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canLog ? (
        <form
          className="grid grid-cols-[8.5rem_4.5rem_minmax(0,1fr)_auto] gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (Number(hours) > 0) add.mutate();
          }}
        >
          <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className="h-8 text-xs" aria-label="Ngày làm" />
          <Input type="number" step="0.25" min={0.25} max={24} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="giờ" className="h-8 text-xs" aria-label="Số giờ" required />
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú (tuỳ chọn)" maxLength={500} className="h-8 text-xs" />
          <Button type="submit" size="sm" className="h-8 text-xs" disabled={add.isPending || !(Number(hours) > 0)}>
            {add.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Ghi giờ"}
          </Button>
        </form>
      ) : (
        <p className="text-[11px] text-muted-foreground">Chỉ người được giao hoặc PM ghi giờ cho việc này.</p>
      )}
    </div>
  );
}

function HoursEditor({ value, busy, onCommit }: { value: number; busy: boolean; onCommit: (h: number) => void }) {
  const [v, setV] = React.useState(String(value));
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs tabular-nums gap-1" disabled={busy}>
          {hrs(value)} <Pencil className="h-3 w-3 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-2" align="end">
        <form
          className="flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(v);
            if (n > 0 && n !== value) onCommit(n);
            setOpen(false);
          }}
        >
          <Input type="number" step="0.25" min={0.25} max={24} value={v} onChange={(e) => setV(e.target.value)} className="h-7 text-xs" autoFocus aria-label="Số giờ" />
          <Button type="submit" size="sm" className="h-7 text-xs">
            Lưu
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

const RATING_TEXT: Record<number, string> = {
  1: "Phải làm lại phần lớn",
  2: "Chưa đạt, sửa nhiều",
  3: "Đạt yêu cầu",
  4: "Tốt",
  5: "Rất tốt, vượt kỳ vọng",
};

/**
 * Đánh giá việc đã xong (UC-36) — nguồn "feedback" duy nhất của hồ sơ kỹ năng. Chỉ PM chấm; người được giao
 * và PM xem được; người khác không thấy nội dung (docs 04 §2).
 */
export function ReviewCard({ task, project }: { task: TaskDetail; project: ProjectDetail }) {
  const qc = useQueryClient();
  const key = ["tasks", task.id, "review"];
  const q = useQuery({ queryKey: key, queryFn: () => api.get<TaskReviewView>(`/tasks/${task.id}/review`), enabled: !!task.completedAt });
  const logged = useQuery({ queryKey: ["tasks", task.id, "time-entries"], queryFn: () => api.get<WorklogView>(`/tasks/${task.id}/time-entries`), enabled: !!task.completedAt });
  const [editing, setEditing] = React.useState(false);
  const [rating, setRating] = React.useState(0);
  const [diff, setDiff] = React.useState(String(task.difficulty));
  const [actual, setActual] = React.useState("");
  const [comment, setComment] = React.useState("");
  const r = q.data?.review;
  React.useEffect(() => {
    setRating(r?.rating ?? 0);
    setDiff(String(r?.difficultyActual ?? task.difficulty));
    setActual(r?.actualHoursConfirmed != null ? String(r.actualHoursConfirmed) : logged.data?.totalHours ? String(logged.data.totalHours) : "");
    setComment(r?.comment ?? "");
  }, [r, task.difficulty, logged.data?.totalHours]);
  const save = useMutation({
    mutationFn: () =>
      api.put<TaskReviewView>(`/tasks/${task.id}/review`, {
        rating,
        difficultyActual: Number(diff),
        actualHoursConfirmed: actual ? Number(actual) : undefined,
        comment: comment.trim() || undefined,
      }),
    onSuccess: (v) => {
      qc.setQueryData(key, v);
      void qc.invalidateQueries({ queryKey: ["projects", project.id, "skill-profiles"] });
      setEditing(false);
      toast.success("Đã lưu đánh giá", { description: "Hồ sơ kỹ năng của người làm được tính lại từ đánh giá này." });
    },
    onError: (e) => fail(e, "Không lưu được đánh giá"),
  });

  if (!task.completedAt) return null;
  if (q.isPending) return <Skeleton className="h-16 w-full" />;
  if (!q.data || !q.data.visible) return null;
  const showForm = q.data.canReview && (editing || !r);

  return (
    <div className="rounded-md border border-border/70 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-muted-foreground" /> Đánh giá khi xong
        </p>
        {r && q.data.canReview && !editing && (
          <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => setEditing(true)}>
            Sửa
          </Button>
        )}
      </div>

      {!showForm && r && (
        <div className="space-y-1 text-xs text-foreground">
          <p>
            <Stars value={r.rating} /> <span className="ml-1">{RATING_TEXT[r.rating]}</span>
          </p>
          <p className="text-muted-foreground tabular-nums">
            Độ khó thực tế {r.difficultyActual}/5 (kế hoạch {task.difficulty}/5)
            {r.actualHoursConfirmed != null && <> · giờ thực tế {hrs(r.actualHoursConfirmed)}</>} · {r.reviewer.shortName ?? r.reviewer.fullName}
          </p>
          {r.comment && <p className="whitespace-pre-wrap">{r.comment}</p>}
          {r.selfReview && <p className="text-[11px] text-muted-foreground">Tự chấm việc của mình — không tính vào hồ sơ kỹ năng.</p>}
        </div>
      )}
      {!showForm && !r && <p className="text-xs text-muted-foreground">PM chưa đánh giá việc này.</p>}

      {showForm && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (rating) save.mutate();
          }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex" role="radiogroup" aria-label="Chất lượng">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} — ${RATING_TEXT[n]}`} onClick={() => setRating(n)} className="p-0.5">
                  <Star className={cn("h-5 w-5", n <= rating ? "fill-warning text-warning" : "text-muted-foreground/50")} />
                </button>
              ))}
            </div>
            <span className="text-xs text-foreground">{rating ? RATING_TEXT[rating] : "Chọn mức chất lượng"}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-[11px] text-muted-foreground">
              Độ khó thực tế
              <Select value={diff} onValueChange={setDiff}>
                <SelectTrigger className="h-8 text-xs text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((d) => (
                    <SelectItem key={d} value={String(d)} className="text-xs">
                      {d}
                      {d === task.difficulty ? " (như kế hoạch)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1 text-[11px] text-muted-foreground">
              Giờ thực tế
              <Input
                type="number"
                step="0.25"
                min={0}
                max={400}
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                placeholder={logged.data?.totalHours ? `đã ghi ${logged.data.totalHours}` : "giờ"}
                className="h-8 text-xs text-foreground"
              />
            </label>
          </div>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Nhận xét cho người làm (tuỳ chọn)" maxLength={1000} className="text-xs min-h-[56px]" />
          <div className="flex justify-end gap-2">
            {r && (
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditing(false)}>
                Huỷ
              </Button>
            )}
            <Button type="submit" size="sm" className="h-7 text-xs" disabled={!rating || save.isPending}>
              {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Lưu đánh giá
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex align-middle" aria-label={`${value}/5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("h-3.5 w-3.5", n <= value ? "fill-warning text-warning" : "text-muted-foreground/40")} />
      ))}
    </span>
  );
}

/** BUG → việc gốc (chọn một). Chỉ hiện với task loại BUG. */
export function OriginPicker({ task, project, disabled, onChange }: { task: TaskDetail; project: ProjectDetail; disabled: boolean; onChange: (id: string | null) => void }) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const tasks = useTasks(project.id, {}, { enabled: open });
  const list = (tasks.data ?? []).filter((t) => t.id !== task.id && t.type !== "BUG").filter((t) => !q || `${project.key}-${t.number} ${t.title}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="h-8 w-full justify-start gap-1 text-xs font-normal overflow-hidden">
          {task.origin ? (
            <span className="truncate">
              <span className="font-mono text-muted-foreground mr-1">{task.origin.key}</span>
              {task.origin.title}
            </span>
          ) : (
            <span className="text-muted-foreground">Chưa gắn</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2 space-y-1" align="start">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm ST-… hoặc tiêu đề" className="h-7 text-xs" autoFocus />
        <div className="max-h-56 overflow-y-auto space-y-0.5">
          {task.origin && (
            <button
              type="button"
              className="w-full text-left p-1 rounded hover:bg-muted text-xs text-muted-foreground"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              Gỡ liên kết
            </button>
          )}
          {list.slice(0, 50).map((t) => (
            <button
              key={t.id}
              type="button"
              className={cn("w-full flex items-center gap-2 p-1 rounded hover:bg-muted text-xs text-left", task.origin?.id === t.id && "bg-muted")}
              onClick={() => {
                if (task.origin?.id !== t.id) onChange(t.id);
                setOpen(false);
              }}
            >
              <span className="font-mono text-muted-foreground shrink-0">
                {project.key}-{t.number}
              </span>
              <span className="flex-1 truncate">{t.title}</span>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground px-1 pt-1">Việc gốc được tính là &quot;phải làm lại&quot; trong hồ sơ kỹ năng của người làm.</p>
      </PopoverContent>
    </Popover>
  );
}

/** Danh sách bug phát sinh từ việc này. */
export function DerivedBugs({ task, projectId }: { task: TaskDetail; projectId: string }) {
  if (!task.derivedBugs?.length) return null;
  return (
    <div className="rounded-md border border-border/70 p-3 space-y-1.5">
      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
        <Bug className="h-3.5 w-3.5 text-destructive" /> Bug phát sinh từ việc này ({task.derivedBugs.length})
      </p>
      <ul className="space-y-1">
        {task.derivedBugs.map((b) => (
          <li key={b.id} className="text-xs flex items-center gap-2 min-w-0">
            <Link href={`/projects/${projectId}/tasks/${b.key}`} className="font-mono text-muted-foreground hover:underline shrink-0">
              {b.key}
            </Link>
            <span className={cn("truncate", b.done && "line-through text-muted-foreground")}>{b.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
