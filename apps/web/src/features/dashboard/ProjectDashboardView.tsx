"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Flame,
  Scale,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  ReferenceLine,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { StateToggle, type ScreenState } from "@/components/app/StateToggle";
import {
  DASHBOARD_WORKLOAD_DATA,
  DASHBOARD_BURNDOWN_DATA,
  DASHBOARD_ALERTS,
} from "@/mocks/dashboard";
import { cn } from "@/lib/utils";

export function ProjectDashboardView() {
  const [screenState, setScreenState] = React.useState<ScreenState>("data");

  const workloadChartConfig = {
    actualHours: {
      label: "Đã làm (h)",
      color: "hsl(var(--chart-2))",
    },
    plannedHours: {
      label: "Còn lại (h)",
      color: "hsl(var(--chart-1))",
    },
  };

  const burndownChartConfig = {
    idealRemaining: {
      label: "Lý tưởng (h)",
      color: "hsl(var(--muted-foreground))",
    },
    actualRemaining: {
      label: "Thực tế còn lại (h)",
      color: "hsl(var(--primary))",
    },
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Tổng quan Dự án SmartTask v1"
        description="Theo dõi tiến độ Sprint 3, vận tốc burn-down và trạng thái cân bằng tải thời gian thực."
        breadcrumbs={[
          { label: "VNPT Dev Team", href: "/workspaces" },
          { label: "SmartTask v1" },
          { label: "Dashboard" },
        ]}
      >
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs">
            <Link href="/projects/ST/assistant?initialPrompt=G%E1%BB%A1+b%E1%BB%9Bt+cho+Huy">
              <Scale className="h-3.5 w-3.5 text-warning" />
              <span>Đề xuất cân bằng tải</span>
            </Link>
          </Button>
          <Button asChild size="sm" className="gap-1.5 text-xs">
            <Link href="/projects/ST/board">
              <span>Bảng Kanban</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </PageHeader>

      {screenState === "loading" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-80 w-full rounded-xl" />
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
        </div>
      )}

      {screenState === "empty" && (
        <EmptyState
          title="Chưa có dữ liệu thống kê dự án"
          description="Dự án mới khởi tạo chưa có số liệu burn-down và phân bổ giờ công việc."
          actionLabel="Xem dữ liệu mẫu Sprint 3"
          onAction={() => setScreenState("data")}
        />
      )}

      {screenState === "error" && (
        <ErrorState
          code="NOT_FOUND"
          message="Không tìm thấy dự án với mã ST trong workspace hiện tại."
          onRetry={() => setScreenState("data")}
        />
      )}

      {screenState === "data" && (
        <div className="space-y-6">
          {/* 4 Stat Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Công việc mở */}
            <Card className="p-4 border-border/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Công việc mở</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-semibold tabular-nums text-foreground">
                  14 / 18
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  4 đã xong · 4 đang làm · 3 review
                </p>
              </div>
            </Card>

            {/* 2. Quá hạn */}
            <Card className="p-4 border-destructive/30 bg-destructive/5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-destructive font-medium">Việc quá hạn</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/20 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-semibold tabular-nums text-destructive">
                  2 việc
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  ST-12 (1 ngày) · ST-8 (1 ngày)
                </p>
              </div>
            </Card>

            {/* 3. Tiến độ Sprint */}
            <Card className="p-4 border-warning/30 bg-warning/5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-warning-foreground font-medium">Tiến độ Sprint 3</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/20 text-warning">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-semibold tabular-nums text-warning-foreground">
                  52% hoàn thành
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  120h còn 58h · ETA trễ 2 ngày (31/10)
                </p>
              </div>
            </Card>

            {/* 4. Cảnh báo tải & Burnout */}
            <Card className="p-4 border-destructive/30 bg-card shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Cảnh báo nhân sự</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                  <Flame className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-semibold tabular-nums text-destructive">
                  1 Quá tải
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Huy: 118% · Điểm Burnout 74
                </p>
              </div>
            </Card>
          </div>

          {/* Charts Row: Stacked BarChart Workload & Burn-down Mini */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Biểu đồ tải tuần theo người */}
            <Card className="shadow-xs">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">
                    Biểu đồ Tải tuần Sprint 3 theo thành viên
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Giờ đã làm và giờ còn lại (h) so với năng lực 40h chuẩn
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-[11px] font-mono">
                  Ngưỡng: 70% · 90% · 110%
                </Badge>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-64 w-full">
                  <ChartContainer config={workloadChartConfig}>
                    <BarChart
                      data={DASHBOARD_WORKLOAD_DATA}
                      margin={{ top: 20, right: 20, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} unit="h" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      {/* Stacked bar */}
                      <Bar
                        dataKey="actualHours"
                        stackId="a"
                        fill="var(--color-actualHours)"
                        radius={[0, 0, 4, 4]}
                      />
                      <Bar
                        dataKey="plannedHours"
                        stackId="a"
                        fill="var(--color-plannedHours)"
                        radius={[4, 4, 0, 0]}
                      />
                      {/* Vạch năng lực chuẩn 40h (100%) */}
                      <ReferenceLine
                        y={40}
                        stroke="hsl(var(--destructive))"
                        strokeDasharray="4 4"
                        label={{ value: "40h (100%)", fill: "hsl(var(--destructive))", fontSize: 10, position: "top" }}
                      />
                    </BarChart>
                  </ChartContainer>
                </div>
                <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground pt-2 border-t border-border/40 mt-2">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-xs bg-[hsl(var(--chart-2))]" />
                    <span>Đã thực hiện (h)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-xs bg-[hsl(var(--chart-1))]" />
                    <span>Kế hoạch còn lại (h)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Biểu đồ Burn-down Mini */}
            <Card className="shadow-xs">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">
                    Biểu đồ Burn-down Sprint 3 (120h)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Đường lý tưởng vs Giờ thực tế còn lại theo ngày
                  </CardDescription>
                </div>
                <Badge variant="warning" className="text-[11px]">
                  Rủi ro Trung bình · ETA 31/10
                </Badge>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-64 w-full">
                  <ChartContainer config={burndownChartConfig}>
                    <LineChart
                      data={DASHBOARD_BURNDOWN_DATA}
                      margin={{ top: 20, right: 20, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} unit="h" domain={[0, 140]} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="idealRemaining"
                        stroke="var(--color-idealRemaining)"
                        strokeDasharray="4 4"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="actualRemaining"
                        stroke="var(--color-actualRemaining)"
                        strokeWidth={2.5}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ChartContainer>
                </div>
                <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground pt-2 border-t border-border/40 mt-2">
                  <div className="flex items-center gap-2">
                    <span className="h-0.5 w-4 border-t-2 border-dashed border-muted-foreground" />
                    <span>Lý tưởng</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-0.5 w-4 bg-primary" />
                    <span>Thực tế</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Alerts & Recommendations Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Cảnh báo rủi ro & Đề xuất hành động
              </h3>
              <Button asChild variant="link" size="sm" className="text-xs text-primary">
                <Link href="/projects/ST/assistant?initialPrompt=G%E1%BB%A1+b%E1%BB%9Bt+cho+Huy">
                  Xem chi tiết phương án cân bằng (AI) →
                </Link>
              </Button>
            </div>

            <div className="space-y-3">
              {DASHBOARD_ALERTS.map((alert) => (
                <Card
                  key={alert.id}
                  className={cn(
                    "p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-colors",
                    alert.severity === "high"
                      ? "border-destructive/40 bg-destructive/5"
                      : "border-warning/40 bg-warning/5"
                  )}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-foreground">
                        {alert.title}
                      </span>
                      <Badge
                        variant={alert.severity === "high" ? "destructive" : "warning"}
                        className="text-[10px] py-0 px-1.5"
                      >
                        {alert.severity === "high" ? "Nghiêm trọng" : "Theo dõi"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {alert.description}
                    </p>
                  </div>

                  <Button
                    asChild
                    size="sm"
                    variant={alert.severity === "high" ? "default" : "outline"}
                    className="shrink-0 text-xs self-end sm:self-auto gap-1"
                  >
                    <Link href={alert.actionHref}>
                      <span>{alert.actionText}</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      <StateToggle state={screenState} onChange={setScreenState} />
    </div>
  );
}
