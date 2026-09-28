"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { percentToWorkload } from "@/lib/status";
import type { SprintSummaryView, SprintView } from "@/lib/types";
import { toast } from "sonner";
import { dm, hrs, localIso, overlapping, toastSprintError } from "./shared";

/**
 * Bắt đầu sprint là một QUYẾT ĐỊNH (docs 02/07 B1): trước đây nút ▷ chạy luôn, không hỏi lại — kịch bản đo đã
 * bấm nhầm sprint. Hộp thoại chốt mục tiêu + ngày và cho thấy số việc, giờ cam kết so với năng lực; các cảnh báo
 * chỉ để người quyết định biết, không chặn (trừ khi đang có sprint khác chạy — API trả 409).
 */
export function StartSprintDialog({
  sprint,
  sprints,
  summary,
  open,
  onOpenChange,
  onStarted,
  onOpenSprint,
}: {
  sprint: SprintView;
  sprints: SprintView[];
  summary: SprintSummaryView | undefined;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onStarted: () => void;
  onOpenSprint: (id: string) => void;
}) {
  const today = localIso(new Date());
  const [goal, setGoal] = React.useState(sprint.goal ?? "");
  const [startDate, setStartDate] = React.useState(today);
  const [endDate, setEndDate] = React.useState(sprint.endDate.slice(0, 10));
  React.useEffect(() => {
    if (!open) return;
    setGoal(sprint.goal ?? "");
    // Burn-down tính từ ngày bắt đầu: bắt đầu hôm nay thì ngày bắt đầu phải là hôm nay (L7 của đề xuất)
    setStartDate(today);
    setEndDate(sprint.endDate.slice(0, 10));
  }, [open, sprint, today]);

  const running = sprints.find((s) => s.status === "ACTIVE" && s.id !== sprint.id);
  const clash = overlapping(sprints, startDate, endDate, sprint.id);
  const planned = sprint.startDate.slice(0, 10);

  const start = useMutation({
    mutationFn: async () => {
      const changed = goal.trim() !== (sprint.goal ?? "") || startDate !== planned || endDate !== sprint.endDate.slice(0, 10);
      if (changed) await api.patch(`/sprints/${sprint.id}`, { goal: goal.trim() || undefined, startDate, endDate });
      return api.post<SprintView>(`/sprints/${sprint.id}/start`, {});
    },
    onSuccess: (s) => {
      toast.success(`${s.name} đã bắt đầu`, { description: summary ? `Phạm vi chốt ${hrs(summary.scopeHours)} — đường lý tưởng của burn-down tính từ con số này.` : undefined });
      onOpenChange(false);
      onStarted();
    },
    onError: toastSprintError,
  });

  const load = summary?.scopeHours ?? 0;
  const cap = summary?.capacityHours ?? 0;
  const pct = cap > 0 ? Math.round((load / cap) * 100) : 0;
  const level = percentToWorkload(pct);
  const warnings = [
    summary && summary.taskCount === 0 ? "Sprint chưa có việc nào — phạm vi chốt sẽ là 0 h." : null,
    summary && load > cap ? `Giờ cam kết vượt năng lực nhóm ${hrs(load - cap)}.` : null,
    summary && summary.unassigned.tasks ? `${summary.unassigned.tasks} việc chưa giao (${hrs(summary.unassigned.hours)}).` : null,
    clash ? `Trùng ngày với ${clash.name} (${dm(clash.startDate)} → ${dm(clash.endDate)}).` : null,
    startDate !== planned ? `Kế hoạch ghi bắt đầu ${dm(planned)}; burn-down sẽ tính từ ${dm(startDate)}.` : null,
  ].filter((x): x is string => !!x);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bắt đầu {sprint.name}?</DialogTitle>
          <DialogDescription>Bắt đầu sẽ chốt phạm vi giờ làm đường lý tưởng cho burn-down. Mỗi dự án chỉ chạy một sprint.</DialogDescription>
        </DialogHeader>

        {running ? (
          <div className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm space-y-2">
            <p className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                <strong>{running.name}</strong> đang chạy. Kết thúc nó trước rồi mới bắt đầu {sprint.name} được.
              </span>
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onOpenSprint(running.id);
              }}
            >
              Mở {running.name}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {summary ? (
              <div className="rounded-md border border-border/70 p-3 text-sm space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span>
                    <strong className="tabular-nums">{summary.taskCount}</strong> việc · cam kết <strong className="tabular-nums">{hrs(load)}</strong> / năng lực nhóm{" "}
                    <strong className="tabular-nums">{hrs(cap)}</strong>
                  </span>
                  <Badge variant={level.variant} className="tabular-nums shrink-0">
                    {pct}%
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Năng lực tính trong cửa sổ {dm(summary.window.from)} → {dm(summary.window.to)}.
                </p>
              </div>
            ) : (
              <Skeleton className="h-16 w-full" />
            )}
            <div className="space-y-1.5">
              <label htmlFor="start-goal" className="text-sm font-medium">
                Mục tiêu sprint
              </label>
              <Textarea id="start-goal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Sprint này xong thì người dùng làm được gì?" className="min-h-[64px]" maxLength={1000} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="start-from" className="text-sm font-medium">
                  Bắt đầu
                </label>
                <Input id="start-from" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="start-to" className="text-sm font-medium">
                  Kết thúc
                </label>
                <Input id="start-to" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            {warnings.length > 0 && (
              <ul className="space-y-1 text-sm">
                {warnings.map((w) => (
                  <li key={w} className="flex items-start gap-2 text-muted-foreground">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-warning" /> {w}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button onClick={() => start.mutate()} disabled={!!running || start.isPending || startDate > endDate} className="gap-1.5">
            {start.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Bắt đầu sprint
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
