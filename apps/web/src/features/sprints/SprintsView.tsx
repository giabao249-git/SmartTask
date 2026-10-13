"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarRange,
  CheckCircle2,
  Clock,
  Flag,
  FolderGit2,
  Kanban,
  ListTodo,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Square,
  Target,
  Users2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { PageHeader } from "@/components/app/PageHeader";
import { TaskDetailModal } from "@/components/app/TaskDetailModal";
import { UserAvatar } from "@/components/app/UserAvatar";
import { useBoardRealtime } from "@/features/board/hooks";
import { describeError } from "@/lib/api";
import { useSprintSummary } from "@/lib/hooks/analytics";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { useSprints } from "@/lib/hooks/queries";
import { percentToWorkload, sprintStatusLabel, sprintStatusVariant } from "@/lib/status";
import type { SprintSummaryView, SprintTaskBrief, SprintView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SprintFormDialog } from "./SprintFormDialog";
import { StartSprintDialog } from "./StartSprintDialog";
import { CloseSprintDialog } from "./CloseSprintDialog";
import { VelocityCard } from "./VelocityCard";
import { BurndownCard } from "./BurndownCard";
import { dm, hrs, useInvalidateSprints } from "./shared";

const ORDER: Record<SprintView["status"], number> = { ACTIVE: 0, PLANNED: 1, CLOSED: 2 };
/** Màu thanh theo variant của lib/status (token, không hex) */
const BAR: Record<string, string> = {
  success: "[&>div]:bg-success",
  warning: "[&>div]:bg-warning",
  destructive: "[&>div]:bg-destructive",
};

/**
 * Màn hình Báo cáo & Quản trị Chu kỳ Sprint (UC-09, UC-30/31):
 * Tập trung hoàn toàn vào báo cáo tiến độ, burn-down, vận tốc, phân bổ tải thành viên và biến động phạm vi (scope creep).
 * Việc thao tác/kéo thả task thực hiện trực tiếp tại màn Công việc (/work).
 */
