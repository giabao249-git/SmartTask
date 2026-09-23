"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/app/ErrorState";
import { PageHeader } from "@/components/app/PageHeader";
import { TaskDetailBody } from "@/components/app/TaskDetailSheet";
import { api, describeError } from "@/lib/api";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { taskKeys } from "@/features/board/hooks";
import type { TaskDetail } from "@/lib/types";

/**
 * Trang riêng cho một công việc: /projects/:projectId/tasks/ST-12 (docs 02/05 §D2).
 *
 * Sheet vẫn là đường mặc định khi bấm thẻ trên bảng — nhanh và giữ ngữ cảnh. Trang này để
 * đọc kỹ, in, mở hai việc cạnh nhau hoặc gửi link cho người khác. Dùng lại đúng
 * `TaskDetailBody` của Sheet nên không có bản sao logic thứ hai.
 *
 * URL mang mã ST-n đúng quy ước định danh ở docs 11 §2, và gọi
 * `GET /tasks/by-key/:projectKey/:number` vốn đã có từ Phase 3.
 */
export default function TaskPage() {
  const { taskKey } = useParams<{ taskKey: string }>();
  const router = useRouter();
  const project = useCurrentProject();

  const decoded = decodeURIComponent(taskKey ?? "");
  const number = Number(decoded.split("-").pop());
  const valid = decoded.includes("-") && Number.isInteger(number) && number > 0;

  const q = useQuery({
    queryKey: ["tasks", "by-key", project.key, number] as const,
    queryFn: () => api.get<TaskDetail>(`/tasks/by-key/${project.key}/${number}`),
    enabled: valid,
  });
  // Dùng chung khoá cache với Sheet để sửa ở đây thì bảng cũng thấy ngay
  const cached = useQuery({
    queryKey: taskKeys.detail(q.data?.id ?? ""),
    queryFn: () => api.get<TaskDetail>(`/tasks/${q.data?.id}`),
    enabled: false,
    initialData: q.data,
  });
  const task = cached.data ?? q.data;

  const backToBoard = () =>
    router.push(`/projects/${project.id}/work?view=board${task ? `&task=${task.id}` : ""}`);

  return (
    <div className="space-y-4">
      <PageHeader
        title={decoded}
        description="Chi tiết công việc — trang riêng để đọc kỹ, in hoặc gửi link."
        breadcrumbs={[
          { label: "Workspace", href: "/workspaces" },
          { label: project.name, href: `/projects/${project.id}/dashboard` },
          { label: "Công việc", href: `/projects/${project.id}/work` },
          { label: decoded },
        ]}
      >
        <Button variant="outline" size="sm" className="gap-1.5" onClick={backToBoard}>
          <ArrowLeft className="h-4 w-4" /> Về bảng
        </Button>
      </PageHeader>

      <div className="rounded-xl border border-border/80 bg-card overflow-hidden flex flex-col">
        {!valid ? (
          <div className="p-6">
            <ErrorState code="NOT_FOUND" message={`Mã công việc "${decoded}" không hợp lệ.`} onRetry={backToBoard} />
          </div>
        ) : q.isPending ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : q.isError || !task ? (
          <div className="p-6">
            <ErrorState code={describeError(q.error).code} message={describeError(q.error).message} onRetry={() => q.refetch()} />
          </div>
        ) : (
          <TaskDetailBody task={task} project={project} onRefresh={() => void q.refetch()} variant="page" />
        )}
      </div>
    </div>
  );
}
