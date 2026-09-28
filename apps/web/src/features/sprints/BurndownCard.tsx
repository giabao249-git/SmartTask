"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/app/ErrorState";
import { describeError } from "@/lib/api";
import { useBurndown, useForecast } from "@/lib/hooks/analytics";
import { riskToVariant } from "@/lib/status";
import { dm, hrs } from "./shared";

const config: ChartConfig = {
  ideal: { label: "Lý tưởng", color: "hsl(var(--chart-2))" },
  remaining: { label: "Còn lại", color: "hsl(var(--chart-1))" },
};
const RISK: Record<string, string> = { LOW: "Thấp", MEDIUM: "Trung bình", HIGH: "Cao", UNKNOWN: "Chưa rõ" };

/** Burn-down + dự báo của MỘT sprint (UC-30/31) — GET /sprints/:id/burndown + /forecast, số backend tính. */
export function BurndownCard({ sprintId, closed }: { sprintId: string; closed: boolean }) {
  const bd = useBurndown(sprintId);
  const fc = useForecast(sprintId);
  const data = bd.data
    ? (() => {
        const m = new Map<string, { date: string; ideal?: number; remaining?: number }>();
        for (const p of bd.data.ideal) m.set(p.date, { date: p.date, ideal: p.ideal });
        for (const p of bd.data.actual) m.set(p.date, { ...(m.get(p.date) ?? { date: p.date }), remaining: p.remaining });
        return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
      })()
    : [];
  const f = fc.data;
  return (
    <Card className="min-w-0">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-muted-foreground" /> Burn-down
          </CardTitle>
          {f && !closed && <Badge variant={riskToVariant(f.riskLevel)}>Rủi ro {RISK[f.riskLevel] ?? f.riskLevel}</Badge>}
        </div>
        <CardDescription>
          {closed
            ? f?.final
              ? `Lúc đóng còn ${hrs(f.final.remainingHours)} trên phạm vi ${hrs(f.final.scopeHours)}.`
              : "Sprint đóng trước khi hệ thống chụp số cuối — chỉ còn các ngày đã có bản chụp."
            : f
              ? `Còn ${hrs(f.remainingHours)} · vận tốc ${hrs(f.velocity)}/ngày · ETA ${f.eta ? dm(f.eta) : "—"} · còn ${f.workdaysLeft} ngày làm việc`
              : " "}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-2">
        {bd.isPending ? (
          <Skeleton className="h-48 w-full" />
        ) : bd.isError ? (
          <ErrorState code={describeError(bd.error).code} message={describeError(bd.error).message} onRetry={() => bd.refetch()} />
        ) : (
          <ChartContainer config={config} className="h-48 w-full">
            <LineChart data={data} margin={{ left: -20, right: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={(v: string) => dm(v)} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="ideal" stroke="var(--color-ideal)" strokeDasharray="4 4" dot={false} />
              <Line type="monotone" dataKey="remaining" stroke="var(--color-remaining)" strokeWidth={2} dot={{ r: 2 }} connectNulls />
            </LineChart>
          </ChartContainer>
        )}
        {bd.data && bd.data.gaps.length > 0 && <p className="text-xs text-muted-foreground">Thiếu bản chụp {bd.data.gaps.length} ngày làm việc — đường còn lại chỉ nối các ngày có số liệu.</p>}
        {bd.data && bd.data.scopeCreepDays.length > 0 && <p className="text-xs text-warning-foreground">Phạm vi tăng quá 10 % so với lúc bắt đầu vào {bd.data.scopeCreepDays.map(dm).join(", ")}.</p>}
      </CardContent>
    </Card>
  );
}
