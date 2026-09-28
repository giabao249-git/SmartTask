"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardCheck, Eye, Users2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { UserAvatar } from "@/components/app/UserAvatar";
import { WorkloadBadge } from "@/components/app/WorkloadBadge";
import { describeError } from "@/lib/api";
import { usePendingReviews, useProjectWorkload, useSkillProfiles } from "@/lib/hooks/analytics";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { projectRoleLabel } from "@/lib/status";
import type { MemberProfileView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { dm, pct } from "./format";
import { MemberProfile } from "./MemberProfile";

/**
 * Tab "Nhóm" — trả lời "ai đang làm gì, làm được gì" trên một màn: tải tuần này, kỹ năng TỪ BẰNG CHỨNG, hiệu suất
 * (chỉ PM/bản thân). Trước đây phải ghép tay 4 tab, và kỹ năng hiện là mức tự khai.
 */
export function TeamView() {
  const project = useCurrentProject();
  const router = useRouter();
  const params = useSearchParams();
  const profiles = useSkillProfiles(project.id);
  const workload = useProjectWorkload(project.id, 1);
  const pending = usePendingReviews(project.id, project.canManage);
  const openId = params.get("member");
  const setOpen = (id: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (id) next.set("member", id);
    else next.delete("member");
    router.replace(`?${next.toString()}`, { scroll: false });
  };

  if (profiles.isPending) return <Skeleton className="h-72 w-full" />;
  if (profiles.isError) return <ErrorState code={describeError(profiles.error).code} message={describeError(profiles.error).message} onRetry={() => profiles.refetch()} />;
  if (profiles.data.length === 0) return <EmptyState icon={Users2} title="Dự án chưa có thành viên" description="PM thêm thành viên ở Cấu hình › Thành viên." />;

  const weekOf = new Map((workload.data?.users ?? []).map((u) => [u.userId, u.weeks[0]]));
  const opened = profiles.data.find((m) => m.id === openId) ?? null;

  return (
    <div className="space-y-5">
      {project.canManage && (pending.data?.length ?? 0) > 0 && (
        <Card className="border-border/80">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-info" /> {pending.data!.length} việc đã xong chờ bạn đánh giá
            </CardTitle>
            <CardDescription className="text-xs">Đánh giá là nguồn duy nhất cho biết việc làm tốt hay phải sửa — không có nó, hồ sơ kỹ năng chỉ tính nửa phần.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ul className="divide-y divide-border/60">
              {pending.data!.slice(0, 6).map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2 text-xs min-w-0">
                  <Link href={`/projects/${project.id}/tasks/${t.key}`} className="flex-1 min-w-0 truncate hover:underline">
                    <span className="font-mono text-muted-foreground mr-1.5">{t.key}</span>
                    {t.title}
                  </Link>
                  <span className="hidden sm:flex items-center gap-1 shrink-0">
                    {t.assignees.slice(0, 2).map((a) => (
                      <UserAvatar key={a.id} name={a.shortName ?? a.fullName} avatar={a.avatarUrl ?? undefined} size="sm" />
                    ))}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">xong {dm(t.completedAt)}</span>
                  {t.selfAssigned && (
                    <Badge variant="outline" className="shrink-0 text-[10px] font-normal" title="Tự chấm không tính vào hồ sơ kỹ năng">
                      việc của bạn
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
            {pending.data!.length > 6 && <p className="pt-1 text-[11px] text-muted-foreground">và {pending.data!.length - 6} việc nữa</p>}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {profiles.data.map((m) => (
          <MemberCard key={m.id} member={m} week={weekOf.get(m.id)} loadingWeek={workload.isPending} onOpen={() => setOpen(m.id)} />
        ))}
      </div>

      <Sheet open={!!opened} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {opened && (
            <>
              <SheetHeader className="sr-only">
                <SheetTitle>Hồ sơ {opened.fullName}</SheetTitle>
                <SheetDescription>Kỹ năng theo việc đã làm và hiệu suất</SheetDescription>
              </SheetHeader>
              <MemberProfile projectId={project.id} member={opened} />
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MemberCard({ member: m, week, loadingWeek, onOpen }: { member: MemberProfileView; week?: { utilization: number }; loadingWeek: boolean; onOpen: () => void }) {
  const proven = m.skills.filter((s) => s.confidence !== "none" && s.level > 0).slice(0, 4);
  const claimedOnly = m.skills.filter((s) => s.confidence === "none").length;
  const p = m.performance;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group rounded-lg border border-border/80 bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center gap-3">
        <UserAvatar name={m.shortName ?? m.fullName} avatar={m.avatarUrl ?? undefined} showTooltip={false} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{m.fullName}</p>
          <p className="text-xs text-muted-foreground">{projectRoleLabel(m.role)}</p>
        </div>
        {m.viewer ? (
          <Badge variant="outline" className="gap-1 text-[11px] font-normal" title="Vai Viewer của workspace — không nhận việc">
            <Eye className="h-3 w-3" /> Chỉ xem
          </Badge>
        ) : week ? (
          <WorkloadBadge percent={Math.round(week.utilization * 100)} />
        ) : loadingWeek ? null : null}
      </div>

      <div className="mt-3 flex min-h-6 flex-wrap items-center gap-1.5">
        {proven.length ? (
          proven.map((s) => (
            <Badge key={s.skillId} variant="secondary" className="text-[11px] font-normal">
              {s.name} {s.level}
            </Badge>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">Chưa có kỹ năng nào có việc làm chứng</span>
        )}
        {claimedOnly > 0 && <span className="text-[11px] text-muted-foreground">+{claimedOnly} tự khai</span>}
      </div>

      {p && !m.viewer && (
        <p className={cn("mt-2.5 border-t border-border/60 pt-2 text-xs text-foreground tabular-nums")}>
          {p.doneTasks} việc xong · đúng hạn {p.onTimeRate == null ? "—" : pct(p.onTimeRate)}
          {p.reopenCount ? ` · ${p.reopenCount} lần làm lại` : ""}
          {p.overdueOpen ? <span className="text-destructive"> · {p.overdueOpen} quá hạn</span> : null}
        </p>
      )}
    </button>
  );
}
