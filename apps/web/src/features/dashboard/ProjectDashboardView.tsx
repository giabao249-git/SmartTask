"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { AlertTriangle, Bot, CheckCircle2, ClipboardList, Clock, History, Settings2, Sparkles, TrendingDown, UserX, Users2 } from "lucide-react";
import { ActivityList } from "@/features/activity/ActivityList";
import { PendingReviewsCard } from "./PendingReviewsCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { UserAvatar } from "@/components/app/UserAvatar";
import { WorkloadBadge } from "@/components/app/WorkloadBadge";
import { api, describeError } from "@/lib/api";
import { useBurndown, useDashboard, useForecast } from "@/lib/hooks/analytics";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { causeLabel, riskToVariant, sprintStatusLabel } from "@/lib/status";
import { useSprints } from "@/lib/hooks/queries";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTasks } from "@/features/board/hooks";
import { taskKeyOf } from "@/components/app/TaskCard";
import Link from "next/link";
import type { ExplainView } from "@/lib/types";
import { toast } from "sonner";
import { parseAction, ActionCard } from "@/features/assistant/ActionCard";
import { makeResolver } from "@/features/assistant/codes";

const statusChart: ChartConfig = { count: { label: "Số việc", color: "hsl(var(--chart-1))" } };
const burnChart: ChartConfig = {
  ideal: { label: "Lý tưởng", color: "hsl(var(--chart-2))" },
  remaining: { label: "Còn lại", color: "hsl(var(--chart-1))" },
};

