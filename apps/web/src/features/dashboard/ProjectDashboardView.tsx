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
import { SprintPill, SprintReportDetail } from "@/features/sprints/SprintsView";
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
import { useCurrentProject } from "@/lib/hooks/use-project";
import { useSprints } from "@/lib/hooks/queries";
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
          ORDER[a.status] - ORDER[b.status] ||
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
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => router.push(`/projects/${project.id}/settings`)}>
            <Settings2 className="h-4 w-4" /> Cấu hình
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => router.push(`/projects/${project.id}/assistant`)}>
            <Bot className="h-4 w-4" /> Trợ lý AI
          </Button>
        </div>
      </PageHeader>

      {/* Thanh chuyển đổi phạm vi: Mặc định chọn Sprint hiện tại, hoặc chuyển sang Sprint khác / Toàn dự án */}
      <nav aria-label="Chọn phạm vi báo cáo" className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {sprintRows.map((s) => (
          <SprintPill key={s.id} s={s} active={!isAllProject && s.id === selectedSprint?.id} onClick={() => selectScope(s.id)} />
        ))}
        <ProjectOverviewPill
          total={d.counts.total}
          done={d.counts.done}
          open={d.counts.open}
          active={isAllProject}
          onClick={() => selectScope("__all")}
        />
      </nav>

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

function ProjectOverviewPill({
  total,
  done,
  open,
  active,
  onClick,
}: {
  total: number;
  done: number;
  open: number;
  active: boolean;
  onClick: () => void;
}) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <motion.button
      type="button"
      whileHover={{ y: -1, transition: { duration: 0.12 } }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(
        "group shrink-0 text-left px-3.5 py-2.5 rounded-xl border transition-all min-w-[210px] max-w-[260px] space-y-1.5 cursor-pointer",
        active
          ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/20"
          : "border-border/70 bg-card hover:border-border hover:bg-muted/30",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-xs text-foreground flex items-center gap-1.5 truncate">
          <FolderKanban className="h-3.5 w-3.5 text-primary shrink-0" /> Toàn dự án
        </span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
          Tổng hợp
        </Badge>
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
        <span>{open} đang mở</span>
        <span>
          {done}/{total} việc
        </span>
      </div>
      <Progress value={pct} className="h-1" />
    </motion.button>
  );
}

function Stat({ icon: Icon, label, value, hint, tone }: { icon: typeof Clock; label: string; value: number; hint?: string; tone?: "success" | "warning" | "destructive" }) {
  const toneClass = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : "text-primary";
  return (
    <motion.div
      whileHover={{ y: -2, transition: { duration: 0.12 } }}
      className="h-full"
    >
      <Card className="border-border/80 h-full hover:border-primary/40 hover:shadow-2xs transition-all">
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
    </motion.div>
  );
}
