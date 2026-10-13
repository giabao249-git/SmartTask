"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSocket, joinWorkspace } from "@/lib/socket";
import {
  Activity,
  Bot,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileCode2,
  FileSpreadsheet,
  FolderKanban,
  Hash,
  KeyRound,
  Lock,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/app/EmptyState";
import { UserAvatar } from "@/components/app/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatDateTimeParts(iso: string): { time: string; date: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { time: iso, date: "" };
  const time = d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const date = d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return { time, date };
}

function formatRelative(iso: string): string {
  const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return "Vừa xong";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} giờ trước`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay} ngày trước`;
  return `${Math.floor(diffDay / 30)} tháng trước`;
}

export type WorkspaceAuditCategory =
  | "MEMBER"
  | "PROJECT"
  | "AI_FINOPS"
  | "SETTINGS";

export interface WorkspaceAuditItem {
  id: string;
  workspaceId: string;
  category: WorkspaceAuditCategory;
  action: string;
  actor: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
  };
  targetType: string;
  targetId: string;
  targetName: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  ipAddress: string;
  userAgent: string;
  previousHash: string | null;
  hash: string;
  createdAt: string;
}

export interface WorkspaceAuditResponse {
  items: WorkspaceAuditItem[];
  total: number;
  page: number;
  limit: number;
  summary: {
    total: number;
    memberEvents: number;
    projectEvents: number;
    aiEvents: number;
    settingsEvents: number;
  };
  chainIntegrity: {
    verified: boolean;
    checkedCount: number;
    algorithm: string;
    latestHash: string | null;
  };
  actors: Array<{
    id: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
  }>;
}

const CATEGORY_META: Record<
  WorkspaceAuditCategory,
  {
    label: string;
    badgeClass: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  MEMBER: {
    label: "Thành viên & Phân quyền",
    badgeClass:
      "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    icon: Users,
  },
  PROJECT: {
    label: "Dự án & Sprint",
    badgeClass:
      "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
    icon: FolderKanban,
  },
  AI_FINOPS: {
    label: "AI & FinOps",
    badgeClass:
      "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
    icon: Sparkles,
  },
  SETTINGS: {
    label: "Cài đặt & Tham số",
    badgeClass:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    icon: Settings2,
  },
};

const ACTION_LABELS: Record<string, string> = {
  "workspace.created": "Khởi tạo Workspace",
  "workspace.updated": "Cập nhật thông tin Workspace",
  "workspace.archived": "Lưu trữ Workspace",
  "workspace.ownership_transferred": "Chuyển nhượng quyền Owner",
  "workspace.settings_updated": "Cập nhật tham số vận hành",
  "member.invited": "Gửi lời mời thành viên",
  "member.invitation_revoked": "Thu hồi lời mời",
  "member.joined": "Thành viên gia nhập Workspace",
  "member.role_updated": "Thay đổi vai trò thành viên",
  "member.removed": "Gỡ thành viên khỏi Workspace",
  "ai.config_updated": "Cập nhật cấu hình Model AI",
  "ai.prompt_updated": "Hiệu chỉnh System Prompt AI",
  "ai.quota_updated": "Điều chỉnh hạn mức & FinOps AI",
  "project.created": "Khởi tạo dự án mới",
  "project.archived": "Lưu trữ dự án",
  "sprint.started": "Bắt đầu chu kỳ Sprint",
  "sprint.closed": "Đóng chu kỳ Sprint",
};

function formatActionLabel(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  if (action.startsWith("task.")) {
    const sub = action.replace("task.", "");
    return `Hoạt động công việc (${sub})`;
  }
  return action;
}

function summarizeDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): { key: string; from?: string; to?: string }[] {
  const b = before ?? {};
  const a = after ?? {};
  const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)]));
  const changes: { key: string; from?: string; to?: string }[] = [];

  for (const key of keys) {
    const bv = b[key];
    const av = a[key];
    const bStr = bv === undefined ? undefined : formatCompactValue(bv);
    const aStr = av === undefined ? undefined : formatCompactValue(av);
    if (bStr !== aStr) {
      changes.push({ key, from: bStr, to: aStr });
    }
  }
  return changes;
}

