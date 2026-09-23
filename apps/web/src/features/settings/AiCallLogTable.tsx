"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ListOrdered } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { api, describeError } from "@/lib/api";
import type { AiCallLogPage } from "@/lib/types";
import type { BadgeVariant } from "@/lib/status";

const PURPOSES = ["GENERAL", "DECOMPOSE", "ASSIGN", "EXPLAIN", "CHAT"] as const;
const STATUSES = ["SUCCESS", "ERROR", "INVALID_OUTPUT", "QUOTA", "TIMEOUT"] as const;
const statusVariant = (s: string): BadgeVariant =>
  s === "SUCCESS" ? "success" : s === "QUOTA" ? "warning" : "destructive";

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

/** Nhật ký TỪNG lượt gọi AI (GET /workspaces/:id/ai-usage/calls) — bổ sung cho sổ gộp theo ngày/mục đích/người. */
export function AiCallLogTable({ workspaceId }: { workspaceId: string }) {
  const [page, setPage] = React.useState(1);
  const [purpose, setPurpose] = React.useState("__all");
  const [status, setStatus] = React.useState("__all");
  const limit = 20;

  const q = useQuery({
    queryKey: ["workspaces", workspaceId, "ai-usage-calls", page, purpose, status],
    queryFn: () =>
      api.get<AiCallLogPage>(`/workspaces/${workspaceId}/ai-usage/calls`, {
        page,
        limit,
        purpose: purpose !== "__all" ? purpose : undefined,
        status: status !== "__all" ? status : undefined,
      }),
  });
  React.useEffect(() => setPage(1), [purpose, status]);

  const data = q.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <Card className="border-border/80">
      <CardHeader className="p-4 pb-2 flex-row items-start justify-between space-y-0 gap-2 flex-wrap">
        <div>
          <CardTitle className="text-sm flex items-center gap-2">
            <ListOrdered className="h-4 w-4" /> Từng lượt gọi{data ? ` (${data.total})` : ""}
          </CardTitle>
          <CardDescription className="text-xs">
            Mỗi dòng là một lần gọi nhà cung cấp: ai gọi, mục đích, model, token vào/ra, thời gian, chi phí và trạng thái.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Select value={purpose} onValueChange={setPurpose}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all" className="text-xs">
                Mọi mục đích
              </SelectItem>
              {PURPOSES.map((p) => (
                <SelectItem key={p} value={p} className="text-xs font-mono">
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 text-xs w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all" className="text-xs">
                Mọi trạng thái
              </SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="text-xs font-mono">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        {q.isPending ? (
          <Skeleton className="h-64 w-full" />
        ) : q.isError ? (
          <ErrorState code={describeError(q.error).code} message={describeError(q.error).message} onRetry={() => q.refetch()} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState icon={ListOrdered} title="Chưa có lượt gọi AI nào" description="Gửi một câu hỏi trong Trợ lý AI, mỗi lượt sẽ xuất hiện ở đây." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Thời điểm</TableHead>
                    <TableHead className="text-xs">Người gọi</TableHead>
                    <TableHead className="text-xs">Mục đích</TableHead>
                    <TableHead className="text-xs">Model</TableHead>
                    <TableHead className="text-xs text-right">Vào / Ra</TableHead>
                    <TableHead className="text-xs text-right">Thời gian</TableHead>
                    <TableHead className="text-xs text-right">Chi phí</TableHead>
                    <TableHead className="text-xs">Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((r) => (
                    <TableRow key={r.id} className="text-xs">
                      <TableCell className="font-mono whitespace-nowrap">{fmtTime(r.createdAt)}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.user?.shortName ?? r.user?.fullName ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {r.purpose}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                        {r.provider} · {r.model}
                      </TableCell>
                      <TableCell className="text-right font-mono whitespace-nowrap">
                        {r.inputTokens.toLocaleString()} / {r.outputTokens.toLocaleString()}
                        {r.cachedInputTokens > 0 && <span className="text-success"> · cache {r.cachedInputTokens.toLocaleString()}</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono">{(r.durationMs / 1000).toFixed(1)}s</TableCell>
                      <TableCell className="text-right font-mono whitespace-nowrap">
                        {r.costVnd.toLocaleString()} ₫
                        <span className="block text-[10px] text-muted-foreground">${r.costUsd.toFixed(5)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(r.status)} className="text-[10px] font-mono">
                          {r.status}
                        </Badge>
                        {r.errorMessage && <span className="block text-[10px] text-muted-foreground max-w-48 truncate">{r.errorMessage}</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Trang {data.page}/{pages} · {data.from} → {data.to}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={page <= 1 || q.isFetching} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" /> Trước
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={page >= pages || q.isFetching} onClick={() => setPage((p) => p + 1)}>
                  Sau <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
