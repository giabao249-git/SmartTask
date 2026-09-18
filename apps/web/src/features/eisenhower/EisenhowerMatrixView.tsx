"use client";

import * as React from "react";
import {
  Grid2X2,
  AlertCircle,
  Calendar,
  UserCheck,
  Trash2,
  Sparkles,
  MoveRight,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/PageHeader";
import { UserAvatar } from "@/components/app/UserAvatar";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { StateToggle, type ScreenState } from "@/components/app/StateToggle";
import { Skeleton } from "@/components/ui/skeleton";
import { INITIAL_TASKS, type TaskItem } from "@/mocks/tasks";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type QuadrantId = "Q1" | "Q2" | "Q3" | "Q4";

interface QuadrantConfig {
  id: QuadrantId;
  title: string;
  subtitle: string;
  action: string;
  variantClass: string;
  badgeVariant: "destructive" | "default" | "warning" | "secondary";
}

const QUADRANTS: QuadrantConfig[] = [
  {
    id: "Q1",
    title: "Khẩn cấp & Quan trọng",
    subtitle: "Làm ngay (Do First) — Sự cố, nợ kỹ thuật nghiêm trọng, blocker",
    action: "Làm ngay",
    variantClass: "border-destructive/60 bg-destructive/5 ring-1 ring-destructive/20",
    badgeVariant: "destructive",
  },
  {
    id: "Q2",
    title: "Không khẩn & Quan trọng",
    subtitle: "Lập kế hoạch (Schedule) — Kiến trúc dài hạn, cân bằng tải, WBS",
    action: "Lập kế hoạch",
    variantClass: "border-primary/60 bg-primary/5 ring-1 ring-primary/20",
    badgeVariant: "default",
  },
  {
    id: "Q3",
    title: "Khẩn cấp & Không quan trọng",
    subtitle: "Ủy quyền (Delegate) — Task kiểm thử phụ, họp đột xuất",
    action: "Ủy quyền",
    variantClass: "border-warning/60 bg-warning/5 ring-1 ring-warning/20",
    badgeVariant: "warning",
  },
  {
    id: "Q4",
    title: "Không khẩn & Không quan trọng",
    subtitle: "Cắt giảm (Eliminate) — Yêu cầu không cần thiết, tính năng thừa",
    action: "Cắt bỏ",
    variantClass: "border-muted/80 bg-muted/20",
    badgeVariant: "secondary",
  },
];

export function EisenhowerMatrixView() {
  const [screenState, setScreenState] = React.useState<ScreenState>("data");
  // Map tasks to quadrants based on priority and status
  const [taskQuadrants, setTaskQuadrants] = React.useState<Record<string, QuadrantId>>(() => {
    const initialMap: Record<string, QuadrantId> = {};
    INITIAL_TASKS.forEach((t) => {
      if (t.priority === "URGENT") initialMap[t.id] = "Q1";
      else if (t.priority === "HIGH") initialMap[t.id] = "Q2";
      else if (t.priority === "MEDIUM") initialMap[t.id] = "Q3";
      else initialMap[t.id] = "Q4";
    });
    return initialMap;
  });

  const getQuadrantTasks = (qId: QuadrantId) => {
    return INITIAL_TASKS.filter((t) => taskQuadrants[t.id] === qId);
  };

  const moveTask = (taskId: string, targetQ: QuadrantId) => {
    setTaskQuadrants((prev) => ({ ...prev, [taskId]: targetQ }));
    toast.success(`Đã chuyển công việc sang ô ${targetQ}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ma trận Quyết định Eisenhower"
        description="Phân loại 4 nhóm công việc theo mức độ Khẩn cấp và Quan trọng để tối ưu sự tập trung của đội ngũ."
        breadcrumbs={[
          { label: "VNPT Dev Team", href: "/workspaces" },
          { label: "SmartTask v1", href: "/projects/ST/dashboard" },
          { label: "Ma trận Eisenhower" },
        ]}
      />

      {screenState === "loading" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full rounded-xl" />
          ))}
        </div>
      )}

      {screenState === "empty" && (
        <EmptyState
          title="Chưa có thẻ nào trong ma trận"
          description="Hãy tạo hoặc gắn độ ưu tiên cho các task trong Sprint 3 để tự động hiển thị trong ma trận 2x2."
          actionLabel="Đồng bộ từ Sprint 3"
          onAction={() => setScreenState("data")}
        />
      )}

      {screenState === "error" && (
        <ErrorState
          code="NOT_FOUND"
          message="Không thể phân tích ma trận ưu tiên cho sprint đã chọn."
          onRetry={() => setScreenState("data")}
        />
      )}

      {screenState === "data" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {QUADRANTS.map((q) => {
            const qTasks = getQuadrantTasks(q.id);

            return (
              <Card key={q.id} className={cn("flex flex-col shadow-xs", q.variantClass)}>
                <CardHeader className="p-4 pb-2 border-b border-border/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={q.badgeVariant} className="text-xs px-2 py-0.5">
                        {q.id} · {q.action}
                      </Badge>
                      <CardTitle className="text-sm font-semibold text-foreground">
                        {q.title}
                      </CardTitle>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-muted-foreground">
                      {qTasks.length} việc
                    </span>
                  </div>
                  <CardDescription className="text-xs leading-relaxed mt-1">
                    {q.subtitle}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-4 flex-1 space-y-2.5 overflow-y-auto max-h-[380px]">
                  {qTasks.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border bg-background/90 shadow-xs hover:border-primary/40 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden pr-2">
                        <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 shrink-0">
                          {t.code}
                        </Badge>
                        <span className="text-xs font-medium text-foreground truncate" title={t.title}>
                          {t.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <UserAvatar
                          name={t.assignee.name}
                          avatar={t.assignee.avatar}
                          role={t.assignee.role}
                          size="sm"
                          showTooltip={false}
                        />

                        {/* Quick move buttons */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {QUADRANTS.filter((target) => target.id !== q.id).map((target) => (
                            <Button
                              key={target.id}
                              variant="outline"
                              size="sm"
                              className="h-6 w-6 p-0 text-[10px] font-mono"
                              onClick={() => moveTask(t.id, target.id)}
                              title={`Chuyển sang ${target.id}`}
                            >
                              {target.id}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}

                  {qTasks.length === 0 && (
                    <div className="flex items-center justify-center p-8 border border-dashed border-border/60 rounded-lg text-xs text-muted-foreground">
                      Khu vực trống
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <StateToggle state={screenState} onChange={setScreenState} />
    </div>
  );
}