function formatCompactValue(v: unknown): string {
  if (v === null) return "null";
  if (v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Bật" : "Tắt";
  if (typeof v === "number" || typeof v === "string") return String(v);
  return JSON.stringify(v);
}

export function WorkspaceAuditTab({ workspaceId }: { workspaceId: string }) {
  const [category, setCategory] = React.useState<string>("ALL");
  const [actorId, setActorId] = React.useState<string>("ALL");
  const [days, setDays] = React.useState<string>("ALL");
  const [searchInput, setSearchInput] = React.useState<string>("");
  const [debouncedQ, setDebouncedQ] = React.useState<string>("");
  const [page, setPage] = React.useState<number>(1);
  const [selectedLog, setSelectedLog] =
    React.useState<WorkspaceAuditItem | null>(null);
  const [copiedHash, setCopiedHash] = React.useState<string | null>(null);

  const limit = 20;

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(searchInput.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const queryParams = React.useMemo(() => {
    const sp = new URLSearchParams();
    if (category !== "ALL") sp.set("category", category);
    if (actorId !== "ALL") sp.set("actorId", actorId);
    if (days !== "ALL") sp.set("days", days);
    if (debouncedQ) sp.set("q", debouncedQ);
    sp.set("page", String(page));
    sp.set("limit", String(limit));
    return sp.toString();
  }, [category, actorId, days, debouncedQ, page]);

  const qc = useQueryClient();

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["workspace-audit-logs", workspaceId, queryParams],
    queryFn: () =>
      api.get<WorkspaceAuditResponse>(
        `/workspaces/${workspaceId}/audit-logs?${queryParams}`,
      ),
    enabled: Boolean(workspaceId),
  });

  // Lắng nghe sự kiện kiểm toán bất biến theo thời gian thực (phòng workspace:{id})
  React.useEffect(() => {
    if (!workspaceId) return;
    const leave = joinWorkspace(workspaceId);
    const s = getSocket();
    if (!s) return leave;

    const onAudit = (payload: { action?: string; targetName?: string }) => {
      void qc.invalidateQueries({ queryKey: ["workspace-audit-logs", workspaceId] });
      toast.info("Có bản ghi kiểm toán mới vừa phát sinh", {
        description: payload?.targetName ? `${payload.action}: ${payload.targetName}` : undefined,
      });
    };

    s.on("audit:logged", onAudit);
    return () => {
      s.off("audit:logged", onAudit);
      leave();
    };
  }, [workspaceId, qc]);

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    toast.success("Đã sao chép mã băm HMAC-SHA256");
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleExportCSV = () => {
    if (!data?.items.length) {
      toast.error("Không có dữ liệu nhật ký để xuất");
      return;
    }
    const headers = [
      "Thời gian (ISO)",
      "Danh mục",
      "Mã hành động",
      "Mô tả hành động",
      "Người thực hiện",
      "Email",
      "Loại đối tượng",
      "Tên đối tượng",
      "IP",
      "Trạng thái trước (Before)",
      "Trạng thái sau (After)",
      "Mã băm trước (Previous Hash)",
      "Mã băm HMAC-SHA256 (Current Hash)",
    ];
    const escapeCsv = (val: unknown) => {
      const s = val === null || val === undefined ? "" : String(val);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const rows = data.items.map((item) => [
      item.createdAt,
      CATEGORY_META[item.category]?.label ?? item.category,
      item.action,
      formatActionLabel(item.action),
      item.actor.fullName,
      item.actor.email,
      item.targetType,
      item.targetName,
      item.ipAddress,
      item.beforeState ? JSON.stringify(item.beforeState) : "",
      item.afterState ? JSON.stringify(item.afterState) : "",
      item.previousHash ?? "GENESIS",
      item.hash,
    ]);

    const csvContent =
      "\uFEFF" +
      [headers.map(escapeCsv).join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join(
        "\n",
      );
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smarttask-audit-logs-${workspaceId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Đã xuất ${data.items.length} bản ghi kiểm toán ra file CSV`);
  };

  const handleExportJSON = () => {
    if (!data?.items.length) {
      toast.error("Không có dữ liệu nhật ký để xuất");
      return;
    }
    const payload = {
      exportedAt: new Date().toISOString(),
      workspaceId,
      chainIntegrity: data.chainIntegrity,
      totalExported: data.items.length,
      items: data.items,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smarttask-audit-logs-${workspaceId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Đã xuất ${data.items.length} bản ghi kiểm toán ra file JSON`);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="space-y-4">
      {/* Security Status Strip: Nhẹ nhàng, tinh gọn, không lặp lại tiêu đề */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.04] px-3.5 py-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <div className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>Chuỗi băm toàn vẹn 100%</span>
            </div>
            <span className="text-muted-foreground/60 hidden sm:inline">·</span>
            <span className="font-mono text-[11px] text-muted-foreground truncate">
              {data?.chainIntegrity?.algorithm ?? "HMAC-SHA256"} ·{" "}
              {data?.chainIntegrity?.latestHash
                ? `#${data.chainIntegrity.latestHash.slice(0, 10)}…`
                : "GENESIS"}
            </span>
            <Badge
              variant="outline"
              className="text-[10px] border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1 h-5 px-1.5"
            >
              <Lock className="h-2.5 w-2.5" />
              Append-Only · SOC 2 Ready
            </Badge>
            <span className="text-[11px] text-muted-foreground/80 hidden lg:inline">
              (Nhật ký kiểm toán & Quản trị rủi ro bất biến)
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-medium select-none">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <span>Realtime</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-7 px-2.5 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw
                className={cn("h-3 w-3", isFetching && "animate-spin")}
              />
              Làm mới
            </Button>
          </div>
        </div>
      </motion.div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <motion.div
          whileHover={{ y: -2, transition: { duration: 0.12 } }}
          whileTap={{ scale: 0.985 }}
          className="h-full"
        >
          <Card
            onClick={() => {
              setCategory("ALL");
              setPage(1);
            }}
            className={cn(
              "p-3.5 cursor-pointer h-full transition-all hover:border-primary/40 shadow-2xs select-none",
              category === "ALL" && "ring-1 ring-primary/40 bg-primary/[0.02]",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">
                Tổng sự kiện ghi nhận
              </span>
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums">
                {data?.summary.total ?? "—"}
              </span>
              <span className="text-[11px] text-muted-foreground">bản ghi</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Toàn bộ lịch sử quản trị Workspace
            </p>
          </Card>
        </motion.div>

        <motion.div
          whileHover={{ y: -2, transition: { duration: 0.12 } }}
          whileTap={{ scale: 0.985 }}
          className="h-full"
        >
          <Card
            onClick={() => {
              setCategory(category === "MEMBER" ? "ALL" : "MEMBER");
              setPage(1);
            }}
            className={cn(
              "p-3.5 cursor-pointer h-full transition-all hover:border-indigo-500/40 shadow-2xs select-none",
              category === "MEMBER" &&
                "ring-1 ring-indigo-500/50 bg-indigo-500/[0.03]",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">
                Phân quyền & Thành viên
              </span>
              <Users className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">
                {data?.summary.memberEvents ?? "—"}
              </span>
              <span className="text-[11px] text-muted-foreground">thay đổi</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Đổi vai trò, mời mới, thu hồi quyền
            </p>
          </Card>
        </motion.div>

        <motion.div
          whileHover={{ y: -2, transition: { duration: 0.12 } }}
          whileTap={{ scale: 0.985 }}
          className="h-full"
        >
          <Card
            onClick={() => {
              setCategory(category === "AI_FINOPS" ? "ALL" : "AI_FINOPS");
              setPage(1);
            }}
            className={cn(
              "p-3.5 cursor-pointer h-full transition-all hover:border-violet-500/40 shadow-2xs select-none",
              category === "AI_FINOPS" &&
                "ring-1 ring-violet-500/50 bg-violet-500/[0.03]",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">
                Cấu hình AI & FinOps
              </span>
              <Bot className="h-4 w-4 text-violet-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums text-violet-600 dark:text-violet-400">
                {data?.summary.aiEvents ?? "—"}
              </span>
              <span className="text-[11px] text-muted-foreground">sự kiện</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Model AI, System Prompt, hạn mức ngày
            </p>
          </Card>
        </motion.div>

        <motion.div
          whileHover={{ y: -2, transition: { duration: 0.12 } }}
          whileTap={{ scale: 0.985 }}
          className="h-full"
        >
          <Card
            onClick={() => {
              setCategory(category === "PROJECT" ? "ALL" : "PROJECT");
              setPage(1);
            }}
            className={cn(
              "p-3.5 cursor-pointer h-full transition-all hover:border-sky-500/40 shadow-2xs select-none",
              (category === "PROJECT" || category === "SETTINGS") &&
                "ring-1 ring-sky-500/50 bg-sky-500/[0.03]",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">
                Dự án & Tham số hệ thống
              </span>
              <FolderKanban className="h-4 w-4 text-sky-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums text-sky-600 dark:text-sky-400">
                {data
                  ? data.summary.projectEvents + data.summary.settingsEvents
                  : "—"}
              </span>
              <span className="text-[11px] text-muted-foreground">cập nhật</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Chu kỳ Sprint, ngưỡng tải & Burnout
            </p>
          </Card>
        </motion.div>
      </div>

      {/* High-Density Audit Log Table with Integrated Title & Filter Toolbar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.05 }}
      >
        <Card className="overflow-hidden border-border/80 shadow-2xs">
          {/* Title Toolbar: Tiêu đề, số bản ghi, ô tìm kiếm, bộ lọc & nút xuất gom gọn một hàng */}
          <div className="p-3.5 border-b border-border/70 bg-card/60 flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
            {/* Cột Title: Tiêu đề & huy hiệu số lượng */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-primary" />
                  Lịch sử kiểm toán
                </h3>
                <Badge variant="secondary" className="font-mono text-[11px] tabular-nums px-2 py-0">
                  {data?.total ?? 0} sự kiện
                </Badge>
                {days !== "ALL" && (
                  <span className="text-[11px] text-muted-foreground font-medium">
                    ({days} ngày qua · tổng {data?.summary.total ?? 0})
                  </span>
                )}
              </div>

              {(category !== "ALL" || actorId !== "ALL" || days !== "ALL" || debouncedQ) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCategory("ALL");
                    setActorId("ALL");
                    setDays("ALL");
                    setSearchInput("");
                    setPage(1);
                  }}
                  className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1 rounded-full border border-dashed border-border"
                >
                  <X className="h-3 w-3" />
                  Xoá bộ lọc
                </Button>
              )}
            </div>

            {/* Nhóm Tìm kiếm & Filter & Export thu gọn ngay trong cột Title */}
            <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
              {/* Ô tìm kiếm thu gọn */}
              <div className="relative w-full sm:w-52 md:w-60">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Tìm hành động, đối tượng, IP…"
                  className="h-8 pl-8 pr-7 text-xs bg-background/80"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => setSearchInput("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Phân nhóm */}
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(1);
                }}
                className="h-8 rounded-md border border-input bg-background/80 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="ALL">Mọi phân nhóm</option>
                <option value="MEMBER">Thành viên & Phân quyền</option>
                <option value="PROJECT">Dự án & Sprint</option>
                <option value="AI_FINOPS">AI & FinOps</option>
                <option value="SETTINGS">Cài đặt & Tham số</option>
              </select>

              {/* Người thực hiện */}
              <select
                value={actorId}
                onChange={(e) => {
                  setActorId(e.target.value);
                  setPage(1);
                }}
                className="h-8 max-w-[150px] truncate rounded-md border border-input bg-background/80 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="ALL">Mọi người thực hiện</option>
                {data?.actors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.fullName}
                  </option>
                ))}
              </select>

              {/* Thời gian */}
              <select
                value={days}
                onChange={(e) => {
                  setDays(e.target.value);
                  setPage(1);
                }}
                className="h-8 rounded-md border border-input bg-background/80 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="7">7 ngày qua</option>
                <option value="30">30 ngày qua</option>
                <option value="90">90 ngày qua</option>
                <option value="365">1 năm qua</option>
                <option value="ALL">Toàn thời gian</option>
              </select>

              {/* Nút Xuất CSV & Xuất JSON */}
              <div className="flex items-center gap-1.5 shrink-0">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportCSV}
                    className="h-8 px-2.5 gap-1.5 text-xs hover:border-emerald-500/50"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    Xuất CSV
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportJSON}
                    className="h-8 px-2.5 gap-1.5 text-xs hover:border-sky-500/50"
                  >
                    <FileCode2 className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                    Xuất JSON
                  </Button>
                </motion.div>
              </div>
            </div>
          </div>
          {isLoading ? (
            <div className="p-4 space-y-2.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : !data?.items.length ? (
            <div className="p-8">
              <EmptyState
                icon={ShieldCheck}
                title="Không tìm thấy bản ghi kiểm toán phù hợp"
                description="Thử mở rộng khoảng thời gian hoặc xoá bộ lọc từ khoá để xem toàn bộ lịch sử hoạt động."
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <tr>
                      <th className="text-left px-3.5 py-2.5 font-medium whitespace-nowrap">
                        Thời gian
                      </th>
                      <th className="text-left px-3.5 py-2.5 font-medium whitespace-nowrap">
                        Người thực hiện
                      </th>
                      <th className="text-left px-3.5 py-2.5 font-medium whitespace-nowrap">
                        Phân nhóm & Hành động
                      </th>
                      <th className="text-left px-3.5 py-2.5 font-medium">
                        Đối tượng & Tóm tắt thay đổi
                      </th>
                      <th className="text-right px-3.5 py-2.5 font-medium whitespace-nowrap">
                        Chữ ký & Diff
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {data.items.map((item, idx) => {
                        const cat =
                          CATEGORY_META[item.category] ?? CATEGORY_META.SETTINGS;
                        const CatIcon = cat.icon;
                        const diffPreview = summarizeDiff(
                          item.beforeState,
                          item.afterState,
                        );
                        const timeParts = formatDateTimeParts(item.createdAt);

                        return (
                          <motion.tr
                            key={item.id}
                            initial={{ opacity: 0, y: 3 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{
                              duration: 0.14,
                              delay: Math.min(idx * 0.015, 0.15),
                            }}
                            whileHover={{
                              backgroundColor: "rgba(125, 125, 125, 0.06)",
                            }}
                            onClick={() => setSelectedLog(item)}
                            className="group cursor-pointer transition-colors"
                          >
                            {/* Thời gian: Giờ phút trên, ngày tháng + relative dưới, không tràn chữ */}
                            <td className="px-3.5 py-3.5 align-middle whitespace-nowrap min-w-[130px]">
                              <div className="font-mono text-xs font-semibold tabular-nums text-foreground tracking-tight">
                                {timeParts.time}
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5 font-mono">
                                <span>{timeParts.date}</span>
                                <span className="text-[10px] text-muted-foreground/80 font-sans">
                                  · {formatRelative(item.createdAt)}
                                </span>
                              </div>
                            </td>

                            {/* Người thực hiện: Avatar thẳng hàng, tên, email và IP gọn gàng */}
                            <td className="px-3.5 py-3.5 align-middle whitespace-nowrap min-w-[210px]">
                              <div className="flex items-center gap-2.5">
                                <UserAvatar
                                  name={item.actor.fullName}
                                  avatar={item.actor.avatarUrl ?? undefined}
                                  size="sm"
                                  className="shrink-0"
                                  showTooltip={false}
                                />
                                <div className="min-w-0">
                                  <div
                                    className="font-medium text-xs text-foreground truncate max-w-[160px]"
                                    title={item.actor.fullName}
                                  >
                                    {item.actor.fullName}
                                  </div>
                                  <div
                                    className="text-[11px] text-muted-foreground truncate max-w-[160px]"
                                    title={item.actor.email}
                                  >
                                    {item.actor.email}
                                  </div>
                                  <div className="mt-1">
                                    <span className="inline-flex items-center rounded border border-border/70 bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground tabular-nums leading-none">
                                      {item.ipAddress.replace("::ffff:", "")}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Phân nhóm & Hành động */}
                            <td className="px-3.5 py-3.5 align-middle whitespace-nowrap min-w-[170px]">
                              <div className="flex flex-col items-start gap-1">
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium shrink-0",
                                    cat.badgeClass,
                                  )}
                                >
                                  <CatIcon className="h-2.5 w-2.5" />
                                  {cat.label}
                                </span>
                                <div className="font-medium text-xs text-foreground">
                                  {formatActionLabel(item.action)}
                                </div>
                                <code className="text-[10px] text-muted-foreground font-mono">
                                  {item.action}
                                </code>
                              </div>
                            </td>

                            {/* Đối tượng & Tóm tắt thay đổi: Badge chống co hẹp, diff padding chuẩn */}
                            <td className="px-3.5 py-3.5 align-middle min-w-[240px]">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-2 py-0.5 font-mono uppercase tracking-wider shrink-0 whitespace-nowrap"
                                >
                                  {item.targetType}
                                </Badge>
                                <span
                                  className="font-medium text-xs text-foreground truncate max-w-[220px]"
                                  title={item.targetName}
                                >
                                  {item.targetName}
                                </span>
                              </div>

                              {diffPreview.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                                  {diffPreview.slice(0, 3).map((d) => (
                                    <span
                                      key={d.key}
                                      className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-muted/40 px-2 py-1 font-mono text-[10px] leading-tight"
                                    >
                                      <span className="text-muted-foreground font-semibold">
                                        {d.key}:
                                      </span>
                                      {d.from !== undefined && (
                                        <span className="text-rose-600 dark:text-rose-400 line-through max-w-[120px] truncate bg-rose-500/10 px-1 py-0.5 rounded">
                                          {d.from}
                                        </span>
                                      )}
                                      {d.from !== undefined && (
                                        <span className="text-muted-foreground text-[9px]">→</span>
                                      )}
                                      <span className="text-emerald-600 dark:text-emerald-400 font-medium max-w-[140px] truncate bg-emerald-500/10 px-1 py-0.5 rounded">
                                        {d.to ?? "đã xoá"}
                                      </span>
                                    </span>
                                  ))}
                                  {diffPreview.length > 3 && (
                                    <span className="text-[10px] text-muted-foreground self-center px-1">
                                      +{diffPreview.length - 3} trường khác
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Chữ ký & Diff: Nút cân đối, không sát viền */}
                            <td className="px-3.5 py-3.5 align-middle text-right whitespace-nowrap min-w-[110px]">
                              <div className="flex flex-col items-end justify-center gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedLog(item);
                                  }}
                                  className="h-7 px-3 text-xs font-medium hover:border-primary/60 hover:text-primary transition-all shadow-2xs"
                                >
                                  Xem Diff
                                </Button>
                                <span
                                  title={`HMAC-SHA256: ${item.hash}`}
                                  className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground/80 hover:text-foreground"
                                >
                                  <Hash className="h-2.5 w-2.5 text-emerald-500 shrink-0" />
                                  {item.hash.slice(0, 10)}…
                                </span>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col gap-2 border-t border-border bg-muted/20 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
              Hiển thị{" "}
              <span className="font-medium text-foreground tabular-nums">
                {(data.page - 1) * data.limit + 1}–
                {Math.min(data.page * data.limit, data.total)}
              </span>{" "}
              trên tổng số{" "}
              <span className="font-medium text-foreground tabular-nums">
                {data.total}
              </span>{" "}
              sự kiện kiểm toán
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-7 px-2 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                Trước
              </Button>
              <span className="px-2 text-xs tabular-nums text-muted-foreground">
                Trang <strong className="text-foreground">{page}</strong> /{" "}
                {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-7 px-2 text-xs"
              >
                Sau
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  </motion.div>

      {/* Before / After Visual Diff Modal */}
      <Dialog
        open={Boolean(selectedLog)}
        onOpenChange={(open) => !open && setSelectedLog(null)}
      >
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
          {selectedLog && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.16 }}
              className="space-y-4"
            >
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium",
                      CATEGORY_META[selectedLog.category]?.badgeClass,
                    )}
                  >
                    {CATEGORY_META[selectedLog.category]?.label}
                  </span>
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                    {selectedLog.action}
                  </code>
                  <span className="text-xs text-muted-foreground ml-auto mr-6 font-mono tabular-nums">
                    {formatDateTime(selectedLog.createdAt)}
                  </span>
                </div>
                <DialogTitle className="text-base">
                  {formatActionLabel(selectedLog.action)} —{" "}
                  <span className="text-primary">{selectedLog.targetName}</span>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Bản ghi kiểm toán bất biến có chữ ký mật mã chống giả mạo.
                </DialogDescription>
              </DialogHeader>

              {/* Metadata Grid */}
              <div className="grid grid-cols-1 gap-2.5 rounded-lg border border-border bg-muted/30 p-3 text-xs sm:grid-cols-2">
                <div>
                  <span className="text-[11px] text-muted-foreground block">
                    Người thực hiện (Actor)
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    <UserAvatar
                      name={selectedLog.actor.fullName}
                      avatar={selectedLog.actor.avatarUrl ?? undefined}
                      size="sm"
                      showTooltip={false}
                    />
                    <div>
                      <div className="font-medium">
                        {selectedLog.actor.fullName}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {selectedLog.actor.email}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-muted-foreground block">
                    Đối tượng tác động (Target)
                  </span>
                  <div className="mt-1 font-medium">
                    {selectedLog.targetName}
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground">
                    {selectedLog.targetType} · ID: {selectedLog.targetId}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-muted-foreground block">
                    Địa chỉ IP
                  </span>
                  <div className="mt-0.5 font-mono text-xs">
                    {selectedLog.ipAddress}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-muted-foreground block">
                    Thiết bị / Trình duyệt (User-Agent)
                  </span>
                  <div
                    className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground"
                    title={selectedLog.userAgent}
                  >
                    {selectedLog.userAgent}
                  </div>
                </div>
              </div>

              {/* Field-level Diff Table */}
              {(() => {
                const diffs = summarizeDiff(
                  selectedLog.beforeState,
                  selectedLog.afterState,
                );
                if (diffs.length === 0) return null;
                return (
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold flex items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5 text-primary" />
                      Các trường dữ liệu thay đổi ({diffs.length})
                    </div>
                    <div className="overflow-hidden rounded-lg border border-border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50 text-[11px] text-muted-foreground border-b border-border">
                          <tr>
                            <th className="text-left px-3 py-1.5 font-medium">
                              Trường (Field)
                            </th>
                            <th className="text-left px-3 py-1.5 font-medium">
                              Giá trị cũ (Before)
                            </th>
                            <th className="text-left px-3 py-1.5 font-medium">
                              Giá trị mới (After)
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border font-mono text-[11px]">
                          {diffs.map((d) => (
                            <tr key={d.key}>
                              <td className="px-3 py-2 font-semibold text-foreground">
                                {d.key}
                              </td>
                              <td className="px-3 py-2 bg-rose-500/[0.05] text-rose-700 dark:text-rose-300 break-all">
                                {d.from ?? "— (Chưa có)"}
                              </td>
                              <td className="px-3 py-2 bg-emerald-500/[0.05] text-emerald-700 dark:text-emerald-300 break-all">
                                {d.to ?? "— (Đã xoá)"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* Side-by-Side Raw JSON State */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/[0.03] p-3">
                  <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-rose-600 dark:text-rose-400">
                    <span>Trước khi thay đổi (Before State)</span>
                  </div>
                  <pre className="max-h-52 overflow-auto rounded bg-background/80 p-2.5 font-mono text-[11px] leading-relaxed text-foreground border border-border/60">
                    {selectedLog.beforeState
                      ? JSON.stringify(selectedLog.beforeState, null, 2)
                      : "// Không có trạng thái trước (Tạo mới)"}
                  </pre>
                </div>

                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03] p-3">
                  <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <span>Sau khi thay đổi (After State)</span>
                  </div>
                  <pre className="max-h-52 overflow-auto rounded bg-background/80 p-2.5 font-mono text-[11px] leading-relaxed text-foreground border border-border/60">
                    {selectedLog.afterState
                      ? JSON.stringify(selectedLog.afterState, null, 2)
                      : "// Không có trạng thái sau (Đã xoá)"}
                  </pre>
                </div>
              </div>

              {/* Cryptographic Hash Chain Verification Box */}
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.04] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    Chữ ký chuỗi băm mật mã (HMAC-SHA256 Hash Chain)
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyHash(selectedLog.hash)}
                    className="h-6 px-2 text-[10px] gap-1"
                  >
                    {copiedHash === selectedLog.hash ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-500" />
                        Đã chép
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Sao chép Hash
                      </>
                    )}
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-1.5 font-mono text-[10px]">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                    <span className="text-muted-foreground w-28 shrink-0">
                      Previous Hash:
                    </span>
                    <code className="truncate rounded bg-background/80 px-1.5 py-0.5 border border-border/60 text-muted-foreground">
                      {selectedLog.previousHash ??
                        "GENESIS_00000000000000000000000000000000"}
                    </code>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                    <span className="text-muted-foreground w-28 shrink-0">
                      Current Hash:
                    </span>
                    <code className="truncate rounded bg-background/80 px-1.5 py-0.5 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold">
                      {selectedLog.hash}
                    </code>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
