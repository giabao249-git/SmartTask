"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  GraduationCap,
  KeyRound,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  UserCircle,
  Users,
  ArrowRight,
  Server,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { useAuth } from "@/lib/auth";
import { readLastProject } from "@/lib/hooks/use-project";
import { useProject } from "@/lib/hooks/queries";
import { useBellCount } from "@/features/notifications/NotificationsPanel";
import { cn } from "@/lib/utils";
import { AiSettingsView } from "./AiSettingsView";
import { MembersTab } from "./MembersTab";
import { ProfileTab } from "./ProfileTab";
import { SkillsCatalogTab } from "./SkillsCatalogTab";
import { WorkspaceSettingsTab } from "./WorkspaceSettingsTab";
import { SecurityTab } from "./SecurityTab";
import { PersonalAiKeysTab } from "./PersonalAiKeysTab";
import { NotificationsTab } from "./NotificationsTab";

const LAST_WS_KEY = "st.lastWorkspace";
const readLastWorkspace = () => {
  try {
    return typeof window === "undefined" ? null : localStorage.getItem(LAST_WS_KEY);
  } catch {
    return null;
  }
};

export type SettingsTab =
  | "profile"
  | "security"
  | "notifications"
  | "personal-ai"
  | "workspace-general"
  | "members"
  | "skills"
  | "workspace-ai";

interface TabDefinition {
  id: SettingsTab;
  label: string;
  category: "personal" | "workspace";
  icon: React.ElementType;
  keywords: string[];
  badge?: string;
  adminOnly?: boolean;
}

const ALL_TABS: TabDefinition[] = [
  // Cá nhân (4 tabs)
  {
    id: "profile",
    label: "Hồ sơ & Tài khoản",
    category: "personal",
    icon: UserCircle,
    keywords: ["hồ sơ", "tài khoản", "tên", "email", "avatar", "múi giờ", "profile"],
  },
  {
    id: "security",
    label: "Bảo mật & Phiên",
    category: "personal",
    icon: KeyRound,
    keywords: ["mật khẩu", "bảo mật", "phiên", "đăng xuất", "password", "security", "sessions"],
  },
  {
    id: "notifications",
    label: "Thông báo & Kênh nhận",
    category: "personal",
    icon: Bell,
    keywords: ["thông báo", "chuông", "email", "push", "tin nhắn", "notification"],
  },
  {
    id: "personal-ai",
    label: "Khóa AI cá nhân (BYOK)",
    category: "personal",
    icon: Sparkles,
    keywords: ["khóa ai", "byok", "gemini", "openai", "deepseek", "key", "api key", "cá nhân"],
  },

  // Workspace (4 tabs)
  {
    id: "workspace-general",
    label: "Tham số & Quy tắc",
    category: "workspace",
    icon: Sliders,
    keywords: ["quy tắc", "tham số", "lịch", "giờ làm", "tải", "daily limit", "general", "cài đặt"],
  },
  {
    id: "members",
    label: "Thành viên & Phân quyền",
    category: "workspace",
    icon: Users,
    keywords: ["thành viên", "quyền", "rbac", "mời", "members", "admin", "owner"],
  },
  {
    id: "skills",
    label: "Danh mục kỹ năng",
    category: "workspace",
    icon: GraduationCap,
    keywords: ["kỹ năng", "chuyên môn", "skill", "từ điển", "catalog"],
  },
  {
    id: "workspace-ai",
    label: "Trợ lý AI Đội nhóm",
    category: "workspace",
    icon: Sparkles,
    keywords: ["ai đội nhóm", "model", "token", "prompt", "quota", "workspace ai", "chi phí"],
  },
];

/**
 * Trung tâm Cài đặt & Tùy chọn (Quy hoạch chuẩn hóa 8 tab):
 * - Nhóm Cá nhân: profile, security, notifications, personal-ai
 * - Nhóm Workspace: workspace-general, members, skills, workspace-ai
 * - Cầu nối sang /admin (Platform Mission Control) và /audit (Audit Log chuyên dụng)
 */