export function SprintsView() {
  const project = useCurrentProject();
  const router = useRouter();
  const params = useSearchParams();
  const sprints = useSprints(project.id);
  const invalidate = useInvalidateSprints(project.id);
  const [editing, setEditing] = React.useState<SprintView | "new" | null>(null);
  useBoardRealtime(project.id, { onTaskEvent: () => invalidate() });

  const rows = React.useMemo(
    () =>
      [...(sprints.data ?? [])].sort(
        (a, b) =>
          ORDER[a.status] - ORDER[b.status] ||
          (a.status === "CLOSED" ? b.startDate.localeCompare(a.startDate) : a.startDate.localeCompare(b.startDate)),
      ),
    [sprints.data],
  );
  const selectedId = params.get("sprint") ?? rows[0]?.id ?? null;
  const selected = rows.find((s) => s.id === selectedId) ?? rows[0] ?? null;
  const select = (id: string) => router.replace(`/projects/${project.id}/dashboard?sprint=${id}`, { scroll: false });
  const can = project.canManage && project.status === "ACTIVE";

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Báo cáo Sprint · ${project.key}`}
        description="Theo dõi tiến độ, burn-down, vận tốc nhóm và biến động phạm vi của từng sprint."
        breadcrumbs={[
          { label: "Workspace", href: "/workspaces" },
          { label: project.name, href: `/projects/${project.id}/dashboard` },
          { label: "Sprint" },
        ]}
      >
        <div className="flex items-center gap-2">
          {selected && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => router.push(`/projects/${project.id}/work?sprint=${selected.id}`)}
            >
              <Kanban className="h-4 w-4" /> Mở bảng công việc
            </Button>
          )}
          {can && (
            <Button size="sm" onClick={() => setEditing("new")} className="gap-1.5">
              <Plus className="h-4 w-4" /> Tạo sprint
            </Button>
          )}
        </div>
      </PageHeader>

      {sprints.isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
        </div>
      ) : sprints.isError ? (
        <ErrorState code={describeError(sprints.error).code} message={describeError(sprints.error).message} onRetry={() => sprints.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="Chưa có sprint"
          description="Tạo sprint đầu tiên để bắt đầu lập kế hoạch và theo dõi báo cáo."
          actionLabel={can ? "Tạo sprint" : undefined}
          onAction={can ? () => setEditing("new") : undefined}
        />
      ) : (
        <>
          {/* Thanh chọn Sprint ngang: xem nhanh tiến độ mọi sprint và chuyển báo cáo bằng 1 chạm */}
          <nav
            aria-label="Danh sách sprint"
            className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1"
          >
            {rows.map((s) => (
              <SprintPill key={s.id} s={s} active={s.id === selected?.id} onClick={() => select(s.id)} />
            ))}
          </nav>

          {selected && (
            <SprintReportDetail
              key={selected.id}
              sprint={selected}
              sprints={rows}
              canManage={can}
              onEdit={() => setEditing(selected)}
              onOpenSprint={select}
            />
          )}
        </>
      )}

      <SprintFormDialog
        projectId={project.id}
        sprints={rows}
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={(s) => {
          setEditing(null);
          invalidate();
          select(s.id);
        }}
      />
    </div>
  );
}

/** Thẻ chọn sprint trên thanh ngang. */
export function SprintPill({ s, active, onClick }: { s: SprintView; active: boolean; onClick: () => void }) {
  const total = s.taskCount ?? 0;
  const done = s.doneCount ?? 0;
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
        <span className="font-semibold text-xs text-foreground truncate">{s.name}</span>
        <Badge variant={sprintStatusVariant(s.status)} className="text-[10px] px-1.5 py-0 shrink-0">
          {sprintStatusLabel(s.status)}
        </Badge>
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
        <span>
          {dm(s.startDate)} → {dm(s.endDate)}
        </span>
        <span>
          {done}/{total} việc
        </span>
      </div>
      <Progress value={pct} className="h-1" />
    </motion.button>
  );
}

export function SprintReportDetail({
  sprint,
  sprints,
  canManage,
  onEdit,
  onOpenSprint,
}: {
  sprint: SprintView;
  sprints: SprintView[];
  canManage: boolean;
  onEdit: () => void;
  onOpenSprint: (id: string) => void;
}) {
  const project = useCurrentProject();
  const router = useRouter();
  const summary = useSprintSummary(sprint.id);
  const invalidate = useInvalidateSprints(project.id);
  const [closing, setClosing] = React.useState(false);
  const [starting, setStarting] = React.useState(false);
  const [taskModalId, setTaskModalId] = React.useState<string | null>(null);

  const s = summary.data;

  return (
    <div className="space-y-5 min-w-0">
      {/* Khối 1: Tổng quan Sprint + Điều hành chu kỳ */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="p-5 pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-xl">{sprint.name}</CardTitle>
                <Badge variant={sprintStatusVariant(sprint.status)}>{sprintStatusLabel(sprint.status)}</Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1 tabular-nums ml-1">
                  <CalendarRange className="h-3.5 w-3.5" /> {dm(sprint.startDate)} → {dm(sprint.endDate)}
                </span>
              </div>
              <p className={cn("flex items-start gap-1.5 text-xs sm:text-sm", sprint.goal ? "text-foreground/90" : "text-muted-foreground")}>
                <Target className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                {sprint.goal ?? "Chưa đặt mục tiêu sprint."}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/projects/${project.id}/work?sprint=${sprint.id}`)}
                className="h-8 text-xs gap-1.5"
              >
                <Kanban className="h-3.5 w-3.5" /> Mở bảng công việc
              </Button>
              {canManage && sprint.status !== "CLOSED" && (
                <>
                  <Button variant="outline" size="sm" onClick={onEdit} className="h-8 text-xs gap-1.5">
                    <Pencil className="h-3.5 w-3.5" /> Sửa
                  </Button>
                  {sprint.status === "PLANNED" && (
                    <Button size="sm" onClick={() => setStarting(true)} className="h-8 text-xs gap-1.5">
                      <Play className="h-3.5 w-3.5" /> Bắt đầu sprint…
                    </Button>
                  )}
                  {sprint.status === "ACTIVE" && (
                    <Button size="sm" variant="secondary" onClick={() => setClosing(true)} className="h-8 text-xs gap-1.5">
                      <Square className="h-3.5 w-3.5" /> Kết thúc sprint…
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-2">
          {summary.isPending ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : summary.isError ? (
            <ErrorState code={describeError(summary.error).code} message={describeError(summary.error).message} onRetry={() => summary.refetch()} />
          ) : s ? (
            <OverviewKPIs s={s} />
          ) : null}
        </CardContent>
      </Card>

      {/* Khối 2: Biểu đồ Burn-down & Phân bổ tải / Vận tốc đặt cạnh nhau cân đối */}
      <div className="grid gap-4 lg:grid-cols-2 items-stretch">
        <BurndownCard sprintId={sprint.id} status={sprint.status} onOpenTask={(id) => setTaskModalId(id)} />

        <div className="space-y-4 flex flex-col min-w-0">
          {s && <MemberWorkloadCard s={s} />}
          <VelocityCard sprints={sprints} />
        </div>
      </div>

      {/* Khối 3: Báo cáo phân loại công việc trong Sprint (xem trực tiếp cho cả Đang chạy, Kế hoạch và Đã đóng) */}
      {s && (
        <SprintTasksReport
          s={s}
          projectId={project.id}
          onOpenTask={(id) => setTaskModalId(id)}
          onGoToWork={() => router.push(`/projects/${project.id}/work?sprint=${sprint.id}`)}
        />
      )}

      <TaskDetailModal
        taskId={taskModalId}
        project={project}
        open={!!taskModalId}
        onOpenChange={(o) => !o && setTaskModalId(null)}
        onOpenFullPage={() => {
          if (!taskModalId) return;
          const allTasks = [...(s?.open ?? []), ...(s?.completed ?? []), ...(s?.carriedOut ?? [])];
          const found = allTasks.find((x) => x.id === taskModalId);
          setTaskModalId(null);
          if (found) router.push(`/projects/${project.id}/tasks/${found.key}`);
        }}
      />

      <StartSprintDialog
        sprint={sprint}
        sprints={sprints}
        summary={s}
        open={starting}
        onOpenChange={setStarting}
        onStarted={invalidate}
        onOpenSprint={onOpenSprint}
      />

      <CloseSprintDialog
        sprint={sprint}
        sprints={sprints}
        summary={s}
        members={project.members}
        open={closing}
        onOpenChange={setClosing}
        onClosed={invalidate}
      />
    </div>
  );
}

/** 4 ô KPI + Thanh cân đối Cam kết / Năng lực nhóm. */
function OverviewKPIs({ s }: { s: SprintSummaryView }) {
  const status = s.sprint.status;
  const load = status === "PLANNED" ? s.committedHours : s.remainingHours;
  const pct = s.capacityHours > 0 ? Math.round((load / s.capacityHours) * 100) : load > 0 ? 999 : 0;
  const level = percentToWorkload(pct);
  const over = load - s.capacityHours;
  const donePct = s.taskCount > 0 ? Math.round((s.doneCount / s.taskCount) * 100) : 0;
  const scopeDelta = s.scopeHours - s.committedHours;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label="Tiến độ công việc"
          value={`${s.doneCount} / ${s.taskCount} việc`}
          hint={`${donePct}% hoàn thành`}
        />
        <Stat
          label={status === "CLOSED" ? "Giờ hoàn thành" : "Giờ còn lại"}
          value={hrs(status === "CLOSED" ? s.completedHours : s.remainingHours)}
          hint={status !== "CLOSED" ? `đã xong ${hrs(s.completedHours)}` : `trên phạm vi ${hrs(s.scopeHours)}`}
        />
        <Stat
          label={status === "PLANNED" ? "Đang cam kết" : "Cam kết ban đầu"}
          value={hrs(s.committedHours)}
          hint={
            status !== "PLANNED" && scopeDelta > 0
              ? `phạm vi hiện tại ${hrs(s.scopeHours)} (+${hrs(scopeDelta)})`
              : status === "PLANNED"
                ? "chốt làm chuẩn khi bắt đầu"
                : "phạm vi ổn định"
          }
          tone={status !== "PLANNED" && scopeDelta > 0 ? "warning" : undefined}
        />
        {status === "CLOSED" ? (
          <Stat
            label="Chuyển đi lúc đóng"
            value={`${s.carriedOut.length} việc`}
            hint={s.carriedOut.length ? `${hrs(s.carriedOut.reduce((x, t) => x + t.estimateHours, 0))} ước lượng` : "hoàn tất trọn vẹn"}
          />
        ) : (
          <Stat
            label="Việc chưa giao"
            value={`${s.unassigned.tasks} việc`}
            hint={s.unassigned.tasks ? `${hrs(s.unassigned.hours)} chưa có người nhận` : "tất cả việc đã có người phụ trách"}
            tone={s.unassigned.tasks ? "warning" : undefined}
          />
        )}
      </div>

      {status !== "CLOSED" && (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
            <span>
              {status === "PLANNED" ? "Giờ cam kết" : "Giờ còn lại"} <strong className="tabular-nums">{hrs(load)}</strong> / năng lực nhóm{" "}
              <strong className="tabular-nums">{hrs(s.capacityHours)}</strong>
            </span>
            <Badge variant={level.variant} className="tabular-nums text-xs">
              {pct > 500 ? "Không có năng lực" : `${pct}% · ${level.label}`}
            </Badge>
          </div>
          <Progress value={Math.min(100, pct)} className={cn("h-2", BAR[level.variant])} />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Cửa sổ {dm(s.window.from)} → {dm(s.window.to)} (đã trừ họp, nghỉ, hành chính).
              {over > 0 && <strong className="text-destructive ml-1">Vượt năng lực {hrs(over)}.</strong>}
            </span>
            {s.velocity.avgCompletedHours !== null && (
              <span className="tabular-nums">
                Vận tốc TB {s.velocity.sprints.length} sprint trước: <strong>{hrs(s.velocity.avgCompletedHours)}</strong>/sprint
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Thẻ Phân bổ tải theo thành viên trong Sprint. */
function MemberWorkloadCard({ s }: { s: SprintSummaryView }) {
  const activeMembers = s.byAssignee.filter((p) => p.tasks > 0);
  const idleMembers = s.byAssignee.filter((p) => p.tasks === 0);

  return (
    <Card className="flex-1">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users2 className="h-4 w-4 text-muted-foreground" /> Phân bổ theo thành viên
          </CardTitle>
          <span className="text-xs text-muted-foreground tabular-nums">
            {activeMembers.length}/{s.byAssignee.length} người có việc
          </span>
        </div>
        <CardDescription className="text-xs">
          Số việc và giờ còn lại so với năng lực khả dụng của từng người trong sprint.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-2 space-y-3">
        {activeMembers.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3">Chưa có thành viên nào được giao việc trong sprint này.</p>
        ) : (
          <ul className="space-y-2.5">
            {activeMembers.map((p) => {
              const ppct = p.capacityHours > 0 ? Math.round((p.remainingHours / p.capacityHours) * 100) : p.remainingHours > 0 ? 999 : 0;
              const lv = percentToWorkload(ppct);
              return (
                <li key={p.userId} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-2 min-w-0 font-medium">
                      <UserAvatar name={p.shortName ?? p.fullName} avatar={p.avatarUrl ?? undefined} size="sm" />
                      <span className="truncate">{p.fullName}</span>
                    </span>
                    <span className="text-muted-foreground tabular-nums shrink-0">
                      <strong className="text-foreground">{p.tasks}</strong> việc · {hrs(p.remainingHours)} / {hrs(p.capacityHours)}{" "}
                      <span className="font-mono text-[11px]">({ppct > 500 ? "∞" : `${ppct}%`})</span>
                    </span>
                  </div>
                  <Progress value={Math.min(100, ppct)} className={cn("h-1.5", BAR[lv.variant])} />
                </li>
              );
            })}
          </ul>
        )}

        {idleMembers.length > 0 && (
          <p className="text-xs text-muted-foreground pt-1 border-t border-border/50">
            Chưa nhận việc trong sprint:{" "}
            {idleMembers.map((p) => `${p.shortName ?? p.fullName} (trống ${hrs(p.capacityHours)})`).join(", ")}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Báo cáo chi tiết các nhóm công việc của Sprint (cho cả ACTIVE, PLANNED, CLOSED):
 * Đang mở · Đã hoàn thành · Thêm sau khi bắt đầu (Scope creep) · Chuyển vào · Chuyển đi.
 */
function SprintTasksReport({
  s,
  projectId: _projectId,
  onOpenTask,
  onGoToWork,
}: {
  s: SprintSummaryView;
  projectId: string;
  onOpenTask: (id: string) => void;
  onGoToWork: () => void;
}) {
  const project = useCurrentProject();
  const closed = s.sprint.status === "CLOSED";
  const defaultTab = closed ? "completed" : "open";

  const sumEst = (list: SprintTaskBrief[]) => list.reduce((n, t) => n + t.estimateHours, 0);

  return (
    <Card className="border-border/80">
      <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between gap-2 flex-wrap border-b border-border/60">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-muted-foreground" /> Chi tiết công việc trong {s.sprint.name}
          </CardTitle>
          <CardDescription className="text-xs">
            Bấm vào công việc để xem/chỉnh sửa nhanh, hoặc mở trên Bảng công việc để kéo thả và lọc sâu.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={onGoToWork}>
          Điều phối trên Bảng công việc <ArrowUpRight className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        <Tabs defaultValue={defaultTab} className="space-y-3">
          <div className="overflow-x-auto -mx-1 px-1">
            <TabsList className="h-9 p-1 bg-muted/60 rounded-lg gap-0.5 inline-flex w-full sm:w-auto justify-start">
              {!closed && (
                <TabsTrigger value="open" className="text-xs h-7 px-2.5 gap-1.5 shrink-0">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Chưa xong</span>
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 font-mono h-4">
                    {s.open.length}
                  </Badge>
                </TabsTrigger>
              )}
              <TabsTrigger value="completed" className="text-xs h-7 px-2.5 gap-1.5 shrink-0">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Đã xong</span>
                <Badge variant="secondary" className="text-[10px] px-1 py-0 font-mono h-4">
                  {s.completed.length}
                </Badge>
              </TabsTrigger>
              {s.addedAfterStart.length > 0 && (
                <TabsTrigger value="added" className="text-xs h-7 px-2.5 gap-1.5 shrink-0">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Thêm giữa chừng</span>
                  <Badge variant="warning" className="text-[10px] px-1 py-0 font-mono h-4">
                    {s.addedAfterStart.length}
                  </Badge>
                </TabsTrigger>
              )}
              {s.carriedIn.length > 0 && (
                <TabsTrigger value="carriedIn" className="text-xs h-7 px-2.5 gap-1.5 shrink-0">
                  <FolderGit2 className="h-3.5 w-3.5" />
                  <span>Từ sprint trước</span>
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 font-mono h-4">
                    {s.carriedIn.length}
                  </Badge>
                </TabsTrigger>
              )}
              {closed && (
                <TabsTrigger value="carriedOut" className="text-xs h-7 px-2.5 gap-1.5 shrink-0">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Chuyển đi lúc đóng</span>
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 font-mono h-4">
                    {s.carriedOut.length}
                  </Badge>
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          {!closed && (
            <TabsContent value="open" className="mt-0">
              <TaskBriefTable
                rows={s.open}
                members={project.members}
                empty="Không còn công việc nào đang mở trong sprint này."
                summaryText={`${s.open.length} việc đang mở · tổng ước lượng ${hrs(sumEst(s.open))}`}
                onOpenTask={onOpenTask}
              />
            </TabsContent>
          )}

          <TabsContent value="completed" className="mt-0">
            <TaskBriefTable
              rows={s.completed}
              members={project.members}
              empty="Chưa có công việc nào hoàn thành trong sprint này."
              summaryText={`${s.completed.length} việc đã xong · tổng ước lượng ${hrs(sumEst(s.completed))}`}
              onOpenTask={onOpenTask}
            />
          </TabsContent>

          {s.addedAfterStart.length > 0 && (
            <TabsContent value="added" className="mt-0">
              <TaskBriefTable
                rows={s.addedAfterStart}
                members={project.members}
                empty="Phạm vi không đổi sau khi bắt đầu."
                summaryText={`${s.addedAfterStart.length} việc đưa vào sau khi sprint đã bắt đầu (+${hrs(sumEst(s.addedAfterStart))})`}
                onOpenTask={onOpenTask}
              />
            </TabsContent>
          )}

          {s.carriedIn.length > 0 && (
            <TabsContent value="carriedIn" className="mt-0">
              <TaskBriefTable
                rows={s.carriedIn}
                members={project.members}
                empty=""
                summaryText={`${s.carriedIn.length} việc chuyển từ sprint trước sang (${hrs(sumEst(s.carriedIn))})`}
                onOpenTask={onOpenTask}
              />
            </TabsContent>
          )}

          {closed && (
            <TabsContent value="carriedOut" className="mt-0">
              <TaskBriefTable
                rows={s.carriedOut}
                members={project.members}
                empty="Không có việc dở lúc đóng sprint."
                summaryText={`${s.carriedOut.length} việc chưa xong lúc đóng (${hrs(sumEst(s.carriedOut))})`}
                onOpenTask={onOpenTask}
              />
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function TaskBriefTable({
  rows,
  members,
  empty,
  summaryText,
  onOpenTask,
}: {
  rows: SprintTaskBrief[];
  members: { id: string; fullName: string; shortName: string | null; avatarUrl: string | null }[];
  empty: string;
  summaryText: string;
  onOpenTask: (id: string) => void;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">{empty}</p>;
  }
  const findMember = (id: string) => members.find((m) => m.id === id);

  return (
    <div className="space-y-2">
      <div className="text-[11px] text-muted-foreground tabular-nums">{summaryText}</div>
      <div className="rounded-lg border border-border/60 divide-y divide-border/60 overflow-hidden">
        {rows.map((t) => {
          const assignees = t.assigneeIds.map(findMember).filter((x): x is NonNullable<typeof x> => !!x);
          const done = !!t.completedAt;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onOpenTask(t.id)}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs hover:bg-muted/50 transition-colors text-left"
            >
              <Badge variant="outline" className="font-mono text-[11px] px-1.5 py-0 shrink-0">
                {t.key}
              </Badge>
              <span className={cn("flex-1 min-w-0 truncate font-medium text-foreground", done && "line-through text-muted-foreground")}>
                {t.title}
              </span>
              <div className="flex items-center -space-x-1.5 shrink-0">
                {assignees.length > 0 ? (
                  assignees.slice(0, 2).map((a) => (
                    <UserAvatar
                      key={a.id}
                      name={a.shortName ?? a.fullName}
                      avatar={a.avatarUrl ?? undefined}
                      size="sm"
                      className="ring-2 ring-background"
                    />
                  ))
                ) : (
                  <span className="text-[11px] text-muted-foreground italic">chưa giao</span>
                )}
              </div>
              <span className="w-20 text-right font-mono text-[11px] text-muted-foreground tabular-nums shrink-0">
                {done ? hrs(t.estimateHours) : `${hrs(t.remainingHours)} / ${hrs(t.estimateHours)}`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Ô số KPI. */
function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "warning" }) {
  return (
    <motion.div
      whileHover={{ y: -2, transition: { duration: 0.12 } }}
      className="rounded-lg border border-border/70 bg-card/60 p-3.5 space-y-1 hover:border-primary/40 hover:shadow-2xs transition-all"
    >
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        {tone === "warning" && <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" aria-hidden />}
        <span className="truncate">{label}</span>
      </div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground truncate">{hint}</div>}
    </motion.div>
  );
}
