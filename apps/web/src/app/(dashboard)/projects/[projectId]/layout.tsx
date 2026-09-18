"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useProject } from "@/lib/hooks/queries";
import { ProjectProvider } from "@/lib/hooks/use-project";
import { describeError } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/app/ErrorState";

/** Nạp dự án thật theo :projectId (UUID) một lần cho mọi màn con; key hiển thị lấy từ project.key. */
export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const q = useProject(projectId);

  if (q.isPending)
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  if (q.isError) {
    const { code, message } = describeError(q.error);
    return (
      <ErrorState
        code={code}
        message={code === "NOT_FOUND" ? "Dự án không tồn tại hoặc bạn không phải thành viên." : message}
        onRetry={() => (code === "NOT_FOUND" ? router.push("/workspaces") : q.refetch())}
      />
    );
  }
  return <ProjectProvider project={q.data}>{children}</ProjectProvider>;
}
