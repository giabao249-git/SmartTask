"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Info, RefreshCw, Scale, Users2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { UserAvatar } from "@/components/app/UserAvatar";
import { WorkloadBadge } from "@/components/app/WorkloadBadge";
import { api, describeError } from "@/lib/api";
import { useCapacityTable, useProjectWorkload, useWorkloadDetails } from "@/lib/hooks/analytics";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { levelToVariant, projectRoleLabel, riskFactorLabel, workloadLevelLabel } from "@/lib/status";
import { useSprints } from "@/lib/hooks/queries";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dm, hrs, pct, vn } from "@/features/people/format";
import type { CapacityTableView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const fmtWeek = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** Tải nhân sự theo tuần (tab trong màn Nhân sự) (UC-24/25): GET /projects/:id/workload (người × tuần), chi tiết cấu thành, bảng năng lực (UC-26, không xếp hạng). */
export function WorkloadView() {
  const project = useCurrentProject();
  const router = useRouter();
  const qc = useQueryClient();
  const wl = useProjectWorkload(project.id, 4);
  const [detail, setDetail] = React.useState<{ userId: string; week: string } | null>(null);
  const recompute = useMutation({
    mutationFn: () => api.post<unknown>(`/projects/${project.id}/workload/recompute`),
    onSuccess: () => {
      toast.success("Đã tính lại tải — snapshot & cảnh báo cập nhật");
      void qc.invalidateQueries({ queryKey: ["projects", project.id] });
    },
    onError: (e) => toast.error(describeError(e).message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground">Mức sử dụng = giờ việc còn lại rơi vào tuần ÷ giờ làm được trong tuần (đã trừ họp, nghỉ). Bấm một ô để xem gồm những việc nào.</p>
        <div className="flex items-center gap-2">
          {project.canManage && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" disabled={recompute.isPending} onClick={() => recompute.mutate()}>
              <RefreshCw className={cn("h-3.5 w-3.5", recompute.isPending && "animate-spin")} /> Tính lại
            </Button>
          )}
          {project.canManage && (
            <Button
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => router.push(`/projects/${project.id}/assistant?prompt=${encodeURIComponent("Ai đang quá tải tuần này? Đề xuất cân bằng lại tải cho nhóm.")}`)}
            >
              <Scale className="h-3.5 w-3.5" /> Nhờ Trợ lý AI đề xuất cân bằng
            </Button>
          )}
        </div>
      </div>

      {wl.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : wl.isError ? (
        <ErrorState code={describeError(wl.error).code} message={describeError(wl.error).message} onRetry={() => wl.refetch()} />
      ) : wl.data.users.length === 0 ? (
        <EmptyState icon={Users2} title="Chưa có thành viên" description="Thêm thành viên vào dự án để tính tải." />
      ) : (
        <Card className="border-border/80">
          <CardHeader className="p-4 pb-2 flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm">Mức sử dụng 4 tuần tới</CardTitle>
              <CardDescription className="text-xs">
                Ngưỡng: cao {pct(wl.data.thresholds.high)} · đầy {pct(wl.data.thresholds.full)} · quá tải {pct(wl.data.thresholds.overload)} · chênh lệch tải trong nhóm {pct(wl.data.spread)}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0 sm:p-4 sm:pt-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 bg-card text-xs">Thành viên</TableHead>
                  {wl.data.users[0].weeks.map((w) => (
                    <TableHead key={w.weekStart} className="min-w-28 text-xs text-center whitespace-nowrap">
                      Tuần {fmtWeek(w.weekStart)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {wl.data.users.map((u) => (
                  <TableRow key={u.userId}>
                    <TableCell className="sticky left-0 z-10 bg-card text-xs">
                      <div className="flex items-center gap-2">
                        <UserAvatar name={u.fullName} avatar={u.avatarUrl ?? undefined} size="sm" />
                        <span className="font-medium whitespace-nowrap">
                          <span className="sm:hidden">{u.shortName?.replace(/\s*\(.*\)$/, "") ?? u.fullName}</span>
                          <span className="hidden sm:inline">{u.fullName}</span>
                        </span>
                      </div>
                    </TableCell>
                    {u.weeks.map((w) => (
                      <TableCell key={w.weekStart} className="p-1.5">
                        <Button
                          variant="ghost"
                          onClick={() => setDetail({ userId: u.userId, week: w.weekStart })}
                          className={cn("w-full h-auto flex flex-col items-center gap-0.5 py-1.5 rounded-md border font-normal", levelBg(w.level))}
                          aria-label={`${u.fullName} tuần ${fmtWeek(w.weekStart)}: ${pct(w.utilization)}, ${workloadLevelLabel(w.level)}`}
                        >
                          <span className="text-sm font-semibold tabular-nums text-foreground">{pct(w.utilization)}</span>
                          <span className="text-[11px] tabular-nums text-muted-foreground">
                            {vn(w.effLoadHours)} / {hrs(w.effCapacityHours)}
                          </span>
                          {w.level !== "NORMAL" && <WorkloadBadge level={w.level} className="text-[10px] px-1.5 py-0" />}
                        </Button>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {detail && <WeekDetail userId={detail.userId} week={detail.week} name={wl.data?.users.find((u) => u.userId === detail.userId)?.fullName ?? ""} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function levelBg(level: string): string {
  switch (level) {
    case "OVERLOAD":
      return "border-destructive/40 bg-destructive/10";
    case "FULL":
    case "HIGH":
      return "border-warning/40 bg-warning/10";
    default:
      return "border-success/30 bg-success/5";
  }
}

function WeekDetail({ userId, week, name }: { userId: string; week: string; name: string }) {
  const q = useWorkloadDetails(userId, week);
  return (
    <>
      <SheetHeader>
        <SheetTitle className="text-base">
          {name} · tuần {fmtWeek(week)}
        </SheetTitle>
        <SheetDescription className="text-xs">Mỗi việc: giờ còn lại rơi vào tuần này, nhân hệ số (tốc độ thực tế so với ước lượng, độ khó, thiếu kỹ năng) thành giờ hiệu dụng.</SheetDescription>
      </SheetHeader>
      {q.isPending ? (
        <Skeleton className="h-40 mt-4" />
      ) : q.isError ? (
        <div className="mt-4">
          <ErrorState code={describeError(q.error).code} message={describeError(q.error).message} onRetry={() => q.refetch()} />
        </div>
      ) : (
        <div className="mt-4 space-y-4 text-xs">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Mức sử dụng" value={`${pct(q.data.utilization)} · ${workloadLevelLabel(q.data.level)}`} variant={levelToVariant(q.data.level)} />
            <Stat label="Giờ việc (hiệu dụng)" value={hrs(q.data.effLoadHours)} />
            <Stat label="Giờ làm được" value={hrs(q.data.effCapacityHours)} />
            <Stat label="Họp" value={hrs(q.data.meetingHours)} />
            <Stat label="Nghỉ" value={hrs(q.data.timeOffHours)} />
            <Stat label="Nguy cơ quá sức" value={`${q.data.riskScore}/100`} variant={q.data.riskLabel === "BURNOUT_RISK" ? "destructive" : q.data.riskLabel === "WATCH" ? "warning" : "success"} />
          </div>
          {Object.keys(q.data.riskBreakdown).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {Object.entries(q.data.riskBreakdown).map(([k, v]) => (
                <Badge key={k} variant="outline" className="text-[11px] font-normal">
                  {riskFactorLabel(k)}: {v}
                </Badge>
              ))}
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Việc</TableHead>
                <TableHead className="text-xs text-right">Phần trong tuần</TableHead>
                <TableHead className="text-xs text-right">Giờ</TableHead>
                <TableHead className="text-xs text-right">Hiệu dụng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data.tasks.map((t) => (
                <TableRow key={t.taskId} className={cn(t.overdue && "text-destructive")}>
                  <TableCell className="text-xs">
                    <span className="font-mono mr-1 text-muted-foreground">{t.key}</span>
                    {t.title}
                    {t.overdue && <span className="ml-1 text-[11px]">(quá hạn)</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{pct(t.share)}</TableCell>
                  <TableCell className="text-right tabular-nums">{hrs(t.hoursInWeek)}</TableCell>
                  <TableCell className="text-right tabular-nums" title={`tốc độ ×${vn(t.factors.ear, 2)} · độ khó ×${vn(t.factors.difficulty, 2)} · thiếu kỹ năng ×${vn(t.factors.skillGap, 2)}`}>
                    {hrs(t.hoursEff)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, variant }: { label: string; value: string; variant?: "success" | "warning" | "destructive" | "secondary" | "default" | "outline" | "info" }) {
  return (
    <div className="p-2 rounded-md border border-border/60 bg-muted/20">
      <span className="block text-[10px] text-muted-foreground">{label}</span>
      {variant ? (
        <Badge variant={variant} className="tabular-nums mt-0.5">
          {value}
        </Badge>
      ) : (
        <span className="font-semibold tabular-nums">{value}</span>
      )}
    </div>
  );
}

/** Cửa sổ tính giờ trống: sprint đang chạy (nếu còn ≥ 2 ngày), sprint kế tiếp, hoặc 4 tuần tới. */
function useWindows(projectId: string, activeSprintId?: string) {
  const sprints = useSprints(projectId);
  return React.useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const daysLeft = (end: string) => Math.round((new Date(end.slice(0, 10)).getTime() - new Date(today).getTime()) / 86_400_000) + 1;
    const all = sprints.data ?? [];
    const active = all.find((s) => s.id === activeSprintId) ?? all.find((s) => s.status === "ACTIVE");
    const next = all.filter((s) => s.status === "PLANNED").sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
    const opts: { value: string; label: string; sprintId?: string }[] = [];
    if (active) opts.push({ value: active.id, sprintId: active.id, label: `${active.name} · còn ${Math.max(0, daysLeft(active.endDate))} ngày` });
    if (next) opts.push({ value: next.id, sprintId: next.id, label: `${next.name} · ${dm(next.startDate)} → ${dm(next.endDate)}` });
    opts.push({ value: "28d", label: "4 tuần tới (mọi việc chưa giao)" });
    // Sprint sắp hết thì bảng "giờ trống tới hết sprint" gần như rỗng — mặc định sang sprint kế tiếp
    const def = active && daysLeft(active.endDate) >= 2 ? active.id : next ? next.id : "28d";
    return { opts, def, ready: !sprints.isPending };
  }, [sprints.data, sprints.isPending, activeSprintId]);
}

/** Bảng sự thật cho giao việc (UC-26/39): giờ trống, kỹ năng TỪ BẰNG CHỨNG, ứng viên từng việc — KHÔNG xếp hạng. */
export function CapacityTable({ projectId, sprintId, canView }: { projectId: string; sprintId?: string; canView: boolean }) {
  const w = useWindows(projectId, sprintId);
  const [win, setWin] = React.useState<string | null>(null);
  const value = win ?? w.def;
  const chosen = w.opts.find((o) => o.value === value);
  const q = useCapacityTable(projectId, chosen?.sprintId, canView && w.ready);
  if (!canView)
    return (
      <p className="flex items-center gap-2 rounded-md border border-border/80 px-3 py-2.5 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 shrink-0" /> Bảng giờ trống và ứng viên cho từng việc chỉ PM xem — dùng khi giao việc. Hồ sơ kỹ năng của mọi người ở tab Nhóm.
      </p>
    );
  return (
    <Card className="border-border/80">
      <CardHeader className="p-4 pb-2 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm">Giờ trống & ứng viên</CardTitle>
          <Select value={value} onValueChange={setWin}>
            <SelectTrigger className="h-8 w-auto min-w-56 text-xs" aria-label="Khoảng thời gian">
              <SelectValue placeholder="Khoảng thời gian" />
            </SelectTrigger>
            <SelectContent>
              {w.opts.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <CardDescription className="text-xs">
          {q.data ? `Tính từ ${dm(q.data.window.from)}, ${q.data.window.days} ngày · ${q.data.tasks.length} việc chưa giao · ` : ""}Số liệu để bạn và Trợ lý AI cân nhắc, không có cột &quot;điểm phù
          hợp&quot;. Người chỉ xem không nằm trong bảng.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 sm:p-4 sm:pt-0 space-y-4">
        {q.isPending ? (
          <Skeleton className="h-64 w-full" />
        ) : q.isError ? (
          <ErrorState code={describeError(q.error).code} message={describeError(q.error).message} onRetry={() => q.refetch()} />
        ) : (
          <CapacityBody d={q.data} />
        )}
      </CardContent>
    </Card>
  );
}

function CapacityBody({ d }: { d: CapacityTableView }) {
  const short = (m: { shortName: string | null; fullName: string }) => m.shortName?.replace(/\s*\(.*\)$/, "") ?? m.fullName;
  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 bg-card text-xs">Thành viên</TableHead>
              <TableHead className="text-xs">Tải tuần này</TableHead>
              <TableHead className="text-xs text-right whitespace-nowrap">Giờ trống</TableHead>
              <TableHead className="text-xs text-right whitespace-nowrap">Xong đúng hạn</TableHead>
              <TableHead className="text-xs">Kỹ năng theo việc đã làm</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {d.members.map((m) => {
              const proven = m.skills.filter((s) => s.confidence !== "none" && s.level > 0);
              return (
                <TableRow key={m.userId} className="text-xs">
                  <TableCell className="sticky left-0 z-10 bg-card whitespace-nowrap">
                    <span className="font-medium">{m.fullName}</span> <span className="text-muted-foreground">· {projectRoleLabel(m.role)}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <WorkloadBadge percent={Math.round(m.utilizationBefore * 100)} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{hrs(m.freeByDay.reduce((s, x) => s + x.freeHours, 0))}</TableCell>
                  <TableCell className="text-right tabular-nums" title={m.metrics.sampleSize ? `${m.metrics.sampleSize} việc đã xong có hạn` : undefined}>
                    {m.metrics.onTimeRate != null && m.metrics.sampleSize ? pct(m.metrics.onTimeRate) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {proven.length ? (
                        proven.slice(0, 5).map((s) => (
                          <Badge key={s.skillId} variant="secondary" className="text-[11px] font-normal" title={s.evidence}>
                            {s.name} {s.level}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground">chưa có bằng chứng</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {d.tasks.length === 0 ? (
        <p className="px-4 pb-4 text-xs text-muted-foreground sm:px-0 sm:pb-0">Không có việc chưa giao trong khoảng này.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 min-w-56 bg-card text-xs">Việc chưa giao</TableHead>
                {d.members.map((m) => (
                  <TableHead key={m.userId} className="min-w-32 text-center text-xs whitespace-nowrap">
                    {short(m)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.tasks.map((t) => (
                <TableRow key={t.taskId} className="text-xs">
                  <TableCell className="sticky left-0 z-10 bg-card align-top">
                    <span className="line-clamp-2">
                      <span className="font-mono mr-1 text-muted-foreground">{t.key}</span>
                      {t.title}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {hrs(t.remainingHours)} · khó {t.difficulty} · {t.dueDate ? `hạn ${dm(t.dueDate)}` : "chưa có hạn"}
                      {t.requiredSkills.length ? ` · ${t.requiredSkills.map((s) => `${s.name} ≥ ${s.minLevel}`).join(", ")}` : ""}
                    </span>
                  </TableCell>
                  {t.perUser.map((u) => {
                    const gaps = u.skillMatch.items.filter((i) => !i.unproven && i.level < i.required);
                    const unknown = u.skillMatch.items.filter((i) => i.unproven);
                    return (
                      <TableCell key={u.userId} className="text-center align-top">
                        <div className="tabular-nums text-foreground">{hrs(u.hoursEff)}</div>
                        <div className="text-[11px] tabular-nums text-muted-foreground">{u.freeBeforeDue != null ? `trống trước hạn ${hrs(u.freeBeforeDue)}` : ""}</div>
                        <div className="mt-0.5 flex flex-col items-center gap-0.5">
                          {gaps.map((g) => (
                            <Badge key={g.skillId} variant="warning" className="text-[10px] px-1.5 py-0 font-normal">
                              {g.name} mức {g.level} &lt; {g.required}
                            </Badge>
                          ))}
                          {unknown.map((g) => (
                            <Badge key={g.skillId} variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                              chưa có bằng chứng {g.name}
                            </Badge>
                          ))}
                          {t.requiredSkills.length > 0 && !gaps.length && !unknown.length && (
                            <Badge variant="success" className="text-[10px] px-1.5 py-0 font-normal">
                              đủ kỹ năng
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
