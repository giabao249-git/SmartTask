"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  Bell,
  GraduationCap,
  ShieldAlert,
  Sliders,
  Sparkles,
  UserCircle,
  Users,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { useAuth } from "@/lib/auth";
import { readLastProject } from "@/lib/hooks/use-project";
import { useSlideEnter } from "@/lib/hooks/use-enter-animation";
import { useProject } from "@/lib/hooks/queries";
import { NotificationsPanel, useBellCount } from "@/features/notifications/NotificationsPanel";
import { cn } from "@/lib/utils";
import { AiSettingsView } from "./AiSettingsView";
import { MembersTab } from "./MembersTab";
import { ProfileTab } from "./ProfileTab";
import { SkillsCatalogTab } from "./SkillsCatalogTab";
import { WorkspaceSettingsTab } from "./WorkspaceSettingsTab";

const LAST_WS_KEY = "st.lastWorkspace";
const readLastWorkspace = () => {
  try {
    return typeof window === "undefined" ? null : localStorage.getItem(LAST_WS_KEY);
  } catch {
    return null;
  }
};

/** Đúng thứ tự trên menu từ trên xuống — hiệu ứng đổi mục dựa vào thứ tự này để biết đi lên hay xuống. */
const SETTINGS_TABS = ["profile", "notifications", "members", "skills", "settings", "ai"] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

