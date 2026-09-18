"use client";

import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/app/EmptyState";
import { useAuth } from "@/lib/auth";
import { readLastProject } from "@/lib/hooks/use-project";
import { useProject } from "@/lib/hooks/queries";
import { AiPolicyView } from "./AiPolicyView";

/** Chọn workspace (mặc định workspace của dự án mở gần nhất) rồi hiện cấu hình AI thật. */
export function AiPolicyTab() {
  const auth = useAuth();
  const last = React.useMemo(() => readLastProject(), []);
  const lastProject = useProject(last?.id);
  const [wsId, setWsId] = React.useState<string | null>(null);
  const effective = wsId ?? lastProject.data?.workspaceId ?? auth.workspaces[0]?.id ?? null;
  const ws = auth.workspaces.find((w) => w.id === effective);
  if (!effective || !ws) return <EmptyState title="Chưa có workspace" description="Tạo hoặc tham gia workspace trước." />;
  const canEdit = ws.role === "OWNER" || ws.role === "ADMIN";
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Workspace</span>
        <Select value={effective} onValueChange={setWsId}>
          <SelectTrigger className="h-8 text-xs w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {auth.workspaces.map((w) => (
              <SelectItem key={w.id} value={w.id} className="text-xs">
                {w.name} · {w.role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!canEdit && <span className="text-muted-foreground">(chỉ xem — cần OWNER/ADMIN để sửa)</span>}
      </div>
      <AiPolicyView workspaceId={effective} canEdit={canEdit} />
    </div>
  );
}