export function SettingsNotificationsView() {
  const router = useRouter();
  const auth = useAuth();
  const params = useSearchParams();
  const unread = useBellCount();
  const last = React.useMemo(() => readLastProject(), []);
  const lastProject = useProject(last?.id);

  const [wsId, setWsIdState] = React.useState<string | null>(() => params.get("ws") ?? readLastWorkspace());
  const [searchQuery, setSearchQuery] = React.useState("");

  // Backward-compatibility tab resolving
  const resolveTab = (tabParam: string | null): SettingsTab => {
    if (!tabParam) return "profile";
    if (tabParam === "settings") return "workspace-general";
    if (tabParam === "ai") return "workspace-ai";
    if (tabParam === "audit") {
      // Sẽ được redirect bằng useEffect
      return "workspace-general";
    }
    const valid = ALL_TABS.some((t) => t.id === tabParam);
    return valid ? (tabParam as SettingsTab) : "profile";
  };

  const [activeTab, setActiveTab] = React.useState<SettingsTab>(() => resolveTab(params.get("tab")));

  // Handle audit redirect
  React.useEffect(() => {
    const rawTab = params.get("tab");
    if (rawTab === "audit") {
      router.replace("/audit");
    }
  }, [params, router]);

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

  // Change tab and sync with URL query
  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    if (effective) url.searchParams.set("ws", effective);
    window.history.replaceState(null, "", url.toString());
  };

  // Filter tabs by search keyword
  const filteredTabs = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ALL_TABS;
    return ALL_TABS.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.keywords.some((k) => k.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  const personalTabs = filteredTabs.filter((t) => t.category === "personal");
  const workspaceTabs = filteredTabs.filter((t) => t.category === "workspace");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trung tâm Cài đặt & Tùy chọn"
        description="Quản lý hồ sơ cá nhân, bảo mật tài khoản, thông báo thời gian thực, thành viên workspace và cấu hình Trợ lý AI."
        breadcrumbs={[{ label: ws?.name ?? "Workspace", href: "/workspaces" }, { label: "Cài đặt & Tùy chọn" }]}
      />

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Sidebar điều hướng Cài đặt (8 Tabs phân nhóm rõ ràng) */}
        <aside className="w-full lg:w-72 shrink-0 rounded-xl border border-border/70 bg-card p-3 shadow-xs space-y-4">
          {/* Ô tìm kiếm nhanh tab */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm mục cài đặt..."
              className="h-8 pl-8 text-xs bg-muted/40 border-border/70 focus-visible:bg-background"
            />
          </div>

          {/* Nhóm 1: CÁ NHÂN */}
          {personalTabs.length > 0 && (
            <div className="space-y-1">
              <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Cá nhân
              </div>
              {personalTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleTabChange(tab.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{tab.label}</span>
                    </div>

                    {tab.id === "notifications" && unread > 0 && (
                      <Badge
                        variant={isActive ? "secondary" : "destructive"}
                        className="text-[10px] px-1.5 py-0 h-4 font-mono"
                      >
                        {unread}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Nhóm 2: WORKSPACE */}
          {workspaceTabs.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span className="truncate">Workspace</span>
                {ws && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono">
                    {ws.role}
                  </Badge>
                )}
              </div>

              {workspaceTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleTabChange(tab.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{tab.label}</span>
                    </div>

                    {!isAdmin && ["workspace-general", "skills", "workspace-ai"].includes(tab.id) && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 text-muted-foreground border-border/80">
                        Chỉ xem
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* CẦU NỐI ĐIỀU HƯỚNG QUẢN TRỊ / GIÁM SÁT (Cross-link Bridge) */}
          <div className="pt-2 border-t border-border/60 space-y-2">
            {isSuperAdmin ? (
              <div className="p-3 rounded-lg border border-purple-500/20 bg-purple-500/5 dark:bg-purple-950/20 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300">
                  <Server className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                  <span>Platform Mission Control</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Toàn quyền giám sát máy chủ, kiểm soát hạn mức AI và nhật ký kiểm toán nền tảng.
                </p>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full h-7 text-xs border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 gap-1 justify-between"
                >
                  <Link href="/admin">
                    <span>Mở Mission Control</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            ) : isAdmin ? (
              <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/20 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Nhật ký kiểm toán</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Trang chuyên dụng giám sát toàn diện hoạt động, quyền hạn và thao tác trong workspace.
                </p>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full h-7 text-xs border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 gap-1 justify-between"
                >
                  <Link href="/audit">
                    <span>Mở trang Kiểm toán</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>
        </aside>

        {/* Nội dung chi tiết từng tab */}
        <main className="flex-1 min-w-0 w-full">
          {activeTab === "profile" && <ProfileTab />}

          {activeTab === "security" && <SecurityTab />}

          {activeTab === "notifications" && <NotificationsTab />}

          {activeTab === "personal-ai" && <PersonalAiKeysTab />}

          {activeTab === "workspace-general" && (
            effective && ws ? (
              <div className="space-y-4">
                {!isAdmin && (
                  <Alert className="border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-200 py-3">
                    <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <AlertTitle className="text-xs font-semibold">Chế độ xem (Chỉ đọc)</AlertTitle>
                    <AlertDescription className="text-xs">
                      Bạn đang là <strong>{ws.role}</strong>. Chỉ Quản trị viên (OWNER / ADMIN) mới có thể chỉnh sửa
                      tham số và quy tắc công thức tải của workspace.
                    </AlertDescription>
                  </Alert>
                )}
                <WorkspaceSettingsTab workspaceId={effective} canEdit={canEdit} />
              </div>
            ) : (
              <NoWorkspace />
            )
          )}

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

          {activeTab === "workspace-ai" && (
            effective && ws ? (
              <div className="space-y-4">
                <AiSettingsView workspaceId={effective} canEdit={canEdit} />
              </div>
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
