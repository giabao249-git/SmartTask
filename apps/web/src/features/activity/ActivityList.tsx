"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, History } from "lucide-react";
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

type ActivityFilter = "all" | "status" | "comment" | "sprint_ai";

const FILTER_TABS: { key: ActivityFilter; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "status", label: "Chuyển cột / Trạng thái" },
  { key: "comment", label: "Bình luận" },
  { key: "sprint_ai", label: "Sprint / AI" },
];

/** Dòng hoạt động (UC-16): GET /projects/:id/activity?taskId= — dùng trong modal chi tiết task và Dashboard. */
export function ActivityList({ projectId, taskId, compact = false, limit = 30 }: { projectId: string; taskId?: string; compact?: boolean; limit?: number }) {
  const q = useActivity(projectId, taskId, limit);
  const sprints = useSprints(projectId);
  const [activeFilter, setActiveFilter] = React.useState<ActivityFilter>("all");
  const [expanded, setExpanded] = React.useState(false);

  const sprintName = (diff: ActivityItem["diff"]) => {
    const id = (diff as { sprintId?: unknown } | null)?.sprintId;
    return typeof id === "string" ? sprints.data?.find((s) => s.id === id)?.name : undefined;
  };

  if (q.isPending) return <Skeleton className={compact ? "h-32 w-full" : "h-56 w-full"} />;
  if (q.isError) return <ErrorState code={describeError(q.error).code} message={describeError(q.error).message} onRetry={() => q.refetch()} />;
  if (q.data.items.length === 0) return <EmptyState icon={History} title="Chưa có hoạt động" description="Tạo, chuyển cột, giao việc, bình luận… sẽ ghi ở đây." />;

  const filteredItems = q.data.items.filter((a) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "status") {
      return a.action.includes("move") || a.action.includes("column") || a.action.includes("status");
    }
    if (activeFilter === "comment") {
      return a.action.includes("comment");
    }
    if (activeFilter === "sprint_ai") {
      return a.action.startsWith("sprint.") || a.source === "AI" || a.action.includes("ai");
    }
    return true;
  });

  const displayLimit = expanded ? filteredItems.length : 6;
  const displayedItems = filteredItems.slice(0, displayLimit);
  const hasMore = filteredItems.length > 6;

  return (
    <div className="space-y-3">
      {/* Quick Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveFilter(tab.key)}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-medium transition-colors shrink-0 cursor-pointer",
              activeFilter === tab.key
                ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {displayedItems.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Không có hoạt động nào thuộc nhóm này.</p>
      ) : (
        <ol className="space-y-3">
          {displayedItems.map((a) => (
            <li key={a.id} className="flex items-start gap-3 text-sm">
              <UserAvatar name={a.actor?.fullName ?? "Hệ thống"} avatar={a.actor?.avatarUrl ?? undefined} size="sm" className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1 leading-relaxed">
                <span className="font-semibold text-foreground">{a.actor?.shortName ?? a.actor?.fullName ?? "Hệ thống"}</span>{" "}
                <span className="text-foreground/90">{ACTIVITY_ACTION_LABEL[a.action] ?? a.action}</span>
                {!taskId && a.taskKey && (
                  <>
                    {" "}
                    <span className="font-mono text-muted-foreground font-medium">{a.taskKey}</span>{" "}
                    <span className="text-muted-foreground break-words">{a.task?.title}</span>
                  </>
                )}
                {a.action.startsWith("sprint.") ? (
                  <span className="text-muted-foreground"> · {sprintActivityDetail(a.action, a.diff, sprintName(a.diff))}</span>
                ) : (
                  diffSummary(a.diff) && <span className="text-muted-foreground"> · {diffSummary(a.diff)}</span>
                )}
                {a.source !== "MANUAL" && (
                  <Badge variant={a.source === "AI" ? "info" : "outline"} className="ml-1 text-[11px] font-medium tracking-wide px-1.5 py-0">
                    {a.source}
                  </Badge>
                )}
                <div className="text-xs text-muted-foreground mt-0.5">{fmtTime(a.createdAt)}</div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* Nút Xem thêm / Thu gọn */}
      {hasMore && (
        <div className="pt-1 border-t border-border/40 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-7 px-2 text-xs text-primary hover:text-primary gap-1 font-medium"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" /> Thu gọn
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" /> Xem thêm ({filteredItems.length - 6} hoạt động)
              </>
            )}
          </Button>
          <span className="text-xs text-muted-foreground">
            Hiển thị {displayedItems.length} / {filteredItems.length}
          </span>
        </div>
      )}
    </div>
  );
}
