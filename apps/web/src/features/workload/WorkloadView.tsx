"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Scale, Users2, Table2, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { UserAvatar } from "@/components/app/UserAvatar";
import { WorkloadBadge } from "@/components/app/WorkloadBadge";
import { api, describeError } from "@/lib/api";
import { useCapacityTable, useProjectWorkload, useWorkloadDetails } from "@/lib/hooks/analytics";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { levelToVariant } from "@/lib/status";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const fmtWeek = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** Tải nhân sự (UC-24/25): GET /projects/:id/workload (người × tuần), chi tiết cấu thành, bảng năng lực (UC-26, không xếp hạng). */
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
      <PageHeader
        title={`Tải nhân sự · ${project.key}`}
        description="Giờ còn lại theo tuần × năng lực hiệu dụng (trừ họp, nghỉ) → mức sử dụng; số do backend tính, không xếp hạng ai."
        breadcrumbs={[{ label: "Workspace", href: "/workspaces" }, { label: project.name, href: `/projects/${project.id}/dashboard` }, { label: "Tải nhân sự" }]}
      >
        <div className="flex items-center gap-2">
          {project.canManage && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" disabled={recompute.isPending} onClick={() => recompute.mutate()}>
              <RefreshCw className={cn("h-3.5 w-3.5", recompute.isPending && "animate-spin")} /> Tính lại
            </Button>
          )}
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => router.push(`/projects/${project.id}/assistant?prompt=${encodeURIComponent("Ai đang quá tải tuần này? Đề xuất cân bằng lại tải cho nhóm.")}`)}>
            <Scale className="h-3.5 w-3.5" /> Xem đề xuất cân bằng
          </Button>
        </div>
      </PageHeader>

      <Tabs defaultValue="weeks">
        <TabsList className="h-8">
          <TabsTrigger value="weeks" className="text-xs gap-1">
            <Users2 className="h-3.5 w-3.5" /> Người × tuần
          </TabsTrigger>
          <TabsTrigger value="capacity" className="text-xs gap-1">
            <Table2 className="h-3.5 w-3.5" /> Bảng năng lực
          </TabsTrigger>
        </TabsList>

        <TabsContent value="weeks" className="pt-3">
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
                  <CardTitle className="text-sm">Mức sử dụng 4 tuần</CardTitle>
                  <CardDescription className="text-xs">
                    Ngưỡng: cao {Math.round(wl.data.thresholds.high * 100)}% · đầy {Math.round(wl.data.thresholds.full * 100)}% · quá tải {Math.round(wl.data.thresholds.overload * 100)}% · Spread nhóm {Math.round(wl.data.spread * 100)}%
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  bấm ô để xem cấu thành
                </Badge>
              </CardHeader>
              <CardContent className="p-4 pt-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs w-48">Thành viên</TableHead>
                      {wl.data.users[0].weeks.map((w) => (
                        <TableHead key={w.weekStart} className="text-xs text-center">
                          <CalendarDays className="h-3 w-3 inline mr-1" />
                          Tuần {fmtWeek(w.weekStart)}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wl.data.users.map((u) => (
                      <TableRow key={u.userId}>
                        <TableCell className="text-xs">
                          <div className="flex items-center gap-2">
                            <UserAvatar name={u.fullName} avatar={u.avatarUrl ?? undefined} size="sm" />
                            <span className="font-medium">{u.fullName}</span>
                          </div>
                        </TableCell>
                        {u.weeks.map((w) => (
                          <TableCell key={w.weekStart} className="p-1.5">
                            <Button
                              variant="ghost"
                              onClick={() => setDetail({ userId: u.userId, week: w.weekStart })}
                              className={cn("w-full h-auto flex flex-col items-center gap-1 py-2 rounded-md border", levelBg(w.level))}
                            >
                              <span className="font-mono text-sm font-semibold">{Math.round(w.utilization * 100)}%</span>
                              <span className="text-[10px] text-muted-foreground">
                                {w.effLoadHours}/{w.effCapacityHours}h
                              </span>
                              <WorkloadBadge level={w.level} className="text-[9px] px-1.5 py-0" />
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
        </TabsContent>

        <TabsContent value="capacity" className="pt-3">
          <CapacityTable projectId={project.id} sprintId={project.activeSprint?.id} canView={project.canManage} />
        </TabsContent>
      </Tabs>

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
        <SheetDescription className="text-xs">Cấu thành tải: task × share tuần × hệ số (EAR, độ khó, thiếu kỹ năng) — docs 04 §1–3.</SheetDescription>
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
            <Stat label="Mức sử dụng" value={`${Math.round(q.data.utilization * 100)}%`} variant={levelToVariant(q.data.level)} />
            <Stat label="Tải hiệu dụng" value={`${q.data.effLoadHours}h`} />
            <Stat label="Năng lực hiệu dụng" value={`${q.data.effCapacityHours}h`} />
            <Stat label="Họp" value={`${q.data.meetingHours}h`} />
            <Stat label="Nghỉ" value={`${q.data.timeOffHours}h`} />
            <Stat label="Điểm burnout" value={`${q.data.riskScore}`} variant={q.data.riskLabel === "BURNOUT_RISK" ? "destructive" : q.data.riskLabel === "WATCH" ? "warning" : "success"} />
          </div>
          {Object.keys(q.data.riskBreakdown).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {Object.entries(q.data.riskBreakdown).map(([k, v]) => (
                <Badge key={k} variant="outline" className="text-[10px] font-mono">
                  {k}: {v}
                </Badge>
              ))}
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Task</TableHead>
                <TableHead className="text-xs text-right">Share</TableHead>
                <TableHead className="text-xs text-right">Giờ tuần</TableHead>
                <TableHead className="text-xs text-right">Hiệu dụng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data.tasks.map((t) => (
                <TableRow key={t.taskId} className={cn(t.overdue && "text-destructive")}>
                  <TableCell className="text-xs">
                    <span className="font-mono mr-1">{t.key}</span>
                    {t.title}
                  </TableCell>
                  <TableCell className="text-right font-mono">{Math.round(t.share * 100)}%</TableCell>
                  <TableCell className="text-right font-mono">{t.hoursInWeek}</TableCell>
                  <TableCell className="text-right font-mono" title={`EAR ${t.factors.ear} · khó ${t.factors.difficulty} · kỹ năng ${t.factors.skillGap}`}>
                    {t.hoursEff}
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
        <Badge variant={variant} className="font-mono mt-0.5">
          {value}
        </Badge>
      ) : (
        <span className="font-mono font-semibold">{value}</span>
      )}
    </div>
  );
}

/** Bảng sự thật cho giao việc (UC-26/39): thành viên × task chưa giao — khớp kỹ năng, giờ trống trước hạn; KHÔNG xếp hạng. */
function CapacityTable({ projectId, sprintId, canView }: { projectId: string; sprintId?: string; canView: boolean }) {
  const q = useCapacityTable(projectId, sprintId, canView);
  if (!canView) return <EmptyState icon={Table2} title="Chỉ PM xem bảng năng lực" description="Bảng này phục vụ giao việc và Trợ lý AI; cần vai PM hoặc quản trị workspace." />;
  if (q.isPending) return <Skeleton className="h-64 w-full" />;
  if (q.isError) return <ErrorState code={describeError(q.error).code} message={describeError(q.error).message} onRetry={() => q.refetch()} />;
  const d = q.data;
  return (
    <Card className="border-border/80">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm">Bảng năng lực · cửa sổ {d.window.from} + {d.window.days} ngày</CardTitle>
        <CardDescription className="text-xs">{d.tasks.length} task chưa giao × {d.members.length} thành viên · Spread hiện tại {Math.round(d.spread * 100)}% · số để LLM/PM cân nhắc, không có cột &quot;điểm phù hợp&quot;.</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0 overflow-x-auto space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Thành viên</TableHead>
              <TableHead className="text-xs">U trước</TableHead>
              <TableHead className="text-xs">EAR</TableHead>
              <TableHead className="text-xs">Đúng hạn</TableHead>
              <TableHead className="text-xs">Giờ trống cửa sổ</TableHead>
              <TableHead className="text-xs">Kỹ năng</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {d.members.map((m) => (
              <TableRow key={m.userId} className="text-xs">
                <TableCell className="font-medium">
                  {m.fullName} <span className="text-muted-foreground">· {m.role}</span>
                </TableCell>
                <TableCell>
                  <WorkloadBadge percent={Math.round(m.utilizationBefore * 100)} />
                </TableCell>
                <TableCell className="font-mono">
                  {m.metrics.ear.toFixed(2)} <span className="text-muted-foreground">(n={m.metrics.sampleSize})</span>
                </TableCell>
                <TableCell className="font-mono">{m.metrics.onTimeRate != null ? `${Math.round(m.metrics.onTimeRate * 100)}%` : "—"}</TableCell>
                <TableCell className="font-mono">{Math.round(m.freeByDay.reduce((s, x) => s + x.freeHours, 0) * 10) / 10}h</TableCell>
                <TableCell className="max-w-xs truncate">{m.skills.map((s) => `${s.name} ${s.level}`).join(", ") || "chưa khai"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {d.tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground">Không có task chưa giao trong cửa sổ này.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Task chưa giao</TableHead>
                {d.members.map((m) => (
                  <TableHead key={m.userId} className="text-xs text-center">
                    {m.shortName ?? m.fullName}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.tasks.map((t) => (
                <TableRow key={t.taskId} className="text-xs">
                  <TableCell>
                    <span className="font-mono mr-1">{t.key}</span>
                    {t.title}
                    <span className="block text-[10px] text-muted-foreground">
                      {t.remainingHours}h · khó {t.difficulty} · hạn {t.dueDate ?? "—"} · {t.requiredSkills.map((s) => `${s.name}≥${s.minLevel}`).join(", ") || "không yêu cầu kỹ năng"}
                    </span>
                  </TableCell>
                  {t.perUser.map((u) => (
                    <TableCell key={u.userId} className="text-center">
                      <div className="font-mono">{u.hoursEff}h</div>
                      <div className="text-[10px] text-muted-foreground">
                        khớp {Math.round(u.skillMatch.avg * 100)}%{u.freeBeforeDue != null ? ` · trống ${u.freeBeforeDue}h` : ""}
                      </div>
                      {u.skillMatch.missing.length > 0 && (
                        <Badge variant="warning" className="text-[9px] px-1 py-0 mt-0.5">
                          thiếu {u.skillMatch.missing.join(", ")}
                        </Badge>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
