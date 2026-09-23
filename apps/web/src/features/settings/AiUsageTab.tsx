"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Calendar,
  Coins,
  Cpu,
  RefreshCw,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { AiCallLogTable } from "./AiCallLogTable";
import type { AiPurpose, AiUsageReport } from "@/lib/types";

const PURPOSE_META: Record<AiPurpose, { label: string; badge: string }> = {
  GENERAL: { label: "Tổng hợp chung", badge: "border-slate-500/30 text-slate-700 bg-slate-500/10" },
  DECOMPOSE: { label: "Phân rã yêu cầu", badge: "border-purple-500/30 text-purple-700 bg-purple-500/10" },
  ASSIGN: { label: "Gợi ý phân công", badge: "border-blue-500/30 text-blue-700 bg-blue-500/10" },
  EXPLAIN: { label: "Giải thích quyết định", badge: "border-amber-500/30 text-amber-700 bg-amber-500/10" },
  CHAT: { label: "Hội thoại Trợ lý", badge: "border-emerald-500/30 text-emerald-700 bg-emerald-500/10" },
};


/** Không bịa số: chưa có lượt gọi nào thì mọi ô là 0 và bảng hiện trạng thái trống. */
const EMPTY_REPORT: AiUsageReport = {
  from: "",
  to: "",
  groupBy: "day",
  usdVnd: 26263,
  rows: [],
  totals: { calls: 0, tokens: 0, cachedTokens: 0, costUsd: 0, costVnd: 0, errors: 0, errorRate: 0, durationMs: 0, avgMs: 0 },
};

