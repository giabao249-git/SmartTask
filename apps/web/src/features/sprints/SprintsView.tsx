"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, Flag, Pencil, Play, Plus, Square, Target, Users2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { PageHeader } from "@/components/app/PageHeader";
import { UserAvatar } from "@/components/app/UserAvatar";
import { useBoardRealtime } from "@/features/board/hooks";
import { describeError } from "@/lib/api";
import { useSprintSummary } from "@/lib/hooks/analytics";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { useSprints } from "@/lib/hooks/queries";
import { percentToWorkload, sprintStatusLabel, sprintStatusVariant } from "@/lib/status";
import type { SprintSummaryView, SprintView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SprintFormDialog } from "./SprintFormDialog";
import { SprintPlanner } from "./SprintPlanner";
import { StartSprintDialog } from "./StartSprintDialog";
import { CloseSprintDialog } from "./CloseSprintDialog";
import { dm, hrs, useInvalidateSprints } from "./shared";

const ORDER: Record<SprintView["status"], number> = { ACTIVE: 0, PLANNED: 1, CLOSED: 2 };
/** Màu thanh theo variant của lib/status (token, không hex) */
const BAR: Record<string, string> = {
  success: "[&>div]:bg-success",
  warning: "[&>div]:bg-warning",
  destructive: "[&>div]:bg-destructive",
};

