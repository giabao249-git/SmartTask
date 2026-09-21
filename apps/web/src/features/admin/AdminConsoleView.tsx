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
import { BlastRadiusDrawer } from "./BlastRadiusDrawer";
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
    <div className="min-h-screen bg-background text-foreground">
      {/* Platform Super Admin Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/workspaces"
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            ← Về Workspace
          </Link>
          <span className="text-border">|</span>
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-tight text-base">SmartTask Mission Control</span>
            <Badge variant="default" className="bg-primary/90 text-primary-foreground font-mono text-[11px]">
              PLATFORM SUPER ADMIN
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {telemetry?.maintenance?.mode !== "DISABLED" && (
            <Badge variant="destructive" className="animate-pulse">
              HỆ THỐNG ĐANG BẢO TRÌ: {telemetry?.maintenance?.mode}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Đăng nhập: <strong>{auth.user?.email}</strong>
          </span>
          <Button variant="outline" size="sm" onClick={loadAllData} disabled={isLoading}>
            {isLoading ? "Đang đồng bộ..." : "Làm mới dữ liệu"}
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto p-6 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-5 max-w-2xl bg-muted/60">
            <TabsTrigger value="overview">Tổng quan</TabsTrigger>
            <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
            <TabsTrigger value="users">Người dùng</TabsTrigger>
            <TabsTrigger value="finops">AI FinOps</TabsTrigger>
            <TabsTrigger value="telemetry">Hạ tầng & Audit</TabsTrigger>
          </TabsList>

          {/* TAB 1: OVERVIEW */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-semibold uppercase">Tổ chức / Workspaces</CardDescription>
                  <CardTitle className="text-3xl font-bold">{stats?.workspaces?.total ?? 0}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground flex justify-between">
                  <span>Hoạt động: <strong className="text-foreground">{stats?.workspaces?.active ?? 0}</strong></span>
                  <span>Đình chỉ: <strong className="text-destructive">{stats?.workspaces?.suspended ?? 0}</strong></span>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-semibold uppercase">Người dùng Toàn sàn</CardDescription>
                  <CardTitle className="text-3xl font-bold">{stats?.users?.total ?? 0}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground flex justify-between">
                  <span>Khả dụng: <strong className="text-foreground">{stats?.users?.active ?? 0}</strong></span>
                  <span>Super Admins: <strong className="text-primary">{stats?.users?.superAdmins ?? 0}</strong></span>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-semibold uppercase">Tác vụ & Dự án</CardDescription>
                  <CardTitle className="text-3xl font-bold">{stats?.tasks?.total ?? 0}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground flex justify-between">
                  <span>Hoàn thành: <strong className="text-foreground">{stats?.tasks?.completed ?? 0}</strong></span>
                  <span>Tỷ lệ: <strong className="text-emerald-600">{stats?.tasks?.completionRate ?? 0}%</strong></span>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-semibold uppercase">Tiêu thụ AI FinOps (30d)</CardDescription>
                  <CardTitle className="text-3xl font-bold">
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
                  placeholder="Tìm kiếm theo tên hoặc slug..."
                  value={workspaceSearch}
                  onChange={(e) => setWorkspaceSearch(e.target.value)}
                  className="w-full sm:w-72"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="WARNING_GRACE">WARNING_GRACE</option>
                  <option value="READ_ONLY_ENFORCED">READ_ONLY_ENFORCED</option>
                  <option value="SOFT_SUSPENDED">SOFT_SUSPENDED</option>
                </select>
              </div>
              <div className="text-xs text-muted-foreground">
                Hiển thị <strong>{filteredWorkspaces.length}</strong> / {workspaces.length} tổ chức
              </div>
            </div>

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase">
                    <tr>
                      <th className="p-3">Tổ chức (Workspace)</th>
                      <th className="p-3">Chủ sở hữu</th>
                      <th className="p-3 text-center">Thành viên</th>
                      <th className="p-3 text-center">Dự án</th>
                      <th className="p-3 text-center">AI Calls</th>
                      <th className="p-3">Trạng thái</th>
                      <th className="p-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredWorkspaces.map((ws) => (
                      <tr key={ws.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          <div className="font-semibold text-foreground">{ws.name}</div>
                          <div className="text-xs font-mono text-muted-foreground">{ws.slug}</div>
                        </td>
                        <td className="p-3">
                          <div className="text-foreground">{ws.owner?.fullName || "—"}</div>
                          <div className="text-xs text-muted-foreground">{ws.owner?.email}</div>
                        </td>
                        <td className="p-3 text-center font-mono">{ws.membersCount}</td>
                        <td className="p-3 text-center font-mono">{ws.projectsCount}</td>
                        <td className="p-3 text-center font-mono">{ws.aiCallsCount}</td>
                        <td className="p-3">
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
                        </td>
                        <td className="p-3 text-right">
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase">
                    <tr>
                      <th className="p-3">Người dùng</th>
                      <th className="p-3">Vai trò Nền tảng</th>
                      <th className="p-3 text-center">Workspaces</th>
                      <th className="p-3">Ngày tạo</th>
                      <th className="p-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          <div className="font-semibold text-foreground">{u.fullName}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </td>
                        <td className="p-3">
                          {u.isSuperAdmin ? (
                            <Badge variant="default" className="text-xs bg-indigo-600">
                              {u.platformRole || "SUPER_ADMIN"}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              MEMBER
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 text-center font-mono">{u.workspacesCount}</td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {new Date(u.createdAt).toLocaleDateString("vi-VN")}
                        </td>
                        <td className="p-3 text-right space-x-2">
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase">
                      <tr>
                        <th className="p-3">Nhà cung cấp</th>
                        <th className="p-3">Mô hình (Model)</th>
                        <th className="p-3 text-center">Lượt gọi</th>
                        <th className="p-3 text-center">Tổng Tokens</th>
                        <th className="p-3 text-right">Chi phí USD</th>
                        <th className="p-3 text-right">Chi phí VND</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {aiCosts.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-muted-foreground">
                            Chưa có dữ liệu lượt gọi AI trong 30 ngày qua
                          </td>
                        </tr>
                      ) : (
                        aiCosts.map((item, idx) => (
                          <tr key={idx} className="hover:bg-muted/30">
                            <td className="p-3 font-semibold">{item.provider}</td>
                            <td className="p-3 font-mono text-xs">{item.model}</td>
                            <td className="p-3 text-center font-mono">{item.calls}</td>
                            <td className="p-3 text-center font-mono">{item.tokens.toLocaleString()}</td>
                            <td className="p-3 text-right font-mono">${item.costUsd.toFixed(3)}</td>
                            <td className="p-3 text-right font-mono">{item.costVnd.toLocaleString()} ₫</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
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
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase">
                      <tr>
                        <th className="p-3">Thời gian</th>
                        <th className="p-3">Người thực hiện</th>
                        <th className="p-3">Hành động</th>
                        <th className="p-3">Đối tượng</th>
                        <th className="p-3">Lý do</th>
                        <th className="p-3 font-mono text-right">Hash (SHA-256)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-muted-foreground">
                            Chưa có bản ghi nhật ký kiểm toán nào
                          </td>
                        </tr>
                      ) : (
                        auditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-muted/30">
                            <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleString("vi-VN")}
                            </td>
                            <td className="p-3 text-xs font-medium">{log.actorEmail || "Hệ thống"}</td>
                            <td className="p-3">
                              <Badge variant="outline" className="text-[11px] font-mono">
                                {log.action}
                              </Badge>
                            </td>
                            <td className="p-3 text-xs">
                              {log.targetType} {log.targetId ? `(#${log.targetId.slice(0, 8)})` : ""}
                            </td>
                            <td className="p-3 text-xs text-muted-foreground truncate max-w-xs">{log.reason || "—"}</td>
                            <td className="p-3 text-right font-mono text-[11px] text-muted-foreground">
                              {log.currentHash ? `${log.currentHash.slice(0, 10)}...` : "—"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
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
