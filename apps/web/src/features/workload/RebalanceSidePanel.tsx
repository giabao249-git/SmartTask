"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CheckSquare,
  RefreshCw,
  Scale,
  Sparkles,
  Square,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/app/UserAvatar";
import { api, describeError } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface RebalanceMove {
  taskId: string;
  taskKey: string;
  taskTitle: string;
  estimateHours: number;
  priority: string;
  fromUserId: string;
  fromUserName: string;
  fromUserAvatar: string | null;
  fromCurrentLoad: number;
  fromNewLoad: number;
  toUserId: string;
  toUserName: string;
  toUserAvatar: string | null;
  toCurrentLoad: number;
  toNewLoad: number;
  reason: string;
  matchingSkills: string[];
}

export interface WeekSummaryItem {
  weekIndex: number;
  weekStart: string;
  overloadedCount: number;
}

export interface RebalanceResponse {
  summary: string;
  weekIndex: number;
  weekStart: string | null;
  weeksSummary: WeekSummaryItem[];
  overloadedCount: number;
  moves: RebalanceMove[];
}

const fmtWeek = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

interface RebalanceSidePanelProps {
  projectId: string;
  onClose: () => void;
  onApplySuccess?: () => void;
}

export function RebalanceSidePanel({
  projectId,
  onClose,
  onApplySuccess,
}: RebalanceSidePanelProps) {
  const qc = useQueryClient();
  const [selectedWeekIndex, setSelectedWeekIndex] = React.useState<number | null>(null);

  const {
    data,
    isPending,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["projects", projectId, "ai-rebalance", selectedWeekIndex],
    queryFn: () => {
      const q = selectedWeekIndex !== null ? `?weekIndex=${selectedWeekIndex}` : "";
      return api.post<RebalanceResponse>(`/projects/${projectId}/ai/rebalance${q}`);
    },
    staleTime: 60_000,
  });

  const [selectedTaskIds, setSelectedTaskIds] = React.useState<Set<string>>(new Set());

  // Khi tải xong dữ liệu, mặc định tick chọn tất cả các moves
  React.useEffect(() => {
    if (data?.moves) {
      setSelectedTaskIds(new Set(data.moves.map((m) => m.taskId)));
    }
  }, [data?.moves]);

  const toggleSelect = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!data?.moves) return;
    if (selectedTaskIds.size === data.moves.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(data.moves.map((m) => m.taskId)));
    }
  };

  const applyMutation = useMutation({
    mutationFn: (moves: Array<{ taskId: string; assigneeId: string }>) =>
      api.post(`/projects/${projectId}/tasks/reassign-batch`, { moves }),
    onSuccess: (_, variables) => {
      toast.success(`Đã áp dụng điều chuyển ${variables.length} công việc thành công!`);
      void qc.invalidateQueries({ queryKey: ["projects", projectId] });
      void refetch();
      onApplySuccess?.();
    },
    onError: (e) => {
      toast.error(describeError(e).message);
    },
  });

  const handleApply = () => {
    if (!data?.moves || selectedTaskIds.size === 0) return;
    const movesToApply = data.moves
      .filter((m) => selectedTaskIds.has(m.taskId))
      .map((m) => ({
        taskId: m.taskId,
        assigneeId: m.toUserId,
      }));
    applyMutation.mutate(movesToApply);
  };

  const selectedMoves = (data?.moves ?? []).filter((m) => selectedTaskIds.has(m.taskId));

  // Tính toán tóm tắt mô phỏng (Before vs After) dựa trên các task đang được tick
  const impactSummary = React.useMemo(() => {
    if (!data?.moves || selectedMoves.length === 0) return [];

    const userMap = new Map<
      string,
      {
        userId: string;
        userName: string;
        avatarUrl: string | null;
        before: number;
        after: number;
        delta: number;
      }
    >();

    for (const move of selectedMoves) {
      if (!userMap.has(move.fromUserId)) {
        userMap.set(move.fromUserId, {
          userId: move.fromUserId,
          userName: move.fromUserName,
          avatarUrl: move.fromUserAvatar,
          before: move.fromCurrentLoad,
          after: move.fromCurrentLoad,
          delta: 0,
        });
      }
      const from = userMap.get(move.fromUserId)!;
      const reduction = Math.max(0, move.fromCurrentLoad - move.fromNewLoad);
      from.after = Math.max(0, from.after - reduction);
      from.delta -= reduction;

      if (!userMap.has(move.toUserId)) {
        userMap.set(move.toUserId, {
          userId: move.toUserId,
          userName: move.toUserName,
          avatarUrl: move.toUserAvatar,
          before: move.toCurrentLoad,
          after: move.toCurrentLoad,
          delta: 0,
        });
      }
      const to = userMap.get(move.toUserId)!;
      const addition = Math.max(0, move.toNewLoad - move.toCurrentLoad);
      to.after = to.after + addition;
      to.delta += addition;
    }

    return Array.from(userMap.values());
  }, [data?.moves, selectedMoves]);

  return (
    <Card className="border-indigo-200 dark:border-indigo-900/60 shadow-lg bg-card/95 backdrop-blur flex flex-col h-full sticky top-4">
      {/* Header */}
      <CardHeader className="p-4 pb-3 border-b border-border/60 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/70 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">
                Cân bằng tải AI
              </CardTitle>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              disabled={isFetching}
              onClick={() => void refetch()}
              title="Phân tích lại đề xuất"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={onClose}
              title="Đóng bảng AI"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardDescription className="text-xs leading-relaxed">
          Đề xuất điều chuyển task dựa trên kỹ năng thực chứng và thời gian trống trong tuần.
        </CardDescription>

        {data?.weeksSummary && data.weeksSummary.length > 0 && (
          <div className="pt-1">
            <div className="flex items-center gap-1 p-1 bg-muted/60 dark:bg-muted/40 rounded-lg border border-border/50">
              {data.weeksSummary.map((ws) => {
                const activeWeek = selectedWeekIndex ?? data.weekIndex;
                const isSelected = activeWeek === ws.weekIndex;
                return (
                  <button
                    key={ws.weekIndex}
                    type="button"
                    onClick={() => setSelectedWeekIndex(ws.weekIndex)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 py-1 px-1.5 rounded-md text-xs font-medium transition-all",
                      isSelected
                        ? "bg-background text-foreground shadow-xs border border-border/60"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                    )}
                  >
                    <span>{fmtWeek(ws.weekStart)}</span>
                    {ws.overloadedCount > 0 && (
                      <span className="flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                        {ws.overloadedCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </CardHeader>

      {/* Body Content */}
      <CardContent className="p-4 flex-1 overflow-y-auto space-y-4 max-h-[calc(100vh-280px)]">
        {isPending ? (
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-500" />
              <span>AI đang phân tích bảng sự thật tải 4 tuần...</span>
            </div>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : isError ? (
          <div className="py-6 text-center space-y-2">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto opacity-80" />
            <p className="text-xs font-medium text-destructive">
              {describeError(error).message || "Không thể tải đề xuất cân bằng tải."}
            </p>
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => void refetch()}>
              Thử lại
            </Button>
          </div>
        ) : data.moves.length === 0 ? (
          <div className="py-8 text-center space-y-3 px-2">
            <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">
                Tải nhân sự tuần {data.weekStart ? fmtWeek(data.weekStart) : ""} hiện đang cân bằng
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {data.summary || "Không có nhân sự nào bị vượt ngưỡng tải trong tuần này."}
              </p>
            </div>
            {data.weeksSummary?.some((ws) => ws.overloadedCount > 0 && ws.weekIndex !== (selectedWeekIndex ?? data.weekIndex)) && (
              <p className="text-[11px] text-indigo-600 dark:text-indigo-400 pt-1">
                💡 Lưu ý: Có tuần khác đang có nhân sự quá tải. Hãy bấm chọn các tuần ở trên để xem và cân bằng.
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Thanh chọn tất cả & Đếm */}
            <div className="flex items-center justify-between text-xs pb-1 border-b border-border/40">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {selectedTaskIds.size === data.moves.length ? (
                  <CheckSquare className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                ) : (
                  <Square className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span>
                  Chọn ({selectedTaskIds.size}/{data.moves.length})
                </span>
              </button>
              <Badge variant="outline" className="text-[11px] font-normal border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400">
                {data.overloadedCount} người quá tải
              </Badge>
            </div>

            {/* Danh sách thẻ đề xuất */}
            <div className="space-y-2.5">
              {data.moves.map((move) => {
                const isChecked = selectedTaskIds.has(move.taskId);
                return (
                  <div
                    key={move.taskId}
                    onClick={() => toggleSelect(move.taskId)}
                    className={cn(
                      "p-3 rounded-lg border text-xs cursor-pointer transition-all space-y-2.5",
                      isChecked
                        ? "bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/80 shadow-sm"
                        : "bg-muted/20 border-border/60 opacity-60 hover:opacity-100"
                    )}
                  >
                    {/* Header Thẻ: Checkbox + Tiêu đề task */}
                    <div className="flex items-start gap-2">
                      <div className="pt-0.5">
                        {isChecked ? (
                          <CheckSquare className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                            {move.taskKey}
                          </span>
                          <span className="font-medium text-foreground truncate max-w-[200px]" title={move.taskTitle}>
                            {move.taskTitle}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                          <span>{move.estimateHours}h</span>
                          {move.priority && (
                            <>
                              <span>·</span>
                              <span className="uppercase text-[10px] font-semibold">{move.priority}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* From Person -> To Person */}
                    <div className="flex items-center justify-between gap-1 p-2 rounded bg-background/80 border border-border/40 text-[11px]">
                      {/* From */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <UserAvatar name={move.fromUserName} avatar={move.fromUserAvatar ?? undefined} className="h-5 w-5 text-[10px]" />
                        <div className="truncate">
                          <p className="font-medium truncate max-w-[85px]" title={move.fromUserName}>
                            {move.fromUserName}
                          </p>
                          <p className="text-[10px] text-destructive font-semibold">
                            {Math.round(move.fromCurrentLoad * 100)}%
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-center px-1 text-muted-foreground">
                        <ArrowRight className="h-3.5 w-3.5 text-indigo-500" />
                      </div>

                      {/* To */}
                      <div className="flex items-center gap-1.5 min-w-0 text-right justify-end">
                        <div className="truncate">
                          <p className="font-medium truncate max-w-[85px]" title={move.toUserName}>
                            {move.toUserName}
                          </p>
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                            {Math.round(move.toCurrentLoad * 100)}%
                          </p>
                        </div>
                        <UserAvatar name={move.toUserName} avatar={move.toUserAvatar ?? undefined} className="h-5 w-5 text-[10px]" />
                      </div>
                    </div>

                    {/* Lý do AI */}
                    {move.reason && (
                      <p className="text-[11px] text-muted-foreground leading-relaxed italic bg-indigo-50/50 dark:bg-indigo-950/30 p-1.5 rounded border border-indigo-100/50 dark:border-indigo-900/40">
                        💡 {move.reason}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Khối mô phỏng phản ứng Trước vs Sau (Live Impact Simulation) */}
            {impactSummary.length > 0 && (
              <div className="p-3 rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/20 dark:bg-indigo-950/10 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    <Scale className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" /> Dự báo sau khi điều chuyển:
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    ({selectedMoves.length} việc được chọn)
                  </span>
                </div>
                <div className="space-y-1.5">
                  {impactSummary.map((item) => {
                    const beforePct = Math.round(item.before * 100);
                    const afterPct = Math.round(item.after * 100);
                    const isDecrease = item.delta < 0;

                    return (
                      <div key={item.userId} className="flex items-center justify-between text-[11px] p-1.5 rounded bg-background/60">
                        <div className="flex items-center gap-1.5 truncate max-w-[120px]">
                          <UserAvatar name={item.userName} avatar={item.avatarUrl ?? undefined} className="h-4 w-4 text-[9px]" />
                          <span className="truncate font-medium">{item.userName}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className={cn(beforePct > 100 ? "text-destructive font-semibold" : "text-muted-foreground")}>
                            {beforePct}%
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span className={cn(afterPct > 100 ? "text-destructive font-semibold" : "text-emerald-600 dark:text-emerald-400 font-semibold")}>
                            {afterPct}%
                          </span>
                          <span className={cn("text-[10px]", isDecrease ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                            ({isDecrease ? "" : "+"}{Math.round(item.delta * 100)}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Footer Hành động */}
      {data?.moves && data.moves.length > 0 && (
        <div className="p-3 border-t border-border/60 bg-muted/10 flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8"
            onClick={onClose}
          >
            Đóng
          </Button>
          <Button
            size="sm"
            disabled={selectedTaskIds.size === 0 || applyMutation.isPending}
            onClick={handleApply}
            className="gap-1.5 text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
          >
            {applyMutation.isPending ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="h-3.5 w-3.5" />
            )}
            Áp dụng điều chuyển ({selectedTaskIds.size})
          </Button>
        </div>
      )}
    </Card>
  );
}