export function AiUsageTab({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const [groupBy, setGroupBy] = React.useState<"day" | "purpose" | "user">("day");
  const [timeRange, setTimeRange] = React.useState<"7d" | "30d" | "all">("30d");

  const usageQuery = useQuery({
    queryKey: ["workspaces", workspaceId, "ai-usage", groupBy, timeRange],
    queryFn: () => {
      const to = new Date().toISOString().slice(0, 10);
      const daysAgo = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
      const from = new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
      return api.get<AiUsageReport>(`/workspaces/${workspaceId}/ai-usage`, { groupBy, from, to });
    },
  });

  const report = usageQuery.data ?? EMPTY_REPORT;
  const totals = report.totals;

  // Cached savings calculation
  const cachedSavingsPct =
    totals.tokens > 0 ? Math.round((totals.cachedTokens / totals.tokens) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Calls */}
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Lượt gọi AI (Requests)</p>
            <p className="text-2xl font-bold mt-1">{totals.calls.toLocaleString()}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Độ trễ TB: <span className="font-semibold text-foreground">{totals.avgMs}ms</span>
            </p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Activity className="h-5 w-5" />
          </div>
        </Card>

        {/* Total Tokens */}
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Tổng Tokens Tiêu Thụ</p>
            <p className="text-2xl font-bold mt-1">{(totals.tokens / 1000).toFixed(1)}k</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Cached: <span className="font-semibold text-emerald-600">{(totals.cachedTokens / 1000).toFixed(1)}k</span>
            </p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600">
            <Cpu className="h-5 w-5" />
          </div>
        </Card>

        {/* Cache Savings */}
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Tỷ lệ Prompt Cache</p>
            <p className="text-2xl font-bold mt-1 text-emerald-600">~{cachedSavingsPct}%</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Tiết kiệm ~{(cachedSavingsPct * 0.75).toFixed(0)}% chi phí input
            </p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            <Zap className="h-5 w-5" />
          </div>
        </Card>

        {/* Estimated Cost */}
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Ước tính Chi phí</p>
            <p className="text-2xl font-bold mt-1 font-mono">${totals.costUsd.toFixed(4)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              ~ <span className="font-semibold text-foreground">{totals.costVnd.toLocaleString()} ₫</span>
            </p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
            <Coins className="h-5 w-5" />
          </div>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Sổ Nhật Ký Token & Kiểm Toán Chi Phí (UC-32, UC-40)
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Theo dõi chi tiết số lượt gọi, token tiêu thụ, tỷ lệ cache và chi phí quy đổi USD/VND theo từng tiêu chí.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void qc.invalidateQueries({ queryKey: ["workspaces", workspaceId, "ai-usage"] })}
              className="h-8 text-xs gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Làm mới
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/40 rounded-lg">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground font-medium">Phân nhóm:</span>
                <Select value={groupBy} onValueChange={(val: "day" | "purpose" | "user") => setGroupBy(val)}>
                  <SelectTrigger className="h-8 text-xs w-[170px] bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day" className="text-xs">Theo ngày (Day)</SelectItem>
                    <SelectItem value="purpose" className="text-xs">Theo mục đích AI</SelectItem>
                    <SelectItem value="user" className="text-xs">Theo thành viên</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground font-medium">Thời gian:</span>
                <Select value={timeRange} onValueChange={(val: "7d" | "30d" | "all") => setTimeRange(val)}>
                  <SelectTrigger className="h-8 text-xs w-[140px] bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d" className="text-xs">7 ngày qua</SelectItem>
                    <SelectItem value="30d" className="text-xs">30 ngày qua</SelectItem>
                    <SelectItem value="all" className="text-xs">Toàn thời gian</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <span>Tỷ giá tính toán:</span>
              <Badge variant="outline" className="font-mono text-xs">
                1 USD = {report.usdVnd.toLocaleString()} VND
              </Badge>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-semibold">
                    {groupBy === "day"
                      ? "Thời gian"
                      : groupBy === "purpose"
                      ? "Mục đích AI"
                      : "Thành viên / Người dùng"}
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-right">Lượt gọi</TableHead>
                  <TableHead className="text-xs font-semibold">Tổng Token & Cache</TableHead>
                  <TableHead className="text-xs font-semibold">Phân bổ Token (Vào / Cache / Ra)</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Chi phí (USD / VND)</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Độ trễ TB & Lỗi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-xs text-muted-foreground">
                      Chưa có dữ liệu gọi AI trong khoảng thời gian này.
                    </TableCell>
                  </TableRow>
                ) : (
                  report.rows.map((row) => {
                    const cachePct = row.inputTokens > 0 ? Math.round((row.cachedTokens / row.inputTokens) * 100) : 0;
                    return (
                      <TableRow key={row.key} className="hover:bg-muted/30">
                        {/* Group Key / Label */}
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            {groupBy === "day" && <Calendar className="h-3.5 w-3.5 text-muted-foreground" />}
                            {groupBy === "purpose" && (
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 font-medium ${
                                  PURPOSE_META[row.key as AiPurpose]?.badge ?? ""
                                }`}
                              >
                                {row.key}
                              </Badge>
                            )}
                            {groupBy === "user" && <User className="h-3.5 w-3.5 text-muted-foreground" />}
                            <span className="font-semibold text-xs text-foreground">{row.label}</span>
                          </div>
                        </TableCell>

                        {/* Calls */}
                        <TableCell className="py-3 text-right">
                          <span className="font-mono text-xs font-medium">{row.calls.toLocaleString()}</span>
                        </TableCell>

                        {/* Total Tokens & Cache percentage */}
                        <TableCell className="py-3">
                          <div className="space-y-1 max-w-[180px]">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-mono font-semibold">{row.tokens.toLocaleString()}</span>
                              <span className="text-[10px] text-emerald-600 font-medium">{cachePct}% cached</span>
                            </div>
                            {/* Simple Mini Visual Bar */}
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${Math.min(100, cachePct)}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>

                        {/* Token Breakdown (In / Cache / Out) */}
                        <TableCell className="py-3">
                          <div className="flex flex-col text-[11px] gap-0.5">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <span>In:</span>
                              <span className="font-mono font-medium text-foreground">
                                {row.inputTokens.toLocaleString()}
                              </span>
                              <span>·</span>
                              <span className="text-emerald-600 font-medium">Cache: {row.cachedTokens.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <span>Out:</span>
                              <span className="font-mono font-medium text-foreground">
                                {row.outputTokens.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Cost */}
                        <TableCell className="py-3 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-mono text-xs font-semibold text-foreground">
                              ${row.costUsd.toFixed(4)}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              {row.costVnd.toLocaleString()} ₫
                            </span>
                          </div>
                        </TableCell>

                        {/* Latency & Errors */}
                        <TableCell className="py-3 text-right">
                          <div className="flex flex-col items-end text-xs">
                            <span className="font-mono">{row.avgMs} ms</span>
                            {row.errors > 0 ? (
                              <span className="text-[10px] text-destructive font-medium">
                                {row.errors} lỗi ({(row.errorRate * 100).toFixed(1)}%)
                              </span>
                            ) : (
                              <span className="text-[10px] text-emerald-600 font-medium">0 lỗi</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Nhật ký từng lượt gọi */}
          <AiCallLogTable workspaceId={workspaceId} />

          {/* Audit Rule Explanations */}
          <div className="p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground flex items-start gap-2.5">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Kiểm toán chi phí & Tối ưu hóa Token theo thiết kế TableCalendar / ELPREP</p>
              <p className="mt-0.5">
                Chi phí ước tính được lưu trữ trực tiếp vào bản ghi <code className="font-mono">ai_token_logs</code> tại thời điểm gọi,
                dựa trên bảng giá model có hiệu lực. Khi Prompt Caching hoạt động (với các prompt hệ thống lớn hơn 8.000 ký tự), các token
                nằm trong cache được tính phí giảm tới 75% so với giá input thông thường.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
