"use client";

import * as React from "react";
import Link from "next/link";
import {
  Calendar,
  AlertTriangle,
  Clock,
  Briefcase,
  Coffee,
  ChevronRight,
  TrendingUp,
  Flame,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/app/PageHeader";
import { UserAvatar } from "@/components/app/UserAvatar";
import { WorkloadBadge } from "@/components/app/WorkloadBadge";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { StateToggle, type ScreenState } from "@/components/app/StateToggle";
import { WORKLOAD_DETAILS, type MemberWorkloadDetail } from "@/mocks/workload";
import { burnoutToVariant } from "@/lib/status";
import { cn } from "@/lib/utils";

export function WorkloadView() {
  const [screenState, setScreenState] = React.useState<ScreenState>("data");
  const [selectedMember, setSelectedMember] = React.useState<MemberWorkloadDetail | null>(null);
  const [truthSheetOpen, setTruthSheetOpen] = React.useState(false);

  const handleRowClick = (detail: MemberWorkloadDetail) => {
    setSelectedMember(detail);
    setTruthSheetOpen(true);
  };

  const getHeatmapBg = (percent: number) => {
    if (percent < 70) return "bg-success/10 text-success border-success/30";
    if (percent <= 90) return "bg-warning/10 text-warning-foreground border-warning/30";
    if (percent <= 110) return "bg-warning/20 text-warning-foreground font-semibold border-warning/50";
    return "bg-destructive/20 text-destructive font-bold border-destructive/60 animate-pulse";
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ma trận Tải nhân sự & Dự báo Burnout"
        description="Theo dõi giờ hiệu dụng, năng lực, lịch họp và phát hiện sớm nguy cơ kiệt sức của từng thành viên."
        breadcrumbs={[
          { label: "VNPT Dev Team", href: "/workspaces" },
          { label: "SmartTask v1", href: "/projects/ST/dashboard" },
          { label: "Tải nhân sự" },
        ]}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs hidden md:inline-flex">
            Ngưỡng tải: &lt;70% Bình thường · 70–90% Cao · 90–110% Đầy · &gt;110% Quá tải
          </Badge>
          <Button asChild size="sm" className="gap-1.5 text-xs">
            <Link href="/projects/ST/assistant?initialPrompt=G%E1%BB%A1+b%E1%BB%9Bt+cho+Huy">
              <Scale className="h-3.5 w-3.5 text-warning" />
              <span>Xem đề xuất cân bằng (AI)</span>
            </Link>
          </Button>
        </div>
      </PageHeader>

      {screenState === "loading" && (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      )}

      {screenState === "empty" && (
        <EmptyState
          title="Chưa có dữ liệu tải tuần"
          description="Chưa có thông tin phân bổ công việc hoặc snapshot tải nhân sự cho sprint này."
          actionLabel="Đồng bộ dữ liệu"
          onAction={() => setScreenState("data")}
        />
      )}

      {screenState === "error" && (
        <ErrorState
          code="CALENDAR_SYNC_FAILED"
          message="Không thể đồng bộ lịch bận từ máy chủ nội bộ VNPT. Vui lòng kiểm tra kết nối API Google Calendar / Outlook."
          onRetry={() => setScreenState("data")}
        />
      )}

      {screenState === "data" && (
        <div className="space-y-6">
          {/* Top Summary Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4 border-destructive/40 bg-destructive/5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/20 text-destructive shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Nhân sự quá tải</p>
                <p className="text-lg font-semibold text-destructive">1 thành viên (Huy 118%)</p>
              </div>
            </Card>

            <Card className="p-4 border-warning/40 bg-warning/5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/20 text-warning shrink-0">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Điểm Burnout cao nhất</p>
                <p className="text-lg font-semibold text-warning-foreground">Huy: 74 · Cảnh báo</p>
              </div>
            </Card>

            <Card className="p-4 border-border flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Độ lệch Spread tải</p>
                <p className="text-lg font-semibold text-foreground">41% (Mục tiêu: ≤ 20%)</p>
              </div>
            </Card>
          </div>

          {/* Main Workload Heatmap Table */}
          <Card className="shadow-xs overflow-hidden">
            <CardHeader className="p-4 border-b border-border/60 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  Bảng tải nhân sự theo tuần (Heatmap %)
                </CardTitle>
                <CardDescription className="text-xs">
                  Click vào hàng bất kỳ để mở &quot;Bảng sự thật&quot; chi tiết giờ trống và khối tập trung focus blocks.
                </CardDescription>
              </div>
            </CardHeader>

            <ScrollArea className="w-full">
              <Table className="min-w-[1020px]">
                <TableHeader className="bg-muted/40 text-xs">
                  <TableRow>
                    <TableHead className="min-w-[180px]">Thành viên</TableHead>
                    <TableHead className="w-24 text-center">Tải tuần này (W43)</TableHead>
                    <TableHead className="w-24 text-center">W44 (27/10)</TableHead>
                    <TableHead className="w-24 text-center">W45 (03/11)</TableHead>
                    <TableHead className="w-24 text-center">W46 (10/11)</TableHead>
                    <TableHead className="w-24 text-right">Giờ hiệu dụng</TableHead>
                    <TableHead className="w-20 text-right">Năng lực</TableHead>
                    <TableHead className="w-20 text-right">Lịch họp</TableHead>
                    <TableHead className="w-20 text-right">Nghỉ phép</TableHead>
                    <TableHead className="w-32 text-center">Mức tải</TableHead>
                    <TableHead className="w-36 text-center">Điểm Burnout</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody className="text-xs">
                  {WORKLOAD_DETAILS.map((row) => {
                    const burnoutInfo = burnoutToVariant(row.member.burnoutScore);
                    const currentWeek = row.weeks[0];

                    return (
                      <TableRow
                        key={row.memberId}
                        onClick={() => handleRowClick(row)}
                        className="cursor-pointer hover:bg-muted/60 transition-colors group"
                      >
                        {/* Member column */}
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <UserAvatar
                              name={row.member.name}
                              avatar={row.member.avatar}
                              role={row.member.role}
                              initials={row.member.initials}
                              isOnline={row.member.isOnline}
                              showTooltip={false}
                              size="sm"
                            />
                            <div>
                              <p className="font-semibold text-foreground">{row.member.name}</p>
                              <p className="text-[10px] text-muted-foreground">{row.member.role}</p>
                            </div>
                          </div>
                        </TableCell>

                        {/* 4 Weeks Heatmap */}
                        {row.weeks.map((w) => (
                          <TableCell key={w.weekKey} className="text-center p-2">
                            <div
                              className={cn(
                                "py-1 px-2 rounded-md border text-xs font-mono tabular-nums transition-transform group-hover:scale-105",
                                getHeatmapBg(w.utilization)
                              )}
                              title={`${w.weekLabel}: ${w.utilization}% (${w.effectiveLoad}h / ${w.effectiveCapacity}h)`}
                            >
                              {w.utilization}%
                            </div>
                          </TableCell>
                        ))}

                        {/* Hours breakdown */}
                        <TableCell className="text-right font-mono tabular-nums font-medium">
                          {currentWeek.effectiveLoad}h
                        </TableCell>

                        <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                          {currentWeek.effectiveCapacity}h
                        </TableCell>

                        <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                          {currentWeek.meetingHours}h
                        </TableCell>

                        <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                          {currentWeek.timeOffHours}h
                        </TableCell>

                        {/* Workload Badge */}
                        <TableCell className="text-center">
                          <WorkloadBadge percent={currentWeek.utilization} showPercent={false} />
                        </TableCell>

                        {/* Burnout Score with 6-Factor Tooltip */}
                        <TableCell className="text-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="inline-flex items-center gap-1.5 cursor-help">
                                <Badge
                                  variant={burnoutInfo.variant}
                                  className="font-mono tabular-nums text-xs px-2 py-0.5 gap-1"
                                >
                                  <Flame className="h-3 w-3" />
                                  <span>{row.member.burnoutScore}</span>
                                </Badge>
                                <span className="text-[11px] text-muted-foreground">
                                  {burnoutInfo.label}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="w-80 p-3 space-y-2 bg-popover text-popover-foreground border shadow-xl">
                              <div className="border-b pb-1.5">
                                <p className="font-semibold text-xs text-foreground flex items-center justify-between">
                                  <span>Phân rã 6 yếu tố Burnout: {row.member.name}</span>
                                  <Badge variant={burnoutInfo.variant} className="text-[10px] py-0">
                                    Tổng: {row.member.burnoutScore}/100
                                  </Badge>
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  Theo công thức chuẩn doc-04 kiến trúc SmartTask
                                </p>
                              </div>
                              <div className="space-y-1.5 text-[11px]">
                                {row.burnoutBreakdown.map((f, idx) => (
                                  <div key={idx} className="flex flex-col gap-0.5 border-b border-border/30 pb-1">
                                    <div className="flex justify-between font-medium">
                                      <span className="text-foreground">{f.name}</span>
                                      <span className="font-mono tabular-nums text-primary">
                                        +{f.score.toFixed(1)} / {f.weight}đ
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground leading-tight">
                                      {f.explanation}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>

                        {/* Arrow hint */}
                        <TableCell className="text-right">
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </div>
      )}

      {/* Truth Sheet: Click row opens right sheet (Bảng sự thật) */}
      <Sheet open={truthSheetOpen} onOpenChange={setTruthSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col h-full bg-background border-l">
          {selectedMember && (
            <>
              <div className="p-6 border-b border-border/60 bg-muted/20">
                <div className="flex items-center gap-3">
                  <UserAvatar
                    name={selectedMember.member.name}
                    avatar={selectedMember.member.avatar}
                    role={selectedMember.member.role}
                    initials={selectedMember.member.initials}
                    isOnline={selectedMember.member.isOnline}
                    size="lg"
                    showTooltip={false}
                  />
                  <div>
                    <SheetTitle className="text-base font-semibold">
                      Bảng sự thật khả dụng: {selectedMember.member.name}
                    </SheetTitle>
                    <SheetDescription className="text-xs">
                      {selectedMember.member.role} · Năng lực chuẩn: 40h/tuần · Tải hiện tại:{" "}
                      <span className="font-semibold text-foreground">{selectedMember.member.utilization}%</span>
                    </SheetDescription>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Lịch trình làm việc & Giờ trống theo ngày
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Công thức: Free = max(0, Định mức 8h − Họp − Việc đã giao).
                  </p>
                </div>

                <div className="space-y-4">
                  {selectedMember.truthSheet.map((day, idx) => (
                    <Card key={idx} className="p-4 border-border/80 space-y-3">
                      <div className="flex items-center justify-between border-b pb-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-primary" />
                          <span className="text-xs font-semibold text-foreground">
                            {day.dayOfWeek} ({day.date})
                          </span>
                        </div>
                        <Badge
                          variant={day.freeHours > 0 ? "success" : "secondary"}
                          className="font-mono tabular-nums text-xs"
                        >
                          Giờ trống: {day.freeHours}h
                        </Badge>
                      </div>

                      {/* Busy Meetings */}
                      {day.busyMeetings.length > 0 && (
                        <div className="space-y-1 text-xs">
                          <span className="text-muted-foreground text-[11px] font-medium flex items-center gap-1">
                            <Coffee className="h-3 w-3" />
                            Lịch họp & bận ({day.busyMeetings.reduce((a, c) => a + c.duration, 0)}h):
                          </span>
                          <div className="space-y-1 pl-4">
                            {day.busyMeetings.map((m, i) => (
                              <div key={i} className="flex justify-between text-[11px] text-foreground">
                                <span>{m.title}</span>
                                <span className="font-mono text-muted-foreground">{m.time} ({m.duration}h)</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Planned Tasks */}
                      {day.plannedTasks.length > 0 && (
                        <div className="space-y-1 text-xs">
                          <span className="text-muted-foreground text-[11px] font-medium flex items-center gap-1">
                            <Briefcase className="h-3 w-3" />
                            Công việc đã giao ({day.plannedTasks.reduce((a, c) => a + c.hours, 0)}h):
                          </span>
                          <div className="space-y-1 pl-4">
                            {day.plannedTasks.map((t, i) => (
                              <div key={i} className="flex justify-between text-[11px] text-foreground">
                                <span className="font-medium text-primary">{t.code}: {t.title}</span>
                                <span className="font-mono text-muted-foreground">{t.hours}h</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Focus Blocks */}
                      <div className="pt-2 border-t text-xs">
                        <span className="text-muted-foreground text-[11px] font-medium flex items-center gap-1 mb-1">
                          <Clock className="h-3 w-3 text-info" />
                          Khối tập trung (Focus Blocks ≥ 2h liên tục):
                        </span>
                        {day.focusBlocks.length > 0 ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            {day.focusBlocks.map((fb, i) => (
                              <Badge key={i} variant="info" className="font-mono text-[10px] px-2 py-0.5">
                                {fb.start}–{fb.end} ({fb.duration}h)
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">
                            Không có khối tập trung nào ≥ 2h không gián đoạn
                          </span>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <StateToggle state={screenState} onChange={setScreenState} />
    </div>
  );
}
