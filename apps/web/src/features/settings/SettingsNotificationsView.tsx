"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Bell, Bot, Settings, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { useAuth } from "@/lib/auth";
import { readLastProject } from "@/lib/hooks/use-project";
import { useProject } from "@/lib/hooks/queries";
import { NotificationsPanel, useBellCount } from "@/features/notifications/NotificationsPanel";
import { AiPolicyView } from "./AiPolicyView";
import { MembersTab } from "./MembersTab";
import { WorkspaceSettingsTab } from "./WorkspaceSettingsTab";

const LAST_WS_KEY = "st.lastWorkspace";
const readLastWorkspace = () => {
  try {
    return typeof window === "undefined" ? null : localStorage.getItem(LAST_WS_KEY);
  } catch {
    return null;
  }
};

/** Cài đặt & thông báo (UC-05/06/23/29): chọn workspace (mặc định của dự án mở gần nhất), 4 tab nối API thật. */
export function SettingsNotificationsView() {
  const auth = useAuth();
  const params = useSearchParams();
  const unread = useBellCount();
  const last = React.useMemo(() => readLastProject(), []);
  const lastProject = useProject(last?.id);
  const [wsId, setWsIdState] = React.useState<string | null>(() => params.get("ws") ?? readLastWorkspace());
  const setWsId = (id: string) => {
    setWsIdState(id);
    try {
      localStorage.setItem(LAST_WS_KEY, id);
    } catch {
      /* private mode */
    }
  };
  const effective = wsId ?? lastProject.data?.workspaceId ?? auth.workspaces[0]?.id ?? null;
  const ws = auth.workspaces.find((w) => w.id === effective);
  const canEdit = ws?.role === "OWNER" || ws?.role === "ADMIN";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Thông báo & Cài đặt Workspace"
        description="Thông báo realtime, chính sách chọn người của Trợ lý AI, thành viên & lời mời, tham số công thức tải."
        breadcrumbs={[{ label: ws?.name ?? "Workspace", href: "/workspaces" }, { label: "Cài đặt & Thông báo" }]}
      >
        {auth.workspaces.length > 0 && effective && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Workspace</span>
            <Select value={effective} onValueChange={setWsId}>
              <SelectTrigger className="h-8 text-xs w-56">
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
          </div>
        )}
      </PageHeader>

      <Tabs defaultValue={params.get("tab") ?? "notifications"} className="w-full space-y-4">
        <TabsList className="grid w-full sm:w-[640px] grid-cols-4">
          <TabsTrigger value="notifications" className="text-xs gap-1.5">
            <Bell className="h-3.5 w-3.5" />
            Thông báo{unread > 0 ? ` (${unread})` : ""}
          </TabsTrigger>
          <TabsTrigger value="ai" className="text-xs gap-1.5">
            <Bot className="h-3.5 w-3.5" />
            Trợ lý AI
          </TabsTrigger>
          <TabsTrigger value="members" className="text-xs gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Thành viên
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-xs gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            Tham số
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications">
          <NotificationsPanel />
        </TabsContent>
        <TabsContent value="ai">{effective && ws ? <AiPolicyView workspaceId={effective} canEdit={canEdit} /> : <NoWorkspace />}</TabsContent>
        <TabsContent value="members">{effective && ws ? <MembersTab workspaceId={effective} canEdit={canEdit} /> : <NoWorkspace />}</TabsContent>
        <TabsContent value="settings">{effective && ws ? <WorkspaceSettingsTab workspaceId={effective} canEdit={canEdit} /> : <NoWorkspace />}</TabsContent>
      </Tabs>
    </div>
  );
}

const NoWorkspace = () => <EmptyState title="Chưa có workspace" description="Tạo hoặc tham gia workspace trước." />;