/** Cài đặt & thông báo (UC-05/06/23/29): 3 phân nhóm rõ ràng (Cá nhân / Workspace / Hệ thống toàn cục) kèm RBAC */
export function SettingsNotificationsView() {
  const auth = useAuth();
  const params = useSearchParams();
  const unread = useBellCount();
  const last = React.useMemo(() => readLastProject(), []);
  const lastProject = useProject(last?.id);

  const [wsId, setWsIdState] = React.useState<string | null>(() => params.get("ws") ?? readLastWorkspace());
  const [activeTab, setActiveTab] = React.useState<SettingsTab>(() => {
    const t = params.get("tab") as SettingsTab | null;
    if (t && SETTINGS_TABS.includes(t)) return t;
    return "profile";
  });

  // Sync workspace change from top navbar
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

  const setWsId = (id: string) => {
    setWsIdState(id);
    try {
      localStorage.setItem(LAST_WS_KEY, id);
    } catch {
      /* private mode */
    }
  };

  const isSuperAdmin = Boolean(
    auth.user?.isSuperAdmin || (auth.user as unknown as { platformRole?: string })?.platformRole === "ROOT_ADMIN"
  );
  const effective =
    wsId && auth.workspaces.some((w) => w.id === wsId)
      ? wsId
      : lastProject.data?.workspaceId && auth.workspaces.some((w) => w.id === lastProject.data?.workspaceId)
      ? lastProject.data?.workspaceId
      : auth.workspaces[0]?.id ?? null;
  const ws = auth.workspaces.find((w) => w.id === effective);
  const isAdmin = isSuperAdmin || ws?.role === "OWNER" || ws?.role === "ADMIN";
  const canEdit = isAdmin;

  // Menu dọc tự viết (không dùng Tabs chung): đi xuống mục dưới thì nội dung trồi từ dưới lên, đi lên thì từ trên xuống
  const contentRef = useSlideEnter<HTMLElement>(SETTINGS_TABS.indexOf(activeTab), { axis: "y" });

  // Change tab and optionally update URL
  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    if (effective) url.searchParams.set("ws", effective);
    window.history.replaceState(null, "", url.toString());
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Thông báo & Cài đặt hệ thống"
        description="Quản lý tài khoản cá nhân, thông báo thời gian thực, thành viên workspace, tham số vận hành và cấu hình AI."
        breadcrumbs={[{ label: ws?.name ?? "Workspace", href: "/workspaces" }, { label: "Cài đặt & Thông báo" }]}
      >
        {auth.workspaces.length > 0 && effective && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Workspace</span>
            <Select value={effective} onValueChange={setWsId}>
              <SelectTrigger className="h-8 text-xs w-56 bg-background">
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

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Sidebar phân nhóm (Cá nhân / Workspace / Hệ thống toàn cục) */}
        <aside className="w-full lg:w-64 shrink-0 rounded-xl border border-border/70 bg-card p-3 shadow-xs space-y-5">
          {/* Nhóm 1: CÁ NHÂN */}
          <div className="space-y-1">
            <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Cá nhân
            </div>
            <button
              type="button"
              onClick={() => handleTabChange("profile")}
              className={cn(
                "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left",
                activeTab === "profile"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <div className="flex items-center gap-2">
                <UserCircle className="h-4 w-4 shrink-0" />
                <span>Hồ sơ & Tài khoản</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("notifications")}
              className={cn(
                "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left",
                activeTab === "notifications"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 shrink-0" />
                <span>Thông báo</span>
              </div>
              {unread > 0 && (
                <Badge
                  variant={activeTab === "notifications" ? "secondary" : "destructive"}
                  className="text-[10px] px-1.5 py-0 h-4 font-mono"
                >
                  {unread}
                </Badge>
              )}
            </button>
          </div>

          {/* Nhóm 2: WORKSPACE */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="truncate">Workspace</span>
              {ws && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono">
                  {ws.role}
                </Badge>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleTabChange("members")}
              className={cn(
                "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left",
                activeTab === "members"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 shrink-0" />
                <span>Thành viên & Quyền</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("skills")}
              className={cn(
                "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left",
                activeTab === "skills"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 shrink-0" />
                <span>Danh mục kỹ năng</span>
              </div>
              {!isAdmin && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 text-muted-foreground border-border/80">
                  Chỉ xem
                </Badge>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("settings")}
              className={cn(
                "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left",
                activeTab === "settings"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 shrink-0" />
                <span>Tham số & Quy tắc</span>
              </div>
              {!isAdmin && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 text-muted-foreground border-border/80">
                  Chỉ xem
                </Badge>
              )}
            </button>
          </div>

          {/* Nhóm 3: HỆ THỐNG TOÀN CỤC */}
          <div className="space-y-1">
            <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Hệ thống toàn cục
            </div>

            <button
              type="button"
              onClick={() => handleTabChange("ai")}
              className={cn(
                "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left",
                activeTab === "ai"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                !isAdmin && "opacity-85"
              )}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 shrink-0 text-info" />
                <span>Cấu hình Trợ lý AI</span>
              </div>
              {isAdmin ? (
                <Badge
                  variant={activeTab === "ai" ? "secondary" : "default"}
                  className="text-[9px] px-1 py-0 font-mono"
                >
                  Admin
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[9px] px-1 py-0 text-muted-foreground border-border/80">
                  Chỉ xem
                </Badge>
              )}
            </button>
          </div>
        </aside>

        {/* Nội dung chi tiết theo phân nhóm */}
        <main ref={contentRef} className="flex-1 min-w-0 w-full">
          {activeTab === "profile" && <ProfileTab />}

          {activeTab === "notifications" && <NotificationsPanel />}

          {activeTab === "members" && (
            effective && ws ? (
              <MembersTab workspaceId={effective} canEdit={canEdit} />
            ) : (
              <NoWorkspace />
            )
          )}

          {activeTab === "skills" && (
            effective && ws ? <SkillsCatalogTab workspaceId={effective} canEdit={canEdit} /> : <NoWorkspace />
          )}

          {activeTab === "settings" && (
            effective && ws ? (
              <div className="space-y-4">
                {!isAdmin && (
                  <Alert className="border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-200 py-3">
                    <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <AlertTitle className="text-xs font-semibold">Chế độ xem (Chỉ đọc)</AlertTitle>
                    <AlertDescription className="text-xs">
                      Bạn đang là <strong>{ws.role}</strong>. Chỉ Quản trị viên (OWNER / ADMIN) mới có thể chỉnh sửa cài đặt và tham số công thức tải của workspace.
                    </AlertDescription>
                  </Alert>
                )}
                <WorkspaceSettingsTab workspaceId={effective} canEdit={canEdit} />
              </div>
            ) : (
              <NoWorkspace />
            )
          )}

          {activeTab === "ai" && (
            effective && ws ? (
              <AiSettingsView workspaceId={effective} canEdit={canEdit} />
            ) : (
              <NoWorkspace />
            )
          )}
        </main>
      </div>
    </div>
  );
}

const NoWorkspace = () => <EmptyState title="Chưa có workspace" description="Tạo hoặc tham gia workspace trước." />;