/** Dashboard dự án (UC-33): GET /projects/:id/dashboard + burndown/forecast của sprint đang chạy (số backend tính). */
export function ProjectDashboardView() {
  const project = useCurrentProject();
  const router = useRouter();
  const dash = useDashboard(project.id);
  const sprints = useSprints(project.id);
  // Xem burn-down của sprint bất kỳ (mặc định sprint đang chạy, không có thì sprint đóng gần nhất)
  const [pick, setPick] = React.useState<string | null>(null);
  const fallback = project.activeSprint?.id ?? [...(sprints.data ?? [])].filter((x) => x.status === "CLOSED").sort((a, b) => (b.closedAt ?? b.endDate).localeCompare(a.closedAt ?? a.endDate))[0]?.id ?? null;
  const sprintId = pick ?? fallback;
  const picked = sprints.data?.find((x) => x.id === sprintId) ?? null;
  const active = sprints.data?.find((x) => x.status === "ACTIVE") ?? null;
  const burndown = useBurndown(sprintId);
  const forecast = useForecast(sprintId);
  const [explain, setExplain] = React.useState<ExplainView | null>(null);
  const explainMut = useMutation({
    mutationFn: () => api.post<ExplainView>(`/sprints/${sprintId}/forecast/explain`),
    onSuccess: (r) => setExplain(r),
    onError: (e) => {
      const { code, message } = describeError(e);
      toast.error("Không giải thích được", { description: `${code}: ${message}` });
    },
  });

  if (dash.isPending)
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  if (dash.isError) return <ErrorState code={describeError(dash.error).code} message={describeError(dash.error).message} onRetry={() => dash.refetch()} />;
  const d = dash.data;
  const progressPct = d.counts.total ? Math.round((d.counts.done / d.counts.total) * 100) : 0;
  const burnData = burndown.data
    ? mergeBurndown(burndown.data.ideal, burndown.data.actual)
    : [];
  const fc = forecast.data;
  const resolver = makeResolver(null, project.members, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Dashboard · ${project.name}`}
        description={
          active
            ? `${active.name} · ${active.startDate.slice(0, 10)} → ${active.endDate.slice(0, 10)}${active.goal ? ` — Mục tiêu: ${active.goal}` : ""}`
            : "Chưa có sprint đang chạy"
        }
        breadcrumbs={[{ label: "Workspace", href: "/workspaces" }, { label: project.name }, { label: "Dashboard" }]}
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => router.push(`/projects/${project.id}/settings`)}>
            <Settings2 className="h-4 w-4" /> Cấu hình dự án
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => router.push(`/projects/${project.id}/assistant`)}>
            <Bot className="h-4 w-4" /> Trợ lý AI
          </Button>
        </div>
      </PageHeader>

      {d.counts.total === 0 ? (
        <EmptyState icon={ClipboardList} title="Dự án chưa có công việc" description="Tạo công việc trên Kanban hoặc để Trợ lý AI phân rã yêu cầu đầu tiên." actionLabel="Mở Trợ lý AI" onAction={() => router.push(`/projects/${project.id}/assistant`)} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Stat icon={ClipboardList} label="Tổng công việc" value={d.counts.total} />
            <Stat icon={CheckCircle2} label="Hoàn thành" value={d.counts.done} hint={`${progressPct}%`} tone="success" />
            <Stat icon={Clock} label="Đang mở" value={d.counts.open} />
            <Stat icon={AlertTriangle} label="Quá hạn" value={d.counts.overdue} tone={d.counts.overdue ? "destructive" : undefined} />
            <Stat icon={UserX} label="Chưa giao" value={d.counts.unassigned} tone={d.counts.unassigned ? "warning" : undefined} />
          </div>

          {project.canManage && <PendingReviewsCard projectId={project.id} />}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Card className="border-border/80">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm">Việc theo cột</CardTitle>
                <CardDescription className="text-xs">Tiến độ chung {progressPct}%</CardDescription>
                <Progress value={progressPct} className="h-1.5 mt-1" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <ChartContainer config={statusChart} className="h-48 w-full">
                  <BarChart data={d.byStatus} margin={{ left: -20, right: 4 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="border-border/80">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users2 className="h-4 w-4 text-primary" /> Tải nhóm tuần này
                </CardTitle>
                <CardDescription className="text-xs">Mức sử dụng theo snapshot backend (docs 04 §3)</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {d.workloadWeek.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4">Chưa có snapshot tải tuần này — mở màn Tải nhân sự và bấm &quot;Tính lại&quot;.</p>
                ) : (
                  d.workloadWeek.map((w) => (
                    <div key={w.userId} className="flex items-center gap-2 text-xs">
                      <UserAvatar name={w.fullName} avatar={w.avatarUrl ?? undefined} size="sm" />
                      <span className="flex-1 truncate">{w.shortName ?? w.fullName}</span>
                      <span className="font-mono text-muted-foreground">
                        {w.effLoadHours}/{w.effCapacityHours}h
                      </span>
                      <WorkloadBadge percent={Math.round(w.utilization * 100)} />
                    </div>
                  ))
                )}
                {d.openAlerts.length > 0 && (
                  <div className="pt-2 border-t border-border/40 space-y-1">
                    {d.openAlerts.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 text-[11px] text-destructive">
                        <AlertTriangle className="h-3 w-3" />
                        <span>
                          {a.user.fullName} · {a.kind} · tuần {a.weekStart}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <Button variant="outline" size="sm" className="w-full h-7 text-xs mt-1" onClick={() => router.push(`/projects/${project.id}/people`)}>
                  Xem chi tiết tải
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/80">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-primary" /> Burn-down & dự báo
                  </CardTitle>
                  {fc && (
                    <Badge variant={riskToVariant(fc.riskLevel)} className="text-[10px]">
                      Rủi ro {riskLabel(fc.riskLevel)}
                    </Badge>
                  )}
                </div>
                {(sprints.data ?? []).length > 0 ? (
                  <Select
                    value={sprintId ?? undefined}
                    onValueChange={(v) => {
                      setPick(v);
                      setExplain(null);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs" aria-label="Chọn sprint xem burn-down">
                      <SelectValue placeholder="Chọn sprint" />
                    </SelectTrigger>
                    <SelectContent>
                      {(sprints.data ?? []).map((x) => (
                        <SelectItem key={x.id} value={x.id} className="text-xs">
                          {x.name} · {sprintStatusLabel(x.status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <CardDescription className="text-xs">Chưa có sprint</CardDescription>
                )}
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {!sprintId ? (
                  <p className="text-xs text-muted-foreground py-4">Bắt đầu một sprint để có burn-down.</p>
                ) : burndown.isPending ? (
                  <Skeleton className="h-40" />
                ) : burndown.isError ? (
                  <ErrorState code={describeError(burndown.error).code} message={describeError(burndown.error).message} onRetry={() => burndown.refetch()} />
                ) : (
                  <ChartContainer config={burnChart} className="h-40 w-full">
                    <LineChart data={burnData} margin={{ left: -20, right: 4 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis fontSize={10} tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="ideal" stroke="var(--color-ideal)" strokeDasharray="4 4" dot={false} />
                      <Line type="monotone" dataKey="remaining" stroke="var(--color-remaining)" dot={{ r: 2 }} connectNulls />
                    </LineChart>
                  </ChartContainer>
                )}
                {burndown.data && burndown.data.gaps.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Thiếu số liệu {burndown.data.gaps.length} ngày làm việc ({fmtGaps(burndown.data.gaps)}) — đường thực tế chỉ nối các ngày có bản chụp; vận tốc vẫn tính từ ngày hoàn thành của việc.
                  </p>
                )}
                {fc && (
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <Num label="Còn lại" value={`${fc.remainingHours}h`} />
                    <Num label="Vận tốc" value={`${fc.velocity}h/ngày`} />
                    <Num label="ETA" value={fc.eta ?? "—"} tone={fc.eta && fc.eta > fc.endDate ? "destructive" : undefined} />
                  </div>
                )}
                {fc && fc.causes.length > 0 && sprintId && (
                  <div className="flex flex-wrap gap-1.5">
                    {fc.causes.map((c) => (
                      <CauseChip key={c.code} cause={c} sprintId={sprintId} />
                    ))}
                  </div>
                )}
                {sprintId && picked?.status === "ACTIVE" && project.canManage && (
                  <Button variant="outline" size="sm" className="w-full h-7 text-xs gap-1.5" disabled={explainMut.isPending} onClick={() => explainMut.mutate()}>
                    <Sparkles className="h-3.5 w-3.5 text-info" /> {explainMut.isPending ? "AI đang phân tích…" : "Giải thích bằng AI"}
                  </Button>
                )}
                {explain && (
                  <div className="text-xs rounded-md border border-border/60 bg-muted/30 p-2">
                    <p className="whitespace-pre-wrap">{explain.action.reply}</p>
                    {parseAction(explain.action) && <ActionCard action={explain.action} resolver={resolver} validation={explain.validation} />}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {explain.cached ? "kết quả cache" : `${explain.usage.model} · ${explain.usage.durationMs} ms`}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/80">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" /> Hoạt động gần đây
              </CardTitle>
              <CardDescription className="text-xs">Dòng hoạt động dự án (UC-16) — tạo, chuyển cột, giao việc, bình luận, sprint.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <ActivityList projectId={project.id} limit={15} compact />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/**
 * Một nguyên nhân rủi ro, bấm ra đúng các việc/người mà backend đã đếm (ForecastService trả sẵn taskIds/userIds).
 * Trước đây chỉ là chip mã máy "OVERDUE ×7" không bấm được.
 */
function CauseChip({ cause, sprintId }: { cause: { code: string; count: number; taskIds?: string[]; userIds?: string[] }; sprintId: string }) {
  const project = useCurrentProject();
  const [open, setOpen] = React.useState(false);
  const tasks = useTasks(project.id, { sprintId }, { enabled: open && !!cause.taskIds?.length });
  const rows = (tasks.data ?? []).filter((t) => cause.taskIds?.includes(t.id));
  const people = project.members.filter((m) => cause.userIds?.includes(m.id));
  const clickable = !!cause.taskIds?.length || !!cause.userIds?.length;
  if (!clickable)
    return (
      <Badge variant="outline" className="text-[11px]">
        {causeLabel(cause.code, cause.count)}
      </Badge>
    );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-[11px] px-2">
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
                <Button asChild variant="ghost" className="w-full h-auto justify-start gap-2 rounded-none px-3 py-2 text-xs font-normal">
                  <Link href={`/projects/${project.id}/tasks/${taskKeyOf(project.key, t)}`}>
                    <span className="font-mono text-muted-foreground shrink-0">{taskKeyOf(project.key, t)}</span>
                    <span className="truncate">{t.title}</span>
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

function Stat({ icon: Icon, label, value, hint, tone }: { icon: typeof Clock; label: string; value: number; hint?: string; tone?: "success" | "warning" | "destructive" }) {
  const toneClass = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : "text-primary";
  return (
    <Card className="border-border/80">
      <CardContent className="p-4 flex items-center gap-3">
        <Icon className={`h-5 w-5 ${toneClass}`} />
        <div>
          <div className="text-2xl font-semibold tabular-nums leading-none">
            {value}
            {hint && <span className="text-xs text-muted-foreground font-normal ml-1">{hint}</span>}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Num({ label, value, tone }: { label: string; value: string; tone?: "destructive" }) {
  return (
    <div className="p-2 rounded bg-muted/40 border border-border/40">
      <span className="block text-[10px] text-muted-foreground">{label}</span>
      <span className={`font-mono font-semibold ${tone === "destructive" ? "text-destructive" : ""}`}>{value}</span>
    </div>
  );
}

function mergeBurndown(ideal: { date: string; ideal: number }[], actual: { date: string; remaining: number }[]) {
  const byDate = new Map<string, { date: string; ideal?: number; remaining?: number }>();
  for (const i of ideal) byDate.set(i.date, { date: i.date, ideal: i.ideal });
  for (const a of actual) byDate.set(a.date, { ...(byDate.get(a.date) ?? { date: a.date }), remaining: a.remaining });
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Tối đa 6 ngày dạng MM-DD, dài hơn thì thêm dấu … */
function fmtGaps(days: string[]): string {
  const shown = days.slice(0, 6).map((d) => d.slice(5));
  return days.length > 6 ? `${shown.join(", ")}…` : shown.join(", ");
}

function riskLabel(l: string): string {
  return { LOW: "thấp", MEDIUM: "trung bình", HIGH: "cao", UNKNOWN: "chưa rõ" }[l] ?? l;
}
