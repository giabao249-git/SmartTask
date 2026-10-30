"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { describeError } from "@/lib/api";
import type { NotificationView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useNotificationMutations, useNotificationRealtime, useNotifications, useUnreadCount } from "./hooks";

const TYPE_LABEL: Record<string, string> = {
  TASK_ASSIGNED: "Giao việc",
  MENTIONED: "Nhắc tên",
  TASK_DUE_SOON: "Sắp hạn",
  TASK_OVERDUE: "Quá hạn",
  WORKLOAD_ALERT: "Quá tải",
  SPRINT_STARTED: "Sprint bắt đầu",
  SPRINT_CLOSED: "Sprint kết thúc",
  AI_PROPOSAL_APPLIED: "AI áp dụng",
  INVITATION: "Lời mời",
};

const fmt = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** Trung tâm thông báo (UC-20): GET /notifications, đọc/đọc tất cả, socket notification:new → toast. */
export function NotificationsPanel({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  const router = useRouter();
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const list = useNotifications(unreadOnly);
  const mut = useNotificationMutations();
  useNotificationRealtime((n) => toast.info(n.title, { description: n.body ?? undefined }));

  const open = (n: NotificationView) => {
    if (!n.isRead) mut.markRead.mutate(n.id);
    const link = linkOf(n);
    if (link) {
      onNavigate?.();
      router.push(link);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className={cn("flex items-center justify-between gap-2", compact ? "p-3 border-b border-border/60" : "pb-3")}>
        <div className="flex items-center gap-1.5">
          <Button variant={unreadOnly ? "outline" : "default"} size="sm" className="h-7 text-xs" onClick={() => setUnreadOnly(false)}>
            Tất cả
          </Button>
          <Button variant={unreadOnly ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setUnreadOnly(true)}>
            Chưa đọc
          </Button>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" disabled={mut.readAll.isPending} onClick={() => mut.readAll.mutate(undefined, { onSuccess: () => toast.success("Đã đánh dấu tất cả là đã đọc") })}>
          <CheckCheck className="h-3.5 w-3.5" /> Đọc tất cả
        </Button>
      </div>
      <ScrollArea className={cn("flex-1", compact ? "max-h-[360px]" : "")}>
        {list.isPending ? (
          <div className="space-y-2 p-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : list.isError ? (
          <div className="p-2">
            <ErrorState code={describeError(list.error).code} message={describeError(list.error).message} onRetry={() => list.refetch()} />
          </div>
        ) : list.data.items.length === 0 ? (
          <EmptyState icon={Bell} title={unreadOnly ? "Không có thông báo chưa đọc" : "Chưa có thông báo"} description="Giao việc, nhắc tên, quá tải, AI áp dụng sẽ xuất hiện ở đây." className="py-8" />
        ) : (
          <div className="divide-y divide-border/40">
            {list.data.items.map((n) => (
              <Button key={n.id} variant="ghost" onClick={() => open(n)} className={cn("w-full h-auto justify-start text-left rounded-none p-3 flex flex-col items-start gap-0.5", !n.isRead && "bg-primary/5")}>
                <div className="flex items-center justify-between w-full gap-2">
                  <span className={cn("text-xs font-semibold truncate", !n.isRead ? "text-foreground" : "text-muted-foreground")}>{n.title}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{fmt(n.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2 w-full">
                  <Badge variant="outline" className="text-[11px] px-1.5 py-0 font-medium">
                    {TYPE_LABEL[n.type] ?? n.type}
                  </Badge>
                  {n.body && <span className="text-xs text-muted-foreground truncate">{n.body}</span>}
                </div>
              </Button>
            ))}
          </div>
        )}
      </ScrollArea>
      {compact && (
        <div className="p-2 border-t border-border/60 bg-muted/20 flex items-center justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground hover:text-foreground h-7"
            onClick={() => {
              onNavigate?.();
              router.push("/settings?tab=notifications");
            }}
          >
            Mở trang Thông báo & Cài đặt →
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Đường dẫn để mở một thông báo. Thông báo lưu trước 28/09 mang link `/p/ST/t/ST-6`, `/p/ST/sprints` —
 * web không có route `/p` (404) nên đổi sang route thật nhờ `data.projectId`.
 */
function linkOf(n: NotificationView): string | null {
  const pid = typeof n.data?.projectId === "string" ? n.data.projectId : null;
  const l = n.link;
  if (l?.startsWith("/p/")) {
    if (!pid) return null;
    const task = /^\/p\/[^/]+\/t\/([A-Za-z0-9]+-\d+)(#.*)?$/.exec(l);
    if (task) return `/projects/${pid}/tasks/${task[1]}${task[2] ?? ""}`;
    if (/^\/p\/[^/]+\/sprints/.test(l)) return `/projects/${pid}/dashboard${typeof n.data?.sprintId === "string" ? `?sprint=${n.data.sprintId}` : ""}`;
    return `/projects/${pid}/dashboard`;
  }
  if (l) return l;
  return pid ? `/projects/${pid}/work${typeof n.data?.taskId === "string" ? `?task=${n.data.taskId}` : ""}` : null;
}

/** Số chưa đọc cho chuông — AppShell dùng. */
export function useBellCount(): number {
  return useUnreadCount().data?.count ?? 0;
}
