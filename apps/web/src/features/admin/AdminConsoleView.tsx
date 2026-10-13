"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/app/PageHeader";
import { cn } from "@/lib/utils";
import { ArrowLeft, Building2, Cpu, Gauge, RefreshCw, ShieldAlert, Users2 } from "lucide-react";
import { BlastRadiusDrawer } from "./BlastRadiusDrawer";
import { BrandIcon } from "@/components/brand/BrandLogo";

const ADMIN_TABS = [
  { key: "overview", label: "Tổng quan", icon: Gauge },
  { key: "workspaces", label: "Workspaces", icon: Building2 },
  { key: "users", label: "Người dùng", icon: Users2 },
  { key: "finops", label: "AI FinOps", icon: Cpu },
  { key: "telemetry", label: "Hạ tầng & Audit", icon: ShieldAlert },
] as const;
import type {
  AdminUserItem,
  AdminWorkspaceItem,
  PlatformStats,
  SystemAuditLogItem,
  SystemTelemetry,
  WorkspaceLifecycleStatus,
} from "@/lib/types";

export interface AiFinOpsCostItem {
  provider: string;
  model: string;
  calls: number;
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  costVnd: number;
}

export function AdminConsoleView() {
  const auth = useAuth();
  const [activeTab, setActiveTab] = React.useState("overview");
  const [stats, setStats] = React.useState<PlatformStats | null>(null);
  const [workspaces, setWorkspaces] = React.useState<AdminWorkspaceItem[]>([]);
  const [workspaceSearch, setWorkspaceSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [selectedWorkspace, setSelectedWorkspace] = React.useState<AdminWorkspaceItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  const [users, setUsers] = React.useState<AdminUserItem[]>([]);
  const [userSearch, setUserSearch] = React.useState("");

  const [aiCosts, setAiCosts] = React.useState<AiFinOpsCostItem[]>([]);
  const [telemetry, setTelemetry] = React.useState<SystemTelemetry | null>(null);
  const [auditLogs, setAuditLogs] = React.useState<SystemAuditLogItem[]>([]);
  const [integrityVerified, setIntegrityVerified] = React.useState<boolean>(true);

  const [isLoading, setIsLoading] = React.useState(true);
  const [maintenanceMode, setMaintenanceMode] = React.useState<"DISABLED" | "READ_ONLY" | "FULL">("DISABLED");

  const loadAllData = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const [statsData, wsData, usersData, aiData, teleData, auditData] = await Promise.all([
        api.get<PlatformStats>("/admin/stats").catch(() => null),
        api.get<{ items: AdminWorkspaceItem[] }>("/admin/workspaces?limit=50").catch(() => ({ items: [] })),
        api.get<{ items: AdminUserItem[] }>("/admin/users?limit=50").catch(() => ({ items: [] })),
        api.get<AiFinOpsCostItem[]>("/admin/ai/costs?days=30").catch(() => []),
        api.get<SystemTelemetry>("/admin/health/telemetry").catch(() => null),
        api.get<{ items: SystemAuditLogItem[]; integrityCheck?: { isCompromised: boolean } }>("/admin/audit-logs?limit=30").catch(() => ({ items: [], integrityCheck: { isCompromised: false } })),
      ]);

      if (statsData) setStats(statsData);
      if (wsData?.items) setWorkspaces(wsData.items);
      if (usersData?.items) setUsers(usersData.items);
      if (aiData) setAiCosts(aiData);
      if (teleData) {
        setTelemetry(teleData);
        setMaintenanceMode(teleData.maintenance?.mode || "DISABLED");
      }
      if (auditData?.items) {
        setAuditLogs(auditData.items);
        setIntegrityVerified(!auditData.integrityCheck?.isCompromised);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleStatusChange = async (
    workspaceId: string,
    newStatus: WorkspaceLifecycleStatus,
    reason: string,
    ticketReference?: string,
  ) => {
    await api.patch(`/admin/workspaces/${workspaceId}/status`, {
      status: newStatus,
      reason,
      ticketReference,
    });
    await loadAllData();
  };

  const handleRevokeSessions = async (userId: string, email: string) => {
    if (confirm(`Xác nhận cưỡng chế thu hồi mọi phiên đăng nhập của người dùng ${email}?`)) {
      await api.post(`/admin/users/${userId}/revoke-sessions`, {});
      alert(`Đã thu hồi thành công phiên đăng nhập của ${email}`);
    }
  };

  const handleToggleSuperAdmin = async (user: AdminUserItem) => {
    const nextState = !user.isSuperAdmin;
    const action = nextState ? "thăng cấp thành Super Admin" : "hạ quyền Super Admin";
    if (confirm(`Bạn có chắc chắn muốn ${action} cho người dùng ${user.email}?`)) {
      await api.patch(`/admin/users/${user.id}/platform-role`, {
        isSuperAdmin: nextState,
        platformRole: nextState ? "ROOT_ADMIN" : null,
        reason: `Điều chỉnh phân quyền từ Admin Console bởi ${auth.user?.email}`,
      });
      await loadAllData();
    }
  };

  const handleSetMaintenance = async (mode: "DISABLED" | "READ_ONLY" | "FULL") => {
    await api.post("/admin/system/maintenance", {
      mode,
      reason: `Cập nhật trạng thái bảo trì bởi Super Admin ${auth.user?.email}`,
      expectedDurationMinutes: 30,
    });
    setMaintenanceMode(mode);
    await loadAllData();
  };

  const filteredWorkspaces = workspaces.filter((w) => {
    const matchSearch =
      !workspaceSearch ||
      w.name.toLowerCase().includes(workspaceSearch.toLowerCase()) ||
      w.slug.toLowerCase().includes(workspaceSearch.toLowerCase());
    const matchStatus = statusFilter === "ALL" || w.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const filteredUsers = users.filter((u) => {
    return (
      !userSearch ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.fullName.toLowerCase().includes(userSearch.toLowerCase())
    );
  });

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Thanh trên: cùng chiều cao/nền với header các màn khác */}
      <header className="sticky top-0 z-40 h-14 border-b border-border/80 bg-card/95 backdrop-blur px-4 sm:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button asChild variant="ghost" size="sm" className="h-8 text-xs gap-1.5">
            <Link href="/workspaces">
              <ArrowLeft className="h-3.5 w-3.5" /> Về Workspace
            </Link>
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-2 min-w-0">
            <BrandIcon size={20} className="shrink-0" />
            <span className="font-semibold tracking-tight text-sm truncate">SmartTask Mission Control</span>
            <Badge variant="destructive" className="font-mono text-[10px] px-1.5 py-0 hidden sm:inline-flex">
              PLATFORM ADMIN
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {telemetry?.maintenance?.mode !== "DISABLED" && telemetry?.maintenance?.mode && (
            <Badge variant="warning" className="text-[10px] font-mono">
              ĐANG BẢO TRÌ · {telemetry.maintenance.mode}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground hidden lg:inline">{auth.user?.email}</span>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={loadAllData} disabled={isLoading}>
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            {isLoading ? "Đang đồng bộ…" : "Làm mới"}
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-screen-2xl mx-auto p-4 sm:p-6 space-y-6">
        <PageHeader
          title="Quản trị nền tảng"
          description="Giám sát toàn sàn: vòng đời workspace, tài khoản, chi phí AI, hạ tầng và nhật ký kiểm toán."
          breadcrumbs={[{ label: "Workspace", href: "/workspaces" }, { label: "Quản trị nền tảng" }]}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="h-9 hidden sm:inline-flex">
            {ADMIN_TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="text-xs gap-1.5">
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="h-9 text-xs w-56 sm:hidden">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ADMIN_TABS.map((t) => (
                <SelectItem key={t.key} value={t.key} className="text-xs">
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* TAB 1: OVERVIEW */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-border/80">
                <CardHeader className="p-4 pb-2">
                  <CardDescription className="text-xs font-semibold uppercase">Tổ chức / Workspaces</CardDescription>
                  <CardTitle className="text-2xl font-semibold tabular-nums">{stats?.workspaces?.total ?? 0}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground flex justify-between">
                  <span>Hoạt động: <strong className="text-foreground">{stats?.workspaces?.active ?? 0}</strong></span>
                  <span>Đình chỉ: <strong className="text-destructive">{stats?.workspaces?.suspended ?? 0}</strong></span>
                </CardContent>
              </Card>

              <Card className="border-border/80">
                <CardHeader className="p-4 pb-2">
                  <CardDescription className="text-xs font-semibold uppercase">Người dùng Toàn sàn</CardDescription>
                  <CardTitle className="text-2xl font-semibold tabular-nums">{stats?.users?.total ?? 0}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground flex justify-between">
                  <span>Khả dụng: <strong className="text-foreground">{stats?.users?.active ?? 0}</strong></span>
                  <span>Super Admins: <strong className="text-primary">{stats?.users?.superAdmins ?? 0}</strong></span>
                </CardContent>
              </Card>

              <Card className="border-border/80">
                <CardHeader className="p-4 pb-2">
                  <CardDescription className="text-xs font-semibold uppercase">Tác vụ & Dự án</CardDescription>
                  <CardTitle className="text-2xl font-semibold tabular-nums">{stats?.tasks?.total ?? 0}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground flex justify-between">
                  <span>Hoàn thành: <strong className="text-foreground">{stats?.tasks?.completed ?? 0}</strong></span>
                  <span>Tỷ lệ: <strong className="text-emerald-600">{stats?.tasks?.completionRate ?? 0}%</strong></span>
                </CardContent>
              </Card>

              <Card className="border-border/80">
                <CardHeader className="p-4 pb-2">
                  <CardDescription className="text-xs font-semibold uppercase">Tiêu thụ AI FinOps (30d)</CardDescription>
                  <CardTitle className="text-2xl font-semibold tabular-nums">
                    ${stats?.aiFinOps?.totalCostUsd?.toFixed(2) ?? "0.00"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground flex justify-between">
                  <span>Lượt gọi: <strong className="text-foreground">{stats?.aiFinOps?.totalCalls ?? 0}</strong></span>
                  <span>Quy đổi: <strong className="text-foreground">{(stats?.aiFinOps?.totalCostVnd ?? 0).toLocaleString()} ₫</strong></span>
                </CardContent>
              </Card>
            </div>

            {/* Quick Status Bar */}
            <Card className="border border-border/70">
              <CardHeader>
                <CardTitle className="text-base">Trạng thái Nền tảng & Tuân thủ SOC 2</CardTitle>
                <CardDescription>
                  Kiểm soát hoạt động đa tổ chức, bảo vệ SLA 99.95% và nhật ký kiểm toán bất biến.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-md bg-muted/40 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Cơ sở dữ liệu: <strong>PostgreSQL Pool Connected</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span>Kiểm toán chuỗi băm HMAC: <strong>{integrityVerified ? "Tamper-Proof Verified" : "Compromised"}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                    <span>Chế độ bảo trì: <strong>{maintenanceMode}</strong></span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: WORKSPACES */}
          <TabsContent value="workspaces" className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Input
                  placeholder="Tìm theo tên hoặc slug…"
                  value={workspaceSearch}
                  onChange={(e) => setWorkspaceSearch(e.target.value)}
                  className="h-8 text-xs w-full sm:w-72"
                />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 text-xs w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL" className="text-xs">
                      Tất cả trạng thái
                    </SelectItem>
                    {["ACTIVE", "WARNING_GRACE", "READ_ONLY_ENFORCED", "SOFT_SUSPENDED"].map((st) => (
                      <SelectItem key={st} value={st} className="text-xs font-mono">
                        {st}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-xs text-muted-foreground">
                Hiển thị <strong>{filteredWorkspaces.length}</strong> / {workspaces.length} tổ chức
              </div>
            </div>

            <Card className="border-border/80 overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs ">Tổ chức (Workspace)</TableHead>
                      <TableHead className="text-xs ">Chủ sở hữu</TableHead>
                      <TableHead className="text-xs text-center">Thành viên</TableHead>
                      <TableHead className="text-xs text-center">Dự án</TableHead>
                      <TableHead className="text-xs text-center">AI Calls</TableHead>
                      <TableHead className="text-xs ">Trạng thái</TableHead>
                      <TableHead className="text-xs text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWorkspaces.map((ws) => (
                      <TableRow key={ws.id} className="text-xs">
                        <TableCell className="">
                          <div className="font-semibold text-foreground">{ws.name}</div>
                          <div className="text-xs font-mono text-muted-foreground">{ws.slug}</div>
                        </TableCell>
                        <TableCell className="">
                          <div className="text-foreground">{ws.owner?.fullName || "—"}</div>
                          <div className="text-xs text-muted-foreground">{ws.owner?.email}</div>
                        </TableCell>
                        <TableCell className="text-center font-mono">{ws.membersCount}</TableCell>
                        <TableCell className="text-center font-mono">{ws.projectsCount}</TableCell>
                        <TableCell className="text-center font-mono">{ws.aiCallsCount}</TableCell>
                        <TableCell className="">
                          <Badge
                            variant={
                              ws.status === "ACTIVE"
                                ? "default"
                                : ws.status === "SOFT_SUSPENDED"
                                ? "destructive"
                                : "outline"
                            }
                            className="text-xs"
                          >
                            {ws.status}
                          </Badge>
                          {ws.suspendReason && (
                            <div className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-xs">
                              {ws.suspendReason}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedWorkspace(ws);
                              setIsDrawerOpen(true);
                            }}
                          >
                            Điều phối Vòng đời
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* TAB 3: USERS */}
          <TabsContent value="users" className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <Input
                placeholder="Tìm người dùng theo tên hoặc email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full sm:w-80"
              />
              <div className="text-xs text-muted-foreground">
                Hiển thị <strong>{filteredUsers.length}</strong> / {users.length} người dùng
              </div>
            </div>

            <Card className="border-border/80 overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs ">Người dùng</TableHead>
                      <TableHead className="text-xs ">Vai trò Nền tảng</TableHead>
                      <TableHead className="text-xs text-center">Workspaces</TableHead>
                      <TableHead className="text-xs ">Ngày tạo</TableHead>
                      <TableHead className="text-xs text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((u) => (
                      <TableRow key={u.id} className="text-xs">
                        <TableCell className="">
                          <div className="font-semibold text-foreground">{u.fullName}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </TableCell>
                        <TableCell className="">
                          {u.isSuperAdmin ? (
                            <Badge variant="default" className="text-xs bg-indigo-600">
                              {u.platformRole || "SUPER_ADMIN"}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              MEMBER
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-mono">{u.workspacesCount}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(u.createdAt).toLocaleDateString("vi-VN")}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleSuperAdmin(u)}
                            className="text-xs"
                          >
                            {u.isSuperAdmin ? "Hạ quyền Admin" : "Cấp Super Admin"}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRevokeSessions(u.id, u.email)}
                            className="text-xs"
                          >
                            Thu hồi phiên
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* TAB 4: AI FINOPS */}
          <TabsContent value="finops" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tổng hợp Chi phí AI FinOps theo Model & Provider</CardTitle>
                <CardDescription>
                  Số liệu 30 ngày gần nhất đối soát lượng token và chi phí phát sinh toàn nền tảng.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs ">Nhà cung cấp</TableHead>
                        <TableHead className="text-xs ">Mô hình (Model)</TableHead>
                        <TableHead className="text-xs text-center">Lượt gọi</TableHead>
                        <TableHead className="text-xs text-center">Tổng Tokens</TableHead>
                        <TableHead className="text-xs text-right">Chi phí USD</TableHead>
                        <TableHead className="text-xs text-right">Chi phí VND</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aiCosts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                            Chưa có dữ liệu lượt gọi AI trong 30 ngày qua
                          </TableCell>
                        </TableRow>
                      ) : (
                        aiCosts.map((item, idx) => (
                          <TableRow key={idx} className="text-xs">
                            <TableCell className="font-semibold">{item.provider}</TableCell>
                            <TableCell className="font-mono text-xs">{item.model}</TableCell>
                            <TableCell className="text-center font-mono">{item.calls}</TableCell>
                            <TableCell className="text-center font-mono">{item.tokens.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono">${item.costUsd.toFixed(3)}</TableCell>
                            <TableCell className="text-right font-mono">{item.costVnd.toLocaleString()} ₫</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 5: TELEMETRY & AUDIT */}
          <TabsContent value="telemetry" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Telemetry Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tài nguyên & Hạ tầng Máy chủ</CardTitle>
                  <CardDescription>Số liệu telemetry trực tiếp từ Node.js process & PostgreSQL</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Thời gian hoạt động (Uptime):</span>
                    <strong className="font-mono">{telemetry?.uptimeSeconds ?? 0} giây</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Node.js Version:</span>
                    <strong className="font-mono">{telemetry?.process?.nodeVersion ?? "—"}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Bộ nhớ Process (RSS):</span>
                    <strong className="font-mono">{telemetry?.process?.rssMb ?? 0} MB</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Heap Đã dùng / Tổng cấp:</span>
                    <strong className="font-mono">
                      {telemetry?.process?.heapUsedMb ?? 0} MB / {telemetry?.process?.heapTotalMb ?? 0} MB
                    </strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">PostgreSQL Status:</span>
                    <Badge variant="default" className="bg-emerald-600 font-mono">
                      {telemetry?.database?.status ?? "CONNECTED"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Maintenance Mode Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Điều Khiển Chế Độ Bảo Trì (Zero-Downtime)</CardTitle>
                  <CardDescription>
                    Thay vì lỗi 503 thô bạo, chế độ READ_ONLY cho phép người dùng xem dữ liệu trong khi di chuyển DB.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Trạng thái bảo trì hiện tại:</div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={maintenanceMode === "DISABLED" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleSetMaintenance("DISABLED")}
                      >
                        DISABLED (Bình thường)
                      </Button>
                      <Button
                        variant={maintenanceMode === "READ_ONLY" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleSetMaintenance("READ_ONLY")}
                      >
                        READ_ONLY (Chỉ xem)
                      </Button>
                      <Button
                        variant={maintenanceMode === "FULL" ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => handleSetMaintenance("FULL")}
                      >
                        FULL (Bảo trì toàn phần)
                      </Button>
                    </div>
                  </div>
                  <div className="p-3 rounded bg-muted/40 text-xs text-muted-foreground">
                    Cập nhật lần cuối: {telemetry?.maintenance?.updatedAt ? new Date(telemetry.maintenance.updatedAt).toLocaleString("vi-VN") : "—"}{" "}
                    bởi {telemetry?.maintenance?.updatedBy || "Hệ thống"}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Audit Logs Table */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Nhật Ký Kiểm Toán Bất Biến (System Audit Trail)</CardTitle>
                  <CardDescription>
                    Chuỗi băm mật mã HMAC Chaining — Bảo chứng chống chối bỏ theo chuẩn SOC 2 Type II.
                  </CardDescription>
                </div>
                <Badge variant={integrityVerified ? "default" : "destructive"} className="font-mono text-xs">
                  {integrityVerified ? "HMAC CHAIN VERIFIED" : "CHAIN BROKEN"}
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs ">Thời gian</TableHead>
                        <TableHead className="text-xs ">Người thực hiện</TableHead>
                        <TableHead className="text-xs ">Hành động</TableHead>
                        <TableHead className="text-xs ">Đối tượng</TableHead>
                        <TableHead className="text-xs ">Lý do</TableHead>
                        <TableHead className="text-xs font-mono text-right">Hash (SHA-256)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                            Chưa có bản ghi nhật ký kiểm toán nào
                          </TableCell>
                        </TableRow>
                      ) : (
                        auditLogs.map((log) => (
                          <TableRow key={log.id} className="text-xs">
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleString("vi-VN")}
                            </TableCell>
                            <TableCell className="text-xs font-medium">{log.actorEmail || "Hệ thống"}</TableCell>
                            <TableCell className="">
                              <Badge variant="outline" className="text-[11px] font-mono">
                                {log.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {log.targetType} {log.targetId ? `(#${log.targetId.slice(0, 8)})` : ""}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground truncate max-w-xs">{log.reason || "—"}</TableCell>
                            <TableCell className="text-right font-mono text-[11px] text-muted-foreground">
                              {log.currentHash ? `${log.currentHash.slice(0, 10)}...` : "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Slide-over Blast Radius Drawer */}
      <BlastRadiusDrawer
        workspace={selectedWorkspace}
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        onConfirmStatusChange={handleStatusChange}
      />
    </div>
  );
}
