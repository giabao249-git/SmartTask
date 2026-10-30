"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { contentVariants } from "@/lib/motion";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardList,
  Clock,
  FolderKanban,
  History,
  Kanban,
  Plus,
  Settings2,
  UserX,
  Users2,
} from "lucide-react";
import { ActivityList } from "@/features/activity/ActivityList";
import { useBoardRealtime } from "@/features/board/hooks";
import { SprintFormDialog } from "@/features/sprints/SprintFormDialog";
import { SprintReportDetail } from "@/features/sprints/SprintsView";
import { VelocityCard } from "@/features/sprints/VelocityCard";
import { useInvalidateSprints } from "@/features/sprints/shared";
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
import { describeError } from "@/lib/api";
import { useDashboard } from "@/lib/hooks/analytics";
import { useSprints } from "@/lib/hooks/queries";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sprintStatusLabel } from "@/lib/status";
import { fmtDay } from "@/components/app/TaskCard";
import type { SprintView } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusChart: ChartConfig = { count: { label: "Số việc", color: "hsl(var(--chart-1))" } };
const ORDER: Record<SprintView["status"], number> = { ACTIVE: 0, PLANNED: 1, CLOSED: 2 };

/**
 * Dashboard dự án & Báo cáo Sprint tích hợp (UC-09, UC-30/31, UC-33):
 * - Mặc định mở Sprint đang chạy (ACTIVE) hoặc sprint gần nhất để theo dõi sát tiến độ, burn-down, tải nhân sự và biến động phạm vi.
 * - Có thể chuyển nhanh giữa các Sprint khác hoặc chế độ "Toàn dự án" (__all) ngay trên thanh chọn ngang.
 */
