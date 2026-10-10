"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Inbox, ListChecks, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { PriorityBadge } from "@/components/app/PriorityBadge";
import { TaskTypeBadge } from "@/components/app/TaskTypeBadge";
import { UserAvatar } from "@/components/app/UserAvatar";
import { taskKeyOf } from "@/components/app/TaskCard";
import { useTaskMutations, useTasks } from "@/features/board/hooks";
import { api, describeError } from "@/lib/api";
import type { ProjectDetail, SprintView, TaskListItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { hrs, useInvalidateSprints } from "./shared";

/**
 * Lập kế hoạch sprint trên MỘT màn (docs 02/07 C1): Backlog | Sprint, chọn rồi chuyển qua lại.
 * Ghi: PM dùng POST /sprints/:id/tasks (một request cho cả lô); thành viên PATCH từng việc mang version.
 * Về backlog luôn là PATCH từng việc (không có endpoint gộp) — giữ khoá lạc quan như thanh hàng loạt.
 */
export function SprintPlanner({ project, sprint }: { project: ProjectDetail; sprint: SprintView }) {
  const backlog = useTasks(project.id, { backlog: true });
  const inSprint = useTasks(project.id, { sprintId: sprint.id });
  const mut = useTaskMutations(project.id);
  const invalidate = useInvalidateSprints(project.id);
  const [pickB, setPickB] = React.useState<Set<string>>(new Set());
  const [pickS, setPickS] = React.useState<Set<string>>(new Set());
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState<"in" | "out" | null>(null);
  React.useEffect(() => {
    setPickB(new Set());
    setPickS(new Set());
  }, [sprint.id]);

  const canEdit = project.canEdit && sprint.status !== "CLOSED";
  const filteredBacklog = React.useMemo(() => {
    const k = q.trim().toLowerCase();
    const rows = (backlog.data ?? []).slice().sort((a, b) => a.position - b.position);
    return k ? rows.filter((t) => t.title.toLowerCase().includes(k) || taskKeyOf(project.key, t).toLowerCase().includes(k)) : rows;
  }, [backlog.data, q, project.key]);

  const move = async (dir: "in" | "out") => {
    const ids = [...(dir === "in" ? pickB : pickS)];
    const rows = (dir === "in" ? backlog.data : inSprint.data) ?? [];
    const chosen = rows.filter((t) => ids.includes(t.id));
    if (!chosen.length) return;
    setBusy(dir);
    const failed: string[] = [];
    try {
      if (dir === "in" && project.canManage) {
        await api.post(`/sprints/${sprint.id}/tasks`, { taskIds: chosen.map((t) => t.id) });
      } else {
        for (const t of chosen) {
          try {
            await mut.update.mutateAsync({
              id: t.id,
              version: t.version,
              patch: { sprintId: dir === "in" ? sprint.id : null },
            });
          } catch (e) {
            failed.push(`${taskKeyOf(project.key, t)} (${describeError(e).code})`);
          }
        }
      }
      const ok = chosen.length - failed.length;
      if (failed.length)
        toast.warning(`Chuyển được ${ok}/${chosen.length} việc`, {
          description: failed.slice(0, 4).join(", "),
        });
      else toast.success(dir === "in" ? `Đã đưa ${ok} việc vào ${sprint.name}` : `Đã đưa ${ok} việc về backlog`);
    } catch (e) {
      toast.error("Không chuyển được", { description: describeError(e).code });
    } finally {
      setBusy(null);
      if (dir === "in") setPickB(new Set());
      else setPickS(new Set());
      invalidate();
    }
  };

  const sum = (rows: TaskListItem[]) => rows.reduce((s, t) => s + (t.estimateHours ?? 0), 0);

  return (
    <div className="space-y-2">
      {sprint.status === "ACTIVE" && canEdit && (
        <p className="text-sm text-muted-foreground">
          Sprint đang chạy: việc đưa vào lúc này làm <strong>phạm vi tăng</strong> so với cam kết lúc bắt đầu và được ghi là “thêm sau khi bắt đầu” trong báo cáo sprint.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Column
          title="Backlog"
          icon={Inbox}
          rows={filteredBacklog}
          total={backlog.data?.length ?? 0}
          hours={sum(backlog.data ?? [])}
          state={backlog}
          picked={pickB}
          setPicked={setPickB}
          canEdit={canEdit}
          projectId={project.id}
          projectKey={project.key}
          emptyTitle={q ? "Không có việc khớp" : "Backlog trống"}
          emptyText={q ? "Thử từ khoá khác." : "Mọi việc đều đã nằm trong một sprint."}
          toolbar={
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lọc theo tên hoặc mã" className="h-9 pl-8" aria-label="Lọc backlog" />
            </div>
          }
          action={
            canEdit && (
              <Button size="sm" disabled={!pickB.size || busy !== null} onClick={() => void move("in")} className="gap-1.5">
                {busy === "in" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Đưa vào sprint{pickB.size ? ` (${pickB.size})` : ""} <ArrowRight className="h-4 w-4" />
              </Button>
            )
          }
        />
        <Column
          title={`Trong ${sprint.name}`}
          icon={ListChecks}
          rows={(inSprint.data ?? []).slice().sort((a, b) => Number(!!a.completedAt) - Number(!!b.completedAt) || a.number - b.number)}
          total={inSprint.data?.length ?? 0}
          hours={sum(inSprint.data ?? [])}
          state={inSprint}
          picked={pickS}
          setPicked={setPickS}
          canEdit={canEdit}
          projectId={project.id}
          projectKey={project.key}
          emptyTitle="Sprint chưa có việc"
          emptyText="Chọn việc bên Backlog rồi bấm “Đưa vào sprint”."
          action={
            canEdit && (
              <Button size="sm" variant="outline" disabled={!pickS.size || busy !== null} onClick={() => void move("out")} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" /> Về backlog{pickS.size ? ` (${pickS.size})` : ""}
                {busy === "out" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              </Button>
            )
          }
        />
      </div>
    </div>
  );
}

function Column({
  title,
  icon: Icon,
  rows,
  total,
  hours,
  state,
  picked,
  setPicked,
  canEdit,
  projectId,
  projectKey,
  emptyTitle,
  emptyText,
  toolbar,
  action,
}: {
  title: string;
  icon: typeof Inbox;
  rows: TaskListItem[];
  total: number;
  hours: number;
  state: { isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown };
  picked: Set<string>;
  setPicked: (s: Set<string>) => void;
  canEdit: boolean;
  projectId: string;
  projectKey: string;
  emptyTitle: string;
  emptyText: string;
  toolbar?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const selectable = rows.filter((t) => !t.completedAt);
  const allPicked = selectable.length > 0 && selectable.every((t) => picked.has(t.id));
  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };
  return (
    <Card className="flex flex-col min-w-0">
      <CardHeader className="p-4 pb-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" /> {title}
            <span className="text-sm font-normal text-muted-foreground tabular-nums">
              {total} việc · {hrs(hours)}
            </span>
          </CardTitle>
          {canEdit && selectable.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setPicked(allPicked ? new Set() : new Set(selectable.map((t) => t.id)))}>
              {allPicked ? "Bỏ chọn" : "Chọn tất cả"}
            </Button>
          )}
        </div>
        {toolbar}
      </CardHeader>
      <CardContent className="p-0 flex-1">
        {state.isPending ? (
          <div className="space-y-2 p-4 pt-0">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : state.isError ? (
          <div className="p-4 pt-0">
            <ErrorState code={describeError(state.error).code} message={describeError(state.error).message} onRetry={() => state.refetch()} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Icon} title={emptyTitle} description={emptyText} className="py-10" />
        ) : (
          // Radix bọc nội dung trong display:table → truncate không ăn và hàng tràn ngang; ép về block
          // và giới hạn chiều cao theo nội dung thay vì cố định (1 việc thì không để trống cả khối)
          <ScrollArea className="[&>[data-radix-scroll-area-viewport]]:max-h-[420px] [&>[data-radix-scroll-area-viewport]>div]:!block">
            <ul className="divide-y divide-border/60">
              {rows.map((t) => {
                const key = taskKeyOf(projectKey, t);
                const done = !!t.completedAt;
                return (
                  <li key={t.id} className={cn("flex items-center gap-3 px-4 py-2.5 text-sm min-w-0", picked.has(t.id) && "bg-primary/5", done && "text-muted-foreground")}>
                    {canEdit && <Checkbox aria-label={`Chọn ${key}`} checked={picked.has(t.id)} disabled={done} onCheckedChange={() => toggle(t.id)} />}
                    <Button asChild variant="link" size="sm" className="h-auto p-0 font-mono text-xs text-muted-foreground shrink-0">
                      <Link href={`/projects/${projectId}/tasks/${key}`}>{key}</Link>
                    </Button>
                    <span className="hidden sm:inline-flex shrink-0">
                      <TaskTypeBadge type={t.type} size="icon" />
                    </span>
                    <span className={cn("flex-1 min-w-0 truncate", done && "line-through")} title={t.title}>
                      {t.title}
                    </span>
                    <span className="hidden sm:inline-flex shrink-0">
                      {done ? (
                        <Badge variant="success" className="text-xs">
                          Xong
                        </Badge>
                      ) : (
                        <PriorityBadge priority={t.priority} showIcon={false} />
                      )}
                    </span>
                    <span className="w-12 text-right tabular-nums text-muted-foreground shrink-0">{t.estimateHours != null ? `${t.estimateHours} h` : "—"}</span>
                    <div className="hidden sm:flex -space-x-1.5 w-10 justify-end shrink-0">
                      {t.assignees.slice(0, 2).map((a) => (
                        <UserAvatar key={a.id} name={a.shortName ?? a.fullName} avatar={a.avatarUrl ?? undefined} size="sm" className="ring-2 ring-card" />
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
      {action && <div className="flex justify-end border-t border-border/60 p-3">{action}</div>}
    </Card>
  );
}
