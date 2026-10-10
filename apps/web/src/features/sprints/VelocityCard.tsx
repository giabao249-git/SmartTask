"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Gauge } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { SprintView } from "@/lib/types";

const config: ChartConfig = {
  committed: { label: "Cam kết", color: "hsl(var(--chart-2))" },
  completed: { label: "Hoàn thành", color: "hsl(var(--chart-1))" },
};

/**
 * Vận tốc giữa các sprint (UC-30, docs 02/07 C2 — cơ chế Velocity chart của Jira): mỗi sprint đã đóng một cặp cột
 * cam kết lúc bắt đầu / giờ hoàn thành. Số lấy nguyên văn GET /projects/:id/sprints — web không tính.
 */
export function VelocityCard({ sprints }: { sprints: SprintView[] }) {
  const data = sprints
    .filter((s) => s.status === "CLOSED")
    .sort((a, b) => (a.closedAt ?? a.endDate).localeCompare(b.closedAt ?? b.endDate))
    .slice(-6)
    .map((s) => ({ name: s.name, committed: Number(s.scopeHoursInitial ?? 0), completed: s.completedHours ?? 0 }));
  if (!data.length) return null;
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Gauge className="h-4 w-4 text-muted-foreground" /> Vận tốc
        </CardTitle>
        <CardDescription>Cam kết lúc bắt đầu so với giờ hoàn thành của các sprint đã đóng.</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <ChartContainer config={config} className="h-44 w-full">
          <BarChart data={data} margin={{ left: -20, right: 4 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis fontSize={11} tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="committed" fill="var(--color-committed)" radius={3} />
            <Bar dataKey="completed" fill="var(--color-completed)" radius={3} />
          </BarChart>
        </ChartContainer>
        {/* Chú thích: màu lấy đúng token --chart-n của biểu đồ, không mã hex */}
        <div className="mt-2 flex justify-center gap-4 text-xs text-muted-foreground">
          {(["committed", "completed"] as const).map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: config[k].color }} />
              {config[k].label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