export function ProjectDashboardView() {
  const project = useCurrentProject();
  const router = useRouter();
  const params = useSearchParams();
  const dash = useDashboard(project.id);
  const sprints = useSprints(project.id);
  const invalidateSprints = useInvalidateSprints(project.id);
  const [editingSprint, setEditingSprint] = React.useState<SprintView | "new" | null>(null);

  useBoardRealtime(project.id, {
    onTaskEvent: () => {
      invalidateSprints();
      void dash.refetch();
    },
  });

  const sprintRows = React.useMemo(
    () =>
      [...(sprints.data ?? [])].sort(
        (a, b) =>
          (ORDER[a.status as keyof typeof ORDER] ?? 2) - (ORDER[b.status as keyof typeof ORDER] ?? 2) ||
          (a.status === "CLOSED" ? b.startDate.localeCompare(a.startDate) : a.startDate.localeCompare(b.startDate)),
      ),
    [sprints.data],
  );

  const paramSprint = params.get("sprint");
  const defaultScope = project.activeSprint?.id ?? sprintRows[0]?.id ?? "__all";
  const scope = paramSprint ?? defaultScope;
  const selectedSprint = scope === "__all" ? null : (sprintRows.find((s) => s.id === scope) ?? sprintRows[0] ?? null);
  const isAllProject = scope === "__all" || !selectedSprint;
  const canManage = project.canManage && project.status === "ACTIVE";

  const selectScope = (next: string) => {
    router.replace(`/projects/${project.id}/dashboard?sprint=${next}`, { scroll: false });
  };

  if (dash.isPending || sprints.isPending)
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  if (dash.isError) return <ErrorState code={describeError(dash.error).code} message={describeError(dash.error).message} onRetry={() => dash.refetch()} />;

  const d = dash.data;
  const progressPct = d.counts.total ? Math.round((d.counts.done / d.counts.total) * 100) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Dashboard · ${project.name}`}
        description={
          selectedSprint && !isAllProject
            ? `Đang xem ${selectedSprint.name} (${selectedSprint.startDate.slice(0, 10)} → ${selectedSprint.endDate.slice(0, 10)})${selectedSprint.goal ? ` — ${selectedSprint.goal}` : ""}`
            : "Tổng quan tiến độ, tải nhân sự và báo cáo các chu kỳ Sprint của dự án."
        }
        breadcrumbs={[{ label: "Workspace", href: "/workspaces" }, { label: project.name }, { label: "Dashboard" }]}
      >
        <div className="flex items-center gap-2 flex-wrap">
          {canManage && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditingSprint("new")}>
              <Plus className="h-4 w-4" /> Tạo sprint
            </Button>
          )}
          {canManage && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => router.push(`/projects/${project.id}/settings`)}>
              <Settings2 className="h-4 w-4" /> Cấu hình
            </Button>
          )}
          <Button size="sm" className="gap-1.5" onClick={() => router.push(`/projects/${project.id}/assistant`)}>
            <Bot className="h-4 w-4" /> Trợ lý AI
          </Button>
        </div>
      </PageHeader>

      {/* Thanh chuyển đổi phạm vi báo cáo dạng Dropdown tinh gọn */}
      <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border/80 bg-card/80 shadow-2xs flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-[280px]">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 shrink-0">
            <FolderKanban className="h-4 w-4 text-primary" />
            Phạm vi báo cáo:
          </span>
          <Select value={isAllProject ? "__all" : (selectedSprint?.id ?? "__all")} onValueChange={(val) => selectScope(val)}>
            <SelectTrigger className="h-8 w-[250px] text-xs bg-background font-medium">
              <SelectValue placeholder="Chọn sprint..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all" className="text-xs font-medium">
                Toàn dự án ({d.counts.done}/{d.counts.total} việc xong)
              </SelectItem>
              {sprintRows.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">
                  {s.name} · {sprintStatusLabel(s.status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedSprint && !isAllProject ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <span>{fmtDay(selectedSprint.startDate)} → {fmtDay(selectedSprint.endDate)}</span>
              <Badge variant={selectedSprint.status === "ACTIVE" ? "default" : "outline"} className="text-[11px] font-medium tracking-wide">
                {sprintStatusLabel(selectedSprint.status)}
              </Badge>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              {d.counts.open} việc đang mở · {d.counts.done} đã hoàn thành
            </div>
          )}
        </div>

        {/* Thanh Progress mini bên cạnh */}
        <div className="flex items-center gap-3 shrink-0 min-w-[170px]">
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span>Tiến độ</span>
              <span className="tabular-nums font-semibold text-foreground">{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-1.5 w-full" />
          </div>
        </div>
      </div>

      {project.canManage && <PendingReviewsCard projectId={project.id} />}

      <AnimatePresence mode="wait">
        <motion.div
          key={scope}
          variants={contentVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="space-y-5"
        >
          {/* Chế độ 1: Xem báo cáo & điều hành Sprint đang chọn (mặc định là Sprint hiện tại) */}
          {!isAllProject && selectedSprint ? (
            <div className="space-y-5">
              <SprintReportDetail
                key={selectedSprint.id}
                sprint={selectedSprint}
                sprints={sprintRows}
                canManage={canManage}
                onEdit={() => setEditingSprint(selectedSprint)}
                onOpenSprint={selectScope}
              />

              <Card className="border-border/80 hover:border-primary/30 transition-colors shadow-2xs">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" /> Hoạt động gần đây
                  </CardTitle>
                  <CardDescription className="text-xs">Dòng hoạt động dự án (UC-16) — tạo, chuyển cột, giao việc, bình luận, sprint.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <ActivityList projectId={project.id} limit={12} compact />
                </CardContent>
              </Card>
            </div>
          ) : d.counts.total === 0 && sprintRows.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Dự án chưa có công việc hoặc sprint"
              description="Tạo sprint đầu tiên hoặc để Trợ lý AI phân rã yêu cầu thành danh sách công việc."
              actionLabel="Mở Trợ lý AI"
              onAction={() => router.push(`/projects/${project.id}/assistant`)}
            />
          ) : (
            /* Chế độ 2: Tổng quan Toàn dự án (__all) */
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <Stat icon={ClipboardList} label="Tổng công việc" value={d.counts.total} />
                <Stat icon={CheckCircle2} label="Hoàn thành" value={d.counts.done} hint={`${progressPct}%`} tone="success" />
                <Stat icon={Clock} label="Đang mở" value={d.counts.open} />
                <Stat icon={AlertTriangle} label="Quá hạn" value={d.counts.overdue} tone={d.counts.overdue ? "destructive" : undefined} />
                <Stat icon={UserX} label="Chưa giao" value={d.counts.unassigned} tone={d.counts.unassigned ? "warning" : undefined} />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch">
                <Card className="border-border/80 hover:border-primary/30 transition-colors shadow-2xs">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm">Việc theo cột (Toàn dự án)</CardTitle>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => router.push(`/projects/${project.id}/work?sprint=__all`)}>
                        <Kanban className="h-3.5 w-3.5" /> Mở bảng
                      </Button>
                    </div>
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

                <Card className="border-border/80 hover:border-primary/30 transition-colors shadow-2xs flex flex-col">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users2 className="h-4 w-4 text-primary" /> Tải nhóm tuần này
                    </CardTitle>
                    <CardDescription className="text-xs">Mức sử dụng theo snapshot backend (docs 04 §3)</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-2 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      {d.workloadWeek.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-4">Chưa có snapshot tải tuần này — mở màn Nhân sự & kỹ năng và bấm &quot;Tính lại&quot;.</p>
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
                    </div>
                    <Button variant="outline" size="sm" className="w-full h-7 text-xs mt-2" onClick={() => router.push(`/projects/${project.id}/people`)}>
                      Xem chi tiết tải nhân sự
                    </Button>
                  </CardContent>
                </Card>

                <VelocityCard sprints={sprintRows} />
              </div>

              <Card className="border-border/80 hover:border-primary/30 transition-colors shadow-2xs">
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
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <SprintFormDialog
        projectId={project.id}
        sprints={sprintRows}
        editing={editingSprint}
        onClose={() => setEditingSprint(null)}
        onSaved={(s) => {
          setEditingSprint(null);
          invalidateSprints();
          selectScope(s.id);
        }}
      />
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Clock;
  label: string;
  value: number;
  hint?: string;
  tone?: "success" | "warning" | "destructive";
}) {
  const toneBg =
    tone === "success"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
      : tone === "warning"
      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
      : tone === "destructive"
      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
      : "bg-primary/10 text-primary border-primary/20";

  return (
    <motion.div whileHover={{ y: -2, transition: { duration: 0.12 } }} className="h-full">
      <Card className="border-border shadow-xs bg-card/80 h-full hover:border-primary/40 hover:shadow-sm transition-all">
        <CardContent className="p-4 flex items-center gap-3.5">
          <div className={cn("p-2.5 rounded-lg shrink-0 border", toneBg)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-2xl font-bold tabular-nums leading-none text-foreground tracking-tight">
              {value}
              {hint && <span className="text-xs text-muted-foreground font-normal ml-1.5">({hint})</span>}
            </div>
            <div className="text-xs font-medium text-muted-foreground mt-1.5 truncate">{label}</div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
