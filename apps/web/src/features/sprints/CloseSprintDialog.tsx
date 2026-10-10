"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/app/UserAvatar";
import { api } from "@/lib/api";
import { sprintStatusLabel } from "@/lib/status";
import type { SprintSummaryView, SprintView } from "@/lib/types";
import { toast } from "sonner";
import { defaults } from "./SprintFormDialog";
import { hrs, toastSprintError } from "./shared";

const NEW = "__new";

/**
 * Kết thúc sprint nói TRƯỚC điều sẽ xảy ra (docs 02/07 B2, theo cơ chế "Complete sprint" của Jira): bao nhiêu việc
 * xong, việc nào chưa xong sẽ đi đâu, và cho tạo luôn sprint kế tiếp làm đích. Trước đây hộp thoại chỉ ghi
 * "30.6 h còn lại" rồi toast "Đã kết thúc sprint" — không ai biết 7 việc đã về backlog.
 */
export function CloseSprintDialog({
  sprint,
  sprints,
  summary,
  members,
  open,
  onOpenChange,
  onClosed,
}: {
  sprint: SprintView;
  sprints: SprintView[];
  summary: SprintSummaryView | undefined;
  members: { id: string; fullName: string; shortName: string | null; avatarUrl: string | null }[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onClosed: (movedTo: string | null) => void;
}) {
  const targets = sprints.filter((s) => s.id !== sprint.id && s.status !== "CLOSED");
  const [moveTo, setMoveTo] = React.useState<string>("backlog");
  const [draft, setDraft] = React.useState(() => defaults(sprints));
  // Một khoá cho mỗi lần mở hộp thoại: bấm "Kết thúc" hai lần vì mạng chậm vẫn chỉ đóng một lần
  const [key, setKey] = React.useState("");
  React.useEffect(() => {
    if (!open) return;
    setMoveTo(targets.find((s) => s.status === "PLANNED")?.id ?? "backlog");
    setDraft(defaults(sprints));
    setKey(crypto.randomUUID());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = useMutation({
    mutationFn: async () => {
      let target = moveTo;
      if (moveTo === NEW) {
        const created = await api.post<SprintView>(`/projects/${sprint.projectId}/sprints`, { name: draft.name.trim(), startDate: draft.startDate, endDate: draft.endDate });
        target = created.id;
      }
      const r = await api.post<SprintView & { movedTaskIds: string[] }>(`/sprints/${sprint.id}/close`, { moveOpenTo: target }, { headers: { "Idempotency-Key": key } });
      return { r, target };
    },
    onSuccess: ({ r, target }) => {
      const dest = target === "backlog" ? "Backlog" : (sprints.find((s) => s.id === target)?.name ?? draft.name);
      toast.success(`Đã kết thúc ${sprint.name}`, {
        description: r.movedTaskIds.length ? `${r.movedTaskIds.length} việc chưa xong đã chuyển về ${dest}.` : "Không còn việc dở.",
      });
      onOpenChange(false);
      onClosed(target === "backlog" ? null : target);
    },
    onError: toastSprintError,
  });

  const open_ = summary?.open ?? [];
  const nameOf = (id: string) => {
    const m = members.find((x) => x.id === id);
    return m ? { name: m.shortName ?? m.fullName, avatar: m.avatarUrl ?? undefined } : null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* DialogContent là grid: con phải min-w-0, nếu không danh sách tiêu đề dài đẩy nội dung tràn khỏi khung */}
      <DialogContent className="sm:max-w-lg [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle>Kết thúc {sprint.name}?</DialogTitle>
          <DialogDescription>Việc đã xong ở lại sprint này để xem lại trong báo cáo; việc chưa xong được chuyển đi.</DialogDescription>
        </DialogHeader>

        {!summary ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border border-border/70 p-3">
                <div className="text-xs text-muted-foreground">Đã xong</div>
                <div className="text-lg font-semibold tabular-nums">
                  {summary.doneCount} việc · {hrs(summary.completedHours)}
                </div>
              </div>
              <div className="rounded-md border border-border/70 p-3">
                <div className="text-xs text-muted-foreground">Chưa xong — sẽ chuyển đi</div>
                <div className="text-lg font-semibold tabular-nums">
                  {open_.length} việc · {hrs(summary.remainingHours)}
                </div>
                <div className="text-xs text-muted-foreground">còn lại (ước lượng {hrs(open_.reduce((s, t) => s + t.estimateHours, 0))})</div>
              </div>
            </div>

            {open_.length > 0 && (
              <ScrollArea className="rounded-md border border-border/70 [&>[data-radix-scroll-area-viewport]]:max-h-48 [&>[data-radix-scroll-area-viewport]>div]:!block">
                <ul className="divide-y divide-border/60 text-sm">
                  {open_.map((t) => {
                    const who = t.assigneeIds.map(nameOf).filter((x): x is NonNullable<typeof x> => !!x);
                    return (
                      <li key={t.id} className="flex items-center gap-3 px-3 py-2 min-w-0">
                        <span className="font-mono text-xs text-muted-foreground shrink-0">{t.key}</span>
                        <span className="flex-1 min-w-0 truncate" title={t.title}>
                          {t.title}
                        </span>
                        {who[0] ? <UserAvatar name={who[0].name} avatar={who[0].avatar} size="sm" /> : <span className="text-xs text-muted-foreground shrink-0">chưa giao</span>}
                        <span className="w-12 text-right tabular-nums text-muted-foreground shrink-0">{hrs(t.remainingHours)}</span>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            )}

            {open_.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="close-target">
                  Chuyển việc chưa xong tới
                </label>
                <Select value={moveTo} onValueChange={setMoveTo}>
                  <SelectTrigger id="close-target">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="backlog">Backlog</SelectItem>
                    {targets.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} · {sprintStatusLabel(s.status)}
                      </SelectItem>
                    ))}
                    <SelectItem value={NEW}>Sprint mới…</SelectItem>
                  </SelectContent>
                </Select>
                {moveTo === NEW && (
                  <div className="grid grid-cols-2 sm:grid-cols-[minmax(0,1fr)_9.5rem_9.5rem] gap-2 pt-1">
                    <Input aria-label="Tên sprint mới" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={60} className="col-span-2 sm:col-span-1" />
                    <Input aria-label="Bắt đầu" type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} className="w-full" />
                    <Input aria-label="Kết thúc" type="date" value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} className="w-full" />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button onClick={() => close.mutate()} disabled={!summary || close.isPending || (moveTo === NEW && (!draft.name.trim() || draft.startDate > draft.endDate))} className="gap-1.5">
            {close.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />} Kết thúc sprint
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
