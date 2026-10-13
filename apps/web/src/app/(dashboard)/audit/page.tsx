"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/lib/auth";
import { readLastProject } from "@/lib/hooks/use-project";
import { useProject } from "@/lib/hooks/queries";
import { WorkspaceAuditTab } from "@/features/settings/WorkspaceAuditTab";

const LAST_WS_KEY = "st.lastWorkspace";
const readLastWorkspace = () => {
  try {
    return typeof window === "undefined"
      ? null
      : localStorage.getItem(LAST_WS_KEY);
  } catch {
    return null;
  }
};

function AuditLogPageContent() {
  const auth = useAuth();
  const params = useSearchParams();
  const last = React.useMemo(() => readLastProject(), []);
  const lastProject = useProject(last?.id);

  const [wsId, setWsIdState] = React.useState<string | null>(
    () => params.get("ws") ?? readLastWorkspace(),
  );

  // Đồng bộ khi người dùng đổi Workspace từ thanh điều hướng trên cùng
  React.useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ workspaceId: string }>;
      if (custom.detail?.workspaceId) {
        setWsIdState(custom.detail.workspaceId);
      }
    };
    window.addEventListener("st:workspace-changed", handler);
    return () => window.removeEventListener("st:workspace-changed", handler);
  }, []);



  const isSuperAdmin = Boolean(
    auth.user?.isSuperAdmin ||
      (auth.user as unknown as { platformRole?: string })?.platformRole ===
        "ROOT_ADMIN",
  );

  const effective =
    wsId && auth.workspaces.some((w) => w.id === wsId)
      ? wsId
      : lastProject.data?.workspaceId &&
          auth.workspaces.some((w) => w.id === lastProject.data?.workspaceId)
        ? lastProject.data?.workspaceId
        : (auth.workspaces.find((w) => w.role === "OWNER" || w.role === "ADMIN")
            ?.id ??
          auth.workspaces[0]?.id ??
          null);

  const ws = auth.workspaces.find((w) => w.id === effective);
  const isAdmin =
    isSuperAdmin || ws?.role === "OWNER" || ws?.role === "ADMIN";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nhật ký kiểm toán (Audit Log)"
        description="Tra cứu bất biến toàn bộ thay đổi về phân quyền, thành viên, cấu hình AI/FinOps, dự án và tham số vận hành của Workspace."
        breadcrumbs={[
          { label: ws?.name ?? "Workspace", href: "/workspaces" },
          { label: "Nhật ký kiểm toán" },
        ]}
      />

      {!effective || !ws ? (
        <EmptyState
          title="Chưa có workspace"
          description="Tạo hoặc tham gia workspace trước để xem nhật ký kiểm toán."
        />
      ) : !isAdmin ? (
        <Alert className="border-rose-500/30 bg-rose-500/5 text-rose-900 dark:text-rose-200 py-3">
          <ShieldAlert className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          <AlertTitle className="text-xs font-semibold">
            Không có quyền truy cập Nhật ký kiểm toán
          </AlertTitle>
          <AlertDescription className="text-xs">
            Bạn đang giữ vai trò <strong>{ws.role}</strong> trong workspace{" "}
            <strong>{ws.name}</strong>. Tính năng Nhật ký kiểm toán (Audit Log)
            chỉ dành cho Chủ sở hữu (OWNER) và Quản trị viên (ADMIN).
          </AlertDescription>
        </Alert>
      ) : (
        <WorkspaceAuditTab workspaceId={effective} />
      )}
    </div>
  );
}

export default function AuditLogPage() {
  return (
    <Suspense>
      <AuditLogPageContent />
    </Suspense>
  );
}
