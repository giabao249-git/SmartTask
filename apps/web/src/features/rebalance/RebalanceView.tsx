"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bot, Scale, RefreshCw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/app/ErrorState";
import { WorkloadBadge } from "@/components/app/WorkloadBadge";
import { api, describeError } from "@/lib/api";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { useProjectWorkload } from "@/lib/hooks/analytics";
import { levelToVariant } from "@/lib/status";
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
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground">
          Hệ thống tính tải và bảng năng lực; Trợ lý AI đề xuất chuyển việc thành bản nháp, PM duyệt từng mục mới ghi thật.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" disabled={recompute.isPending || !project.canManage} onClick={() => recompute.mutate()}>
            <RefreshCw className="h-3.5 w-3.5" /> Tính lại tải
          </Button>
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => router.push(`/projects/${project.id}/assistant?prompt=${encodeURIComponent(seedPrompt)}`)}>
            <Bot className="h-3.5 w-3.5" /> Xin đề xuất từ Trợ lý AI
          </Button>
        </div>
      </div>

      {workload.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : workload.isError ? (
        <ErrorState code={describeError(workload.error).code} message={describeError(workload.error).message} onRetry={() => workload.refetch()} />
      ) : (
        <Card className="border-border/80">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Scale className="h-4 w-4 text-info" /> Tải tuần này
              <Badge variant="secondary" className="text-[10px]">
                spread {Math.round(workload.data.spread * 100)}%
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">{overloaded.length === 0 ? "Không ai vượt ngưỡng cao tải — không cần cân bằng." : `${overloaded.length} người cao tải/quá tải`}</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 flex flex-wrap gap-2">
            {thisWeek.map((m) => (
              <div key={m.userId} className="flex items-center gap-2 rounded-md border border-border/60 px-2 py-1 text-xs">
                <span className="font-medium">{m.shortName ?? m.fullName}</span>
                <WorkloadBadge percent={Math.round(m.week.utilization * 100)} />
                <Badge variant={levelToVariant(m.week.level)} className="text-[9px] px-1 py-0">
                  {m.week.level}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {overloaded.length > 0 && (
        <Alert>
          <AlertTitle className="text-xs">Prompt mồi sẽ gửi cho Trợ lý AI</AlertTitle>
          <AlertDescription className="text-[11px]">{seedPrompt}</AlertDescription>
        </Alert>
      )}

      <CapacityTable projectId={project.id} sprintId={project.activeSprint?.id} canView={project.canManage} />
    </div>
  );
}
