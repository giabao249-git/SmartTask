"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Eye, PencilLine, Users2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { SideDetailPanel } from "@/components/app/SideDetailPanel";
import { UserAvatar } from "@/components/app/UserAvatar";
import { WorkloadBadge } from "@/components/app/WorkloadBadge";
import { describeError } from "@/lib/api";
import { useProjectWorkload, useSkillProfiles } from "@/lib/hooks/analytics";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DeclaredSkillsEditor } from "@/features/skills/SkillsMatrixView";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { projectRoleLabel } from "@/lib/status";
import type { MemberProfileView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { pct } from "./format";
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
  const me = useAuth().user?.id;
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
  // Thẻ của chính mình lên đầu (thay tab "Hồ sơ của tôi" riêng — trùng với ngăn hồ sơ)
  const ordered = [...profiles.data].sort((a, b) => Number(b.id === me) - Number(a.id === me));

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ordered.map((m) => (
          <MemberCard key={m.id} member={m} self={m.id === me} week={weekOf.get(m.id)} loadingWeek={workload.isPending} onOpen={() => setOpen(m.id)} />
        ))}
      </div>

      <SideDetailPanel
        open={!!opened}
        onClose={() => setOpen(null)}
        ariaLabel={opened ? `Hồ sơ ${opened.fullName}` : "Hồ sơ thành viên"}
        contentClassName="p-5 sm:p-6"
      >
        {opened && (
          <>
            <MemberProfile projectId={project.id} member={opened} />
            {opened.id === me && <DeclaredSection workspaceId={project.workspaceId} projectId={project.id} />}
          </>
        )}
      </SideDetailPanel>
    </div>
  );
}

function MemberCard({ member: m, self, week, loadingWeek, onOpen }: { member: MemberProfileView; self: boolean; week?: { utilization: number }; loadingWeek: boolean; onOpen: () => void }) {
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
          <div className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
            {m.fullName}
            {self && (
              <Badge variant="info" className="px-1.5 py-0 text-[10px] font-normal">
                Bạn
              </Badge>
            )}
          </div>
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

/** Tự khai của chính mình — chỉ tham khảo (docs 02/08), đặt trong ngăn hồ sơ thay vì một tab riêng. */
function DeclaredSection({ workspaceId, projectId }: { workspaceId: string; projectId: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-5 border-t border-border/60 pt-3">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="h-auto w-full items-start justify-between gap-2 whitespace-normal px-0 py-1 text-left font-normal hover:bg-transparent">
          <span>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <PencilLine className="h-4 w-4 text-muted-foreground" /> Sửa kỹ năng tự khai (tham khảo)
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">Không dùng để chia việc. Cho PM biết bạn làm được hoặc muốn nhận mảng nào — PM có thể xác nhận thành bằng chứng.</span>
          </span>
          <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">{open && <DeclaredSkillsEditor workspaceId={workspaceId} projectId={projectId} />}</CollapsibleContent>
    </Collapsible>
  );
}
