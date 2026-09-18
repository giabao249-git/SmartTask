"use client";

import * as React from "react";
import {
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageHeader } from "@/components/app/PageHeader";
import { UserAvatar } from "@/components/app/UserAvatar";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { StateToggle, type ScreenState } from "@/components/app/StateToggle";
import { TIMELINE_TASKS } from "@/mocks/timeline";
import { MEMBERS } from "@/mocks/members";
import { cn } from "@/lib/utils";

const TIMELINE_DAYS = [
  { day: "T4", date: "2026-10-23", label: "23/10" },
  { day: "T5", date: "2026-10-24", label: "24/10" },
  { day: "T6", date: "2026-10-25", label: "25/10" },
  { day: "T7", date: "2026-10-26", label: "26/10", isToday: true }, // Hôm nay
  { day: "CN", date: "2026-10-27", label: "27/10" },
  { day: "T2", date: "2026-10-28", label: "28/10" },
  { day: "T3", date: "2026-10-29", label: "29/10" },
];

export function TimelineGanttView() {
  const [screenState, setScreenState] = React.useState<ScreenState>("data");

  // Group tasks by assignee name
  const groupedTasks = MEMBERS.map((member) => ({
    member,
    tasks: TIMELINE_TASKS.filter((t) => t.assigneeName === member.name),
  }));

  const getDayOffset = (dateStr: string) => {
    const idx = TIMELINE_DAYS.findIndex((d) => d.date === dateStr);
    return idx !== -1 ? idx : 0;
  };

  const getDaySpan = (startStr: string, endStr: string) => {
    const start = getDayOffset(startStr);
    const end = getDayOffset(endStr);
    return Math.max(1, end - start + 1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Biểu đồ Gantt & Tiến độ Timeline"
        description="Lộ trình thực hiện công việc Sprint 3, phụ thuộc giữa các đầu việc và tiến độ theo ngày."
        breadcrumbs={[
          { label: "VNPT Dev Team", href: "/workspaces" },
          { label: "SmartTask v1", href: "/projects/ST/dashboard" },
          { label: "Timeline" },
        ]}
      >
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Sprint 3 · 23/10–29/10 · 7 ngày làm việc
          </Badge>
        </div>
      </PageHeader>

      {screenState === "loading" && (
        <div className="space-y-4">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      )}

      {screenState === "empty" && (
        <EmptyState
          title="Chưa có lịch trình công việc"
          description="Các công việc trong sprint chưa được ấn định ngày bắt đầu và ngày hoàn thành."
          actionLabel="Đặt lịch tự động bằng AI"
          onAction={() => setScreenState("data")}
        />
      )}

      {screenState === "error" && (
        <ErrorState
          code="DEPENDENCY_CYCLE"
          message="Phát hiện quan hệ phụ thuộc vòng tròn giữa các thẻ công việc (ST-12 -> ST-5 -> ST-12). Vui lòng gỡ bỏ liên kết phụ thuộc."
          onRetry={() => setScreenState("data")}
        />
      )}

      {screenState === "data" && (
        <Card className="shadow-xs overflow-hidden border-border/80">
          <CardHeader className="p-4 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">
                Tiến độ công việc nhóm theo thành viên
              </CardTitle>
              <CardDescription className="text-xs">
                Đường chỉ màu đỏ biểu thị mốc thời gian hôm nay (26/10)
              </CardDescription>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-xs bg-success" />
                Hoàn thành
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-xs bg-primary" />
                Đang làm
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-xs bg-muted" />
                Chưa bắt đầu
              </span>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <ScrollArea className="w-full">
              <div className="min-w-[900px]">
                {/* Timeline Grid Header (Days) */}
                <div className="grid grid-cols-12 border-b border-border/60 bg-muted/40 text-xs font-semibold py-2.5 px-4">
                  <div className="col-span-4 text-muted-foreground">Công việc / Người nhận</div>
                  <div className="col-span-8 grid grid-cols-7 text-center">
                    {TIMELINE_DAYS.map((d) => (
                      <div
                        key={d.date}
                        className={cn(
                          "py-0.5 rounded text-xs",
                          d.isToday && "bg-destructive/10 text-destructive font-bold ring-1 ring-destructive/40"
                        )}
                      >
                        <span className="block text-[10px] text-muted-foreground">{d.day}</span>
                        <span>{d.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Grouped by Assignee */}
                <div className="divide-y divide-border/40 relative">
                  {/* Vertical "Hôm nay" Line (Positioned over the 4th day of 7) */}
                  <div
                    className="absolute top-0 bottom-0 pointer-events-none z-10 border-r-2 border-dashed border-destructive/80"
                    style={{ left: "calc(33.333% + (66.666% / 7) * 3.5)" }}
                  >
                    <span className="absolute -top-1 -translate-x-1/2 bg-destructive text-destructive-foreground text-[9px] px-1 py-0.2 rounded font-bold uppercase">
                      Hôm nay
                    </span>
                  </div>

                  {groupedTasks.map((group) => (
                    <div key={group.member.id} className="py-2 bg-background">
                      {/* Assignee Group Header */}
                      <div className="px-4 py-1.5 flex items-center gap-2 bg-muted/20 border-y border-border/20 text-xs font-semibold">
                        <UserAvatar
                          name={group.member.name}
                          avatar={group.member.avatar}
                          role={group.member.role}
                          initials={group.member.initials}
                          isOnline={group.member.isOnline}
                          size="sm"
                          showTooltip={false}
                        />
                        <span>{group.member.name}</span>
                        <span className="text-muted-foreground font-normal">({group.member.role})</span>
                        <Badge variant="secondary" className="ml-auto text-[10px] py-0">
                          {group.tasks.length} việc
                        </Badge>
                      </div>

                      {/* Tasks of this member */}
                      <div className="space-y-2 py-2">
                        {group.tasks.map((task) => {
                          const startCol = getDayOffset(task.startDate);
                          const spanCols = getDaySpan(task.startDate, task.dueDate);

                          return (
                            <div
                              key={task.code}
                              className="grid grid-cols-12 items-center px-4 py-1 text-xs hover:bg-muted/30 transition-colors group"
                            >
                              {/* Left: Task code & title */}
                              <div className="col-span-4 flex items-center gap-2 pr-2">
                                <Badge variant="outline" className="font-mono text-[10px] px-1 py-0 font-semibold shrink-0">
                                  {task.code}
                                </Badge>
                                <span className="truncate text-foreground font-medium" title={task.title}>
                                  {task.title}
                                </span>
                                {task.dependsOn && (
                                  <span className="text-[10px] text-muted-foreground shrink-0 font-mono flex items-center gap-0.5">
                                    <ArrowRight className="h-2.5 w-2.5" />
                                    {task.dependsOn}
                                  </span>
                                )}
                              </div>

                              {/* Right: Gantt Bar on 7-col grid */}
                              <div className="col-span-8 grid grid-cols-7 relative h-7 items-center">
                                <div
                                  className={cn(
                                    "h-5 rounded-md text-[10px] font-medium flex items-center justify-between px-2 text-primary-foreground shadow-xs transition-all",
                                    task.status === "DONE"
                                      ? "bg-success"
                                      : task.status === "IN_PROGRESS"
                                      ? "bg-primary"
                                      : task.status === "REVIEW"
                                      ? "bg-warning text-warning-foreground"
                                      : "bg-muted text-muted-foreground border border-border",
                                    task.isOverdue && "ring-1 ring-destructive"
                                  )}
                                  style={{
                                    gridColumnStart: startCol + 1,
                                    gridColumnEnd: `span ${spanCols}`,
                                  }}
                                >
                                  <span className="truncate">{task.progress}%</span>
                                  {task.isOverdue && (
                                    <span className="text-[9px] bg-destructive px-1 rounded text-white shrink-0">
                                      Trễ
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <StateToggle state={screenState} onChange={setScreenState} />
    </div>
  );
}
