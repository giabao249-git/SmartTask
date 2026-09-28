"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bot, Scale, RefreshCw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/app/ErrorState";
import { WorkloadBadge } from "@/components/app/WorkloadBadge";
import { api, describeError } from "@/lib/api";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { useProjectWorkload } from "@/lib/hooks/analytics";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CapacityTable } from "@/features/workload/WorkloadView";

/**
 * Cân bằng tải (UC-27). Backend chỉ tính tải + bảng năng lực; đề xuất chuyển việc là việc của LLM trong phiên chat
 * và chỉ ghi khi PM duyệt bản nháp (docs 04/12, quy tắc "backend không xếp hạng, không tự chọn người").
 * Màn này = số liệu sống + nút mở Trợ lý AI với prompt mồi.
 */
export function RebalanceView() {
  const project = useCurrentProject();
  const router = useRouter();
  const qc = useQueryClient();
  const workload = useProjectWorkload(project.id, 2);
  const recompute = useMutation({
    mutationFn: () => api.post<unknown>(`/projects/${project.id}/workload/recompute`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", project.id] });
      toast.success("Đã tính lại tải");
    },
    onError: (e) => toast.error(describeError(e).message),
  });

  const thisWeek = React.useMemo(
    () => (workload.data?.users ?? []).map((u) => ({ userId: u.userId, fullName: u.fullName, shortName: u.shortName, week: u.weeks[0] })).filter((u) => u.week),
    [workload.data],
  );
  const overloaded = React.useMemo(() => thisWeek.filter((m) => m.week.level === "OVERLOAD" || m.week.level === "FULL" || m.week.level === "HIGH"), [thisWeek]);
  const seedPrompt = React.useMemo(() => {
    const names = overloaded.map((m) => `${m.fullName} (${Math.round(m.week.utilization * 100)}%)`).join(", ");
    return `Đề xuất cân bằng tải cho ${project.activeSprint?.name ?? "dự án"}: ${names ? `${names} đang cao tải; ` : ""}hãy đề xuất chuyển bớt việc sang người còn giờ trống và đủ kỹ năng, giải thích lý do từng mục.`;
  }, [overloaded, project.activeSprint?.name]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground">Hệ thống chỉ tính số; Trợ lý AI đề xuất chuyển việc thành bản nháp, PM duyệt từng mục mới ghi thật.</p>
        {project.canManage && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" disabled={recompute.isPending} onClick={() => recompute.mutate()}>
              <RefreshCw className={cn("h-3.5 w-3.5", recompute.isPending && "animate-spin")} /> Tính lại tải
            </Button>
            <Button size="sm" className="gap-1.5 text-xs" onClick={() => router.push(`/projects/${project.id}/assistant?prompt=${encodeURIComponent(seedPrompt)}`)}>
              <Bot className="h-3.5 w-3.5" /> Nhờ Trợ lý AI đề xuất
            </Button>
          </div>
        )}
      </div>

      {/* Một dòng tóm tắt thay cho khối "Tải tuần này" cũ (lặp lại bảng tải, kèm nhãn NORMAL tiếng Anh) */}
      {workload.isPending ? (
        <Skeleton className="h-10 w-full" />
      ) : workload.isError ? (
        <ErrorState code={describeError(workload.error).code} message={describeError(workload.error).message} onRetry={() => workload.refetch()} />
      ) : overloaded.length === 0 ? (
        <p className="flex items-center gap-2 rounded-md border border-border/80 px-3 py-2.5 text-xs text-foreground">
          <Scale className="h-4 w-4 shrink-0 text-success" aria-hidden /> Tuần này không ai vượt ngưỡng cao tải · chênh lệch tải trong nhóm {Math.round(workload.data.spread * 100)}%.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/80 px-3 py-2.5 text-xs text-foreground">
          <Scale className="h-4 w-4 shrink-0 text-warning" aria-hidden />
          <span className="font-medium">{overloaded.length} người cao tải tuần này:</span>
          {overloaded.map((m) => (
            <span key={m.userId} className="flex items-center gap-1">
              {m.shortName ?? m.fullName} <WorkloadBadge percent={Math.round(m.week.utilization * 100)} />
            </span>
          ))}
        </div>
      )}

      <CapacityTable projectId={project.id} sprintId={project.activeSprint?.id} canView={project.canManage} />
    </div>
  );
}