/** Trang Sprint (UC-09, docs 02/07 C1): danh sách · lập kế hoạch · theo dõi — thay cho tab trong Cấu hình dự án. */
export function SprintsView() {
  const project = useCurrentProject();
  const router = useRouter();
  const params = useSearchParams();
  const sprints = useSprints(project.id);
  const invalidate = useInvalidateSprints(project.id);
  const [editing, setEditing] = React.useState<SprintView | "new" | null>(null);
  useBoardRealtime(project.id, { onTaskEvent: () => invalidate() });

  const rows = React.useMemo(
    () => [...(sprints.data ?? [])].sort((a, b) => ORDER[a.status] - ORDER[b.status] || (a.status === "CLOSED" ? b.startDate.localeCompare(a.startDate) : a.startDate.localeCompare(b.startDate))),
    [sprints.data],
  );
  const selectedId = params.get("sprint") ?? rows[0]?.id ?? null;
  const selected = rows.find((s) => s.id === selectedId) ?? rows[0] ?? null;
  const select = (id: string) => router.replace(`/projects/${project.id}/sprints?sprint=${id}`, { scroll: false });
  const can = project.canManage && project.status === "ACTIVE";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Sprint · ${project.key}`}
        description="Lập kế hoạch, theo dõi và xem lại từng sprint — số giờ, năng lực và rủi ro do hệ thống tính."
        breadcrumbs={[{ label: "Workspace", href: "/workspaces" }, { label: project.name, href: `/projects/${project.id}/dashboard` }, { label: "Sprint" }]}
      >
        {can && (
          <Button onClick={() => setEditing("new")} className="gap-1.5">
            <Plus className="h-4 w-4" /> Tạo sprint
          </Button>
        )}
      </PageHeader>

      {sprints.isPending ? (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <Skeleton className="h-72" />
          <Skeleton className="h-96" />
        </div>
      ) : sprints.isError ? (
        <ErrorState code={describeError(sprints.error).code} message={describeError(sprints.error).message} onRetry={() => sprints.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="Chưa có sprint"
          description="Tạo sprint đầu tiên, đưa việc từ backlog vào rồi bắt đầu."
          actionLabel={can ? "Tạo sprint" : undefined}
          onAction={can ? () => setEditing("new") : undefined}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr] items-start">
          <nav aria-label="Danh sách sprint" className="space-y-2">
            {rows.map((s) => (
              <SprintListItem key={s.id} s={s} active={s.id === selected?.id} onClick={() => select(s.id)} />
            ))}
          </nav>
          {selected && <SprintDetail key={selected.id} sprint={selected} sprints={rows} canManage={can} onEdit={() => setEditing(selected)} onOpenSprint={select} />}
        </div>
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

function SprintListItem({ s, active, onClick }: { s: SprintView; active: boolean; onClick: () => void }) {
  const total = s.taskCount ?? 0;
  const done = s.doneCount ?? 0;
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn("w-full h-auto justify-start text-left p-3 flex flex-col items-stretch gap-1.5 border rounded-lg", active ? "border-primary bg-primary/5" : "border-border/70")}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-medium truncate">{s.name}</span>
        <Badge variant={sprintStatusVariant(s.status)} className="text-xs shrink-0">
          {sprintStatusLabel(s.status)}
        </Badge>
      </span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {dm(s.startDate)} → {dm(s.endDate)} · {s.status === "CLOSED" ? `${done} việc xong` : `${done}/${total} việc xong · còn ${hrs(s.remainingHours ?? 0)}`}
      </span>
      <Progress value={total ? (done / total) * 100 : 0} className="h-1" />
    </Button>
  );
}

function SprintDetail({ sprint, sprints, canManage, onEdit, onOpenSprint }: { sprint: SprintView; sprints: SprintView[]; canManage: boolean; onEdit: () => void; onOpenSprint: (id: string) => void }) {
  const project = useCurrentProject();
  const summary = useSprintSummary(sprint.id);
  const invalidate = useInvalidateSprints(project.id);
  const [closing, setClosing] = React.useState(false);

  const [starting, setStarting] = React.useState(false);

  const s = summary.data;
  return (
    <div className="space-y-4 min-w-0">
      <Card>
        <CardHeader className="p-5 pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <CardTitle className="text-xl flex items-center gap-2">
                {sprint.name}
                <Badge variant={sprintStatusVariant(sprint.status)}>{sprintStatusLabel(sprint.status)}</Badge>
              </CardTitle>
              <CardDescription className="flex items-center gap-1.5 tabular-nums">
                <CalendarRange className="h-4 w-4" /> {dm(sprint.startDate)} → {dm(sprint.endDate)}
              </CardDescription>
            </div>
            {canManage && sprint.status !== "CLOSED" && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onEdit} className="gap-1.5">
                  <Pencil className="h-4 w-4" /> Sửa
                </Button>
                {sprint.status === "PLANNED" && (
                  <Button size="sm" onClick={() => setStarting(true)} className="gap-1.5">
                    <Play className="h-4 w-4" /> Bắt đầu sprint…
                  </Button>
                )}
                {sprint.status === "ACTIVE" && (
                  <Button size="sm" variant="secondary" onClick={() => setClosing(true)} className="gap-1.5">
                    <Square className="h-4 w-4" /> Kết thúc sprint…
                  </Button>
                )}
              </div>
            )}
          </div>
          <p className={cn("mt-3 flex items-start gap-2 text-sm", sprint.goal ? "text-foreground" : "text-muted-foreground")}>
            <Target className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
            {sprint.goal ?? "Chưa đặt mục tiêu sprint."}
          </p>
        </CardHeader>
        <CardContent className="p-5 pt-2">
          {summary.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : summary.isError ? (
            <ErrorState code={describeError(summary.error).code} message={describeError(summary.error).message} onRetry={() => summary.refetch()} />
          ) : s ? (
            <SummaryBlock s={s} />
          ) : null}
        </CardContent>
      </Card>

      {sprint.status !== "CLOSED" ? <SprintPlanner project={project} sprint={sprint} /> : s && <ClosedLists s={s} projectId={project.id} />}

      <StartSprintDialog sprint={sprint} sprints={sprints} summary={s} open={starting} onOpenChange={setStarting} onStarted={invalidate} onOpenSprint={onOpenSprint} />

      <CloseSprintDialog sprint={sprint} sprints={sprints} summary={s} members={project.members} open={closing} onOpenChange={setClosing} onClosed={invalidate} />
    </div>
  );
}

/** Thanh cam kết/năng lực + số theo người — số lấy nguyên văn GET /sprints/:id/summary. */
function SummaryBlock({ s }: { s: SprintSummaryView }) {
  const status = s.sprint.status;
  const load = status === "PLANNED" ? s.committedHours : s.remainingHours;
  const pct = s.capacityHours > 0 ? Math.round((load / s.capacityHours) * 100) : load > 0 ? 999 : 0;
  const level = percentToWorkload(pct);
  const over = load - s.capacityHours;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Việc xong" value={`${s.doneCount}/${s.taskCount}`} />
        <Stat label={status === "CLOSED" ? "Hoàn thành" : "Giờ còn lại"} value={hrs(status === "CLOSED" ? s.completedHours : s.remainingHours)} />
        <Stat
          label={status === "PLANNED" ? "Đang cam kết" : "Cam kết lúc bắt đầu"}
          value={hrs(s.committedHours)}
          hint={status !== "PLANNED" && s.scopeHours > s.committedHours ? `phạm vi nay ${hrs(s.scopeHours)}` : status === "PLANNED" ? "chốt khi bắt đầu" : undefined}
        />
        {status === "CLOSED" ? (
          <Stat
            label="Bị chuyển đi lúc đóng"
            value={`${s.carriedOut.length} việc`}
            hint={s.carriedOut.length ? `${hrs(s.carriedOut.reduce((x, t) => x + t.estimateHours, 0))} ước lượng` : undefined}
          />
        ) : (
          <Stat label="Chưa giao" value={`${s.unassigned.tasks} việc`} hint={s.unassigned.tasks ? hrs(s.unassigned.hours) : undefined} tone={s.unassigned.tasks ? "warning" : undefined} />
        )}
      </div>

      {status !== "CLOSED" && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span>
              {status === "PLANNED" ? "Cam kết" : "Còn lại"} <strong className="tabular-nums">{hrs(load)}</strong> / năng lực nhóm <strong className="tabular-nums">{hrs(s.capacityHours)}</strong>
            </span>
            <Badge variant={level.variant} className="tabular-nums">
              {pct > 500 ? "Không có năng lực" : `${pct}% · ${level.label}`}
            </Badge>
          </div>
          <Progress value={Math.min(100, pct)} className={cn("h-2", BAR[level.variant])} />
          <p className="text-xs text-muted-foreground">
            Cửa sổ {dm(s.window.from)} → {dm(s.window.to)}. Năng lực đã trừ họp, nghỉ, việc hành chính; <strong>chưa trừ</strong> việc ở dự án khác.
            {over > 0 && <span className="text-destructive"> Vượt {hrs(over)}.</span>}
          </p>
        </div>
      )}

      {status !== "CLOSED" && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Users2 className="h-4 w-4 text-muted-foreground" /> Theo người
          </h3>
          <ul className="space-y-2">
            {s.byAssignee
              .filter((p) => p.tasks > 0)
              .map((p) => {
                const ppct = p.capacityHours > 0 ? Math.round((p.remainingHours / p.capacityHours) * 100) : p.remainingHours > 0 ? 999 : 0;
                return (
                  <li key={p.userId} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[180px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      <UserAvatar name={p.shortName ?? p.fullName} avatar={p.avatarUrl ?? undefined} size="sm" />
                      <span className="truncate">{p.shortName ?? p.fullName}</span>
                    </span>
                    {/* Màu theo mức tải (docs 04 §3 qua lib/status) — quá năng lực phải thấy ngay, không phải thanh đen như mọi người */}
                    <Progress value={Math.min(100, ppct)} className={cn("h-1.5 col-span-2 sm:col-span-1 order-last sm:order-none", BAR[percentToWorkload(ppct).variant])} />
                    <span className="text-xs text-muted-foreground tabular-nums text-right">
                      {p.tasks} việc · {hrs(p.remainingHours)} / {hrs(p.capacityHours)}
                    </span>
                  </li>
                );
              })}
          </ul>
          {/* Người chưa nhận việc gộp một dòng — 5 dòng "0 việc · 0 h" chỉ là nhiễu */}
          {s.byAssignee.some((p) => p.tasks === 0) && (
            <p className="text-xs text-muted-foreground">
              Chưa nhận việc trong sprint:{" "}
              {s.byAssignee
                .filter((p) => p.tasks === 0)
                .map((p) => `${p.shortName ?? p.fullName} (${hrs(p.capacityHours)})`)
                .join(", ")}
              .
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ClosedLists({ s, projectId }: { s: SprintSummaryView; projectId: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <BriefList title={`Đã xong (${s.completed.length})`} rows={s.completed} projectId={projectId} empty="Không việc nào xong trong sprint này." />
      <BriefList title={`Bị chuyển đi lúc đóng (${s.carriedOut.length})`} rows={s.carriedOut} projectId={projectId} empty="Không có việc dở lúc đóng (hoặc sprint đóng trước khi có nhật ký này)." />
    </div>
  );
}

function BriefList({ title, rows, projectId, empty }: { title: string; rows: SprintSummaryView["completed"]; projectId: string; empty: string }) {
  const router = useRouter();
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((t) => (
              <li key={t.id}>
                <Button variant="ghost" onClick={() => router.push(`/projects/${projectId}/tasks/${t.key}`)} className="w-full h-auto justify-start gap-3 rounded-none px-4 py-2.5 text-sm font-normal">
                  <span className="font-mono text-xs text-muted-foreground shrink-0">{t.key}</span>
                  <span className="flex-1 truncate text-left">{t.title}</span>
                  <span className="tabular-nums text-muted-foreground shrink-0">{hrs(t.estimateHours)}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "warning" }) {
  return (
    <div className="rounded-lg border border-border/70 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("text-lg font-semibold tabular-nums", tone === "warning" && "text-warning-foreground")}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
