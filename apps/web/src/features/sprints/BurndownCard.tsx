"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { AlertTriangle, Bot, Loader2, Sparkles, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/app/ErrorState";
import { taskKeyOf } from "@/components/app/TaskCard";
import { UserAvatar } from "@/components/app/UserAvatar";
import { useTasks } from "@/features/board/hooks";
import { api, describeError } from "@/lib/api";
import { useBurndown, useForecast } from "@/lib/hooks/analytics";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { causeLabel, riskToVariant } from "@/lib/status";
import type { ExplainView } from "@/lib/types";
import { toast } from "sonner";
import { dm, hrs } from "./shared";

const config: ChartConfig = {
  ideal: { label: "Lý tưởng", color: "hsl(var(--chart-2))" },
  remaining: { label: "Còn lại", color: "hsl(var(--chart-1))" },
};
const RISK: Record<string, string> = { LOW: "Thấp", MEDIUM: "Trung bình", HIGH: "Cao", UNKNOWN: "Chưa rõ" };

/** Burn-down + dự báo của MỘT sprint (UC-30/31) — GET /sprints/:id/burndown + /forecast, số backend tính. */
export function BurndownCard({
  sprintId,
  status,
  onOpenTask,
}: {
  sprintId: string;
  status: "PLANNED" | "ACTIVE" | "CLOSED";
  onOpenTask?: (taskId: string) => void;
}) {
  const project = useCurrentProject();
  const closed = status === "CLOSED";
  const planned = status === "PLANNED";
  const bd = useBurndown(planned ? null : sprintId);
  const fc = useForecast(planned ? null : sprintId);
  const [explain, setExplain] = React.useState<ExplainView | null>(null);
  React.useEffect(() => setExplain(null), [sprintId]);

  const explainMut = useMutation({
    mutationFn: () => api.post<ExplainView>(`/sprints/${sprintId}/forecast/explain`),
    onSuccess: (r) => setExplain(r),
    onError: (e) => {
      const { code, message } = describeError(e);
      toast.error("Không phân tích được rủi ro", { description: `${code}: ${message}` });
    },
  });

  const data = bd.data
    ? (() => {
        const m = new Map<string, { date: string; ideal?: number; remaining?: number }>();
        for (const p of bd.data.ideal) m.set(p.date, { date: p.date, ideal: p.ideal });
        for (const p of bd.data.actual) m.set(p.date, { ...(m.get(p.date) ?? { date: p.date }), remaining: p.remaining });
        return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
      })()
    : [];
  const f = fc.data;
  const aiRisk = explain?.action?.type === "RISK_EXPLANATION" ? explain.action : null;

  return (
    <Card className="min-w-0 flex flex-col">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-muted-foreground" /> Biểu đồ Burn-down & Dự báo
          </CardTitle>
          <div className="flex items-center gap-2">
            {f && !closed && <Badge variant={riskToVariant(f.riskLevel)}>Rủi ro {RISK[f.riskLevel] ?? f.riskLevel}</Badge>}
            {status === "ACTIVE" && project.canManage && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                disabled={explainMut.isPending}
                onClick={() => explainMut.mutate()}
              >
                {explainMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-primary" />}
                Phân tích AI
              </Button>
            )}
          </div>
        </div>
        <CardDescription className="text-xs">
          {planned
            ? "Sprint chưa bắt đầu — biểu đồ burn-down và dự báo ETA sẽ hoạt động ngay khi bắt đầu sprint."
            : closed
              ? f?.final
                ? `Lúc đóng còn ${hrs(f.final.remainingHours)} trên phạm vi ${hrs(f.final.scopeHours)}.`
                : "Sprint đóng trước khi hệ thống chụp số cuối — chỉ còn các ngày đã có bản chụp."
              : f
                ? `Còn ${hrs(f.remainingHours)} · vận tốc ${hrs(f.velocity)}/ngày · ETA ${f.eta ? dm(f.eta) : "—"} · còn ${f.workdaysLeft} ngày làm việc`
                : " "}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-2 space-y-3 flex-1">
        {planned ? (
          <div className="h-48 rounded-lg border border-dashed border-border/70 bg-muted/20 flex items-center justify-center p-4 text-center text-xs text-muted-foreground">
            Bắt đầu sprint để chốt đường lý tưởng và theo dõi tiến độ từng ngày.
          </div>
        ) : bd.isPending ? (
          <Skeleton className="h-48 w-full" />
        ) : bd.isError ? (
          <ErrorState code={describeError(bd.error).code} message={describeError(bd.error).message} onRetry={() => bd.refetch()} />
        ) : (
          <ChartContainer config={config} className="h-48 w-full">
            <LineChart data={data} margin={{ left: -20, right: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={(v: string) => dm(v)} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="ideal" stroke="var(--color-ideal)" strokeDasharray="4 4" dot={false} />
              <Line type="monotone" dataKey="remaining" stroke="var(--color-remaining)" strokeWidth={2} dot={{ r: 2 }} connectNulls />
            </LineChart>
          </ChartContainer>
        )}

        {!planned && f && f.causes.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="text-muted-foreground">Nguyên nhân rủi ro:</span>
            {f.causes.map((c) => (
              <CauseChip key={c.code} cause={c} sprintId={sprintId} onOpenTask={onOpenTask} />
            ))}
          </div>
        )}

        {aiRisk && (
          <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <Bot className="h-3.5 w-3.5 text-primary" /> Nhận định từ Trợ lý AI
              </div>
              {explain && (
                <span className="text-[10px] text-muted-foreground">
                  {explain.cached ? "kết quả cache" : `${explain.usage.model} · ${explain.usage.durationMs} ms`}
                </span>
              )}
            </div>
            {aiRisk.reply && <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">{aiRisk.reply}</p>}
            {aiRisk.recommendations.length > 0 && (
              <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                {aiRisk.recommendations.map((rec, i) => (
                  <li key={i} className="text-foreground/85">{rec}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {bd.data && bd.data.gaps.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Thiếu bản chụp {bd.data.gaps.length} ngày làm việc — đường còn lại chỉ nối các ngày có số liệu.
          </p>
        )}
        {bd.data && bd.data.scopeCreepDays.length > 0 && (
          <p className="flex items-start gap-1.5 text-xs text-foreground">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-warning" aria-hidden />
            Phạm vi tăng quá 10 % so với lúc bắt đầu vào {bd.data.scopeCreepDays.map(dm).join(", ")}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Một nguyên nhân rủi ro, bấm ra đúng các việc/người mà backend đã đếm. */
function CauseChip({
  cause,
  sprintId,
  onOpenTask,
}: {
  cause: { code: string; count: number; taskIds?: string[]; userIds?: string[] };
  sprintId: string;
  onOpenTask?: (taskId: string) => void;
}) {
  const project = useCurrentProject();
  const [open, setOpen] = React.useState(false);
  const tasks = useTasks(project.id, { sprintId }, { enabled: open && !!cause.taskIds?.length });
  const rows = (tasks.data ?? []).filter((t) => cause.taskIds?.includes(t.id));
  const people = project.members.filter((m) => cause.userIds?.includes(m.id));
  const clickable = !!cause.taskIds?.length || !!cause.userIds?.length;

  if (!clickable)
    return (
      <Badge variant="outline" className="text-[11px] font-normal">
        {causeLabel(cause.code, cause.count)}
      </Badge>
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-6 text-[11px] px-2 font-normal">
          {causeLabel(cause.code, cause.count)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <p className="px-3 py-2 text-xs font-medium border-b border-border/60">{causeLabel(cause.code, cause.count)}</p>
        {cause.userIds?.length ? (
          <ul className="p-2 space-y-1 text-xs">
            {people.map((m) => (
              <li key={m.id} className="flex items-center gap-2">
                <UserAvatar name={m.shortName ?? m.fullName} avatar={m.avatarUrl ?? undefined} size="sm" /> {m.shortName ?? m.fullName}
              </li>
            ))}
          </ul>
        ) : tasks.isPending ? (
          <div className="p-3">
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <ul className="max-h-64 overflow-y-auto divide-y divide-border/60 text-xs">
            {rows.map((t) => (
              <li key={t.id}>
                {onOpenTask ? (
                  <Button
                    variant="ghost"
                    className="w-full h-auto justify-start gap-2 rounded-none px-3 py-2 text-xs font-normal"
                    onClick={() => {
                      setOpen(false);
                      onOpenTask(t.id);
                    }}
                  >
                    <span className="font-mono text-muted-foreground shrink-0">{taskKeyOf(project.key, t)}</span>
                    <span className="truncate">{t.title}</span>
                  </Button>
                ) : (
                  <Button asChild variant="ghost" className="w-full h-auto justify-start gap-2 rounded-none px-3 py-2 text-xs font-normal">
                    <Link href={`/projects/${project.id}/tasks/${taskKeyOf(project.key, t)}`}>
                      <span className="font-mono text-muted-foreground shrink-0">{taskKeyOf(project.key, t)}</span>
                      <span className="truncate">{t.title}</span>
                    </Link>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
