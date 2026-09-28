"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { UserAvatar } from "@/components/app/UserAvatar";
import { api, describeError } from "@/lib/api";
import type { ActivityItem, Paged } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ACTIVITY_ACTION_LABEL, ACTIVITY_FIELD_LABEL, sprintActivityDetail } from "@smarttask/shared";
import { useSprints } from "@/lib/hooks/queries";

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "vừa xong";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} phút trước`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} giờ trước`;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** Diff `{field: {from, to}}` hoặc `{field: value}` → chuỗi ngắn; không diễn giải id (cột/sprint) — chỉ nêu trường. */
function diffSummary(diff: ActivityItem["diff"]): string {
  if (!diff) return "";
  const keys = Object.keys(diff).filter((k) => k in ACTIVITY_FIELD_LABEL);
  return keys.map((k) => ACTIVITY_FIELD_LABEL[k]).join(", ");
}

export function useActivity(projectId: string, taskId?: string, limit = 30) {
  return useQuery({
    queryKey: ["projects", projectId, "activity", taskId ?? "", limit],
    queryFn: () => api.get<Paged<ActivityItem>>(`/projects/${projectId}/activity`, { taskId, limit }),
  });
}

/** Dòng hoạt động (UC-16): GET /projects/:id/activity?taskId= — dùng trong modal chi tiết task và Dashboard. */
export function ActivityList({ projectId, taskId, compact = false, limit = 30 }: { projectId: string; taskId?: string; compact?: boolean; limit?: number }) {
  const q = useActivity(projectId, taskId, limit);
  const sprints = useSprints(projectId);
  const sprintName = (diff: ActivityItem["diff"]) => {
    const id = (diff as { sprintId?: unknown } | null)?.sprintId;
    return typeof id === "string" ? sprints.data?.find((s) => s.id === id)?.name : undefined;
  };
  if (q.isPending) return <Skeleton className={compact ? "h-32 w-full" : "h-56 w-full"} />;
  if (q.isError) return <ErrorState code={describeError(q.error).code} message={describeError(q.error).message} onRetry={() => q.refetch()} />;
  if (q.data.items.length === 0) return <EmptyState icon={History} title="Chưa có hoạt động" description="Tạo, chuyển cột, giao việc, bình luận… sẽ ghi ở đây." />;
  return (
    <ol className={cn("space-y-2", compact && "space-y-1.5")}>
      {q.data.items.map((a) => (
        <li key={a.id} className="flex items-start gap-2 text-xs">
          <UserAvatar name={a.actor?.fullName ?? "Hệ thống"} avatar={a.actor?.avatarUrl ?? undefined} size="sm" />
          <div className="min-w-0 flex-1">
            <span className="font-medium">{a.actor?.shortName ?? a.actor?.fullName ?? "Hệ thống"}</span> <span>{ACTIVITY_ACTION_LABEL[a.action] ?? a.action}</span>
            {!taskId && a.taskKey && (
              <>
                {" "}
                <span className="font-mono text-muted-foreground">{a.taskKey}</span> <span className="text-muted-foreground break-words">{a.task?.title}</span>
              </>
            )}
            {a.action.startsWith("sprint.") ? (
              // Dòng sprint: tên sprint + số việc (diff JSON), thay vì chỉ ghi "· sprint"
              <span className="text-muted-foreground"> · {sprintActivityDetail(a.action, a.diff, sprintName(a.diff))}</span>
            ) : (
              diffSummary(a.diff) && <span className="text-muted-foreground"> · {diffSummary(a.diff)}</span>
            )}
            {a.source !== "MANUAL" && (
              <Badge variant={a.source === "AI" ? "info" : "outline"} className="ml-1 text-[9px] px-1 py-0">
                {a.source}
              </Badge>
            )}
            <div className="text-[10px] text-muted-foreground">{fmtTime(a.createdAt)}</div>
          </div>
        </li>
      ))}
      {q.data.total > q.data.items.length && (
        <li className="text-[11px] text-muted-foreground">
          … còn {q.data.total - q.data.items.length} mục —{" "}
          <Button variant="link" size="sm" className="h-auto p-0 text-[11px]" onClick={() => q.refetch()}>
            tải lại
          </Button>
        </li>
      )}
    </ol>
  );
}
