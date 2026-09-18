"use client";

import * as React from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  AlertTriangle,
  Shuffle,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardDescription, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/app/PageHeader";
import { UserAvatar } from "@/components/app/UserAvatar";
import { WorkloadBadge } from "@/components/app/WorkloadBadge";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { StateToggle, type ScreenState } from "@/components/app/StateToggle";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CURRENT_REBALANCE_PROPOSAL,
  type RebalanceProposal,
} from "@/mocks/rebalance";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function RebalanceView() {
  const [screenState, setScreenState] = React.useState<ScreenState>("data");
  const [proposal, setProposal] = React.useState<RebalanceProposal>(CURRENT_REBALANCE_PROPOSAL);

  const handleApplySingle = (actionId: string) => {
    setProposal((prev) => ({
      ...prev,
      recommendations: prev.recommendations.map((a) =>
        a.id === actionId ? { ...a, applied: true } : a
      ),
    }));
    toast.success("Đã áp dụng chuyển giao công việc thành công!");
  };

  const handleApplyAll = () => {
    setProposal((prev) => ({
      ...prev,
      recommendations: prev.recommendations.map((a) => ({ ...a, applied: true })),
    }));
    toast.success("Đã áp dụng toàn bộ phương án cân bằng tải", {
      description: "Độ lệch Spread tải toàn đội đã hạ từ 41% xuống 18%. Huy không còn quá tải.",
    });
  };

  const allApplied = proposal.recommendations.every((a) => a.applied);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Đề xuất Cân bằng tải Nhân sự Tự động"
        description="Thuật toán AI phân tích tải tuần, giờ trống và ma trận kỹ năng để tái cấu trúc khối lượng công việc, hạ độ lệch Spread."
        breadcrumbs={[
          { label: "VNPT Dev Team", href: "/workspaces" },
          { label: "SmartTask v1", href: "/projects/ST/dashboard" },
          { label: "Cân bằng tải" },
        ]}
      >
        <Button
          size="sm"
          onClick={handleApplyAll}
          disabled={allApplied}
          className="gap-1.5 text-xs"
        >
          <Check className="h-3.5 w-3.5" />
          {allApplied ? "Đã áp dụng toàn bộ" : "Áp dụng toàn bộ phương án"}
        </Button>
      </PageHeader>

      {screenState === "loading" && (
        <div className="space-y-6">
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      )}

      {screenState === "empty" && (
        <EmptyState
          title="Tải nhân sự hiện tại đang ở trạng thái cân bằng"
          description="Độ lệch Spread tải của nhóm hiện dưới 20% và không có thành viên nào vượt ngưỡng 110%."
          actionLabel="Quét lại tải tuần"
          onAction={() => setScreenState("data")}
        />
      )}

      {screenState === "error" && (
        <ErrorState
          code="PROPOSAL_ALREADY_APPLIED"
          message="Phương án đề xuất này đã được áp dụng trước đó hoặc dữ liệu công việc đã bị dời lịch."
          onRetry={() => setScreenState("data")}
        />
      )}

      {screenState === "data" && (
        <div className="space-y-6">
          {/* Comparison Cards: Trước vs Sau */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cột TRƯỚC */}
            <Card className="border-warning/50 bg-warning/5 shadow-xs">
              <CardHeader className="p-4 pb-3 border-b border-warning/20">
                <div className="flex items-center justify-between">
                  <Badge variant="warning" className="text-xs px-2 py-0.5">
                    Hiện trạng (Trước cân bằng)
                  </Badge>
                  <span className="text-xs font-mono text-warning-foreground font-semibold">
                    Spread: {proposal.spreadBefore}% (Rủi ro)
                  </span>
                </div>
                <CardDescription className="text-xs mt-1">
                  1 thành viên quá tải (&gt;110%), 2 task quá hạn, độ lệch tải cao.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 space-y-3">
                {/* Member load bars BEFORE */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-destructive flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Huy (Frontend Lead)
                    </span>
                    <WorkloadBadge percent={118} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Minh (Backend)</span>
                    <WorkloadBadge percent={96} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Lan (PM)</span>
                    <WorkloadBadge percent={62} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Thảo (QA)</span>
                    <WorkloadBadge percent={45} />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground">An (Fullstack - mới)</span>
                    <WorkloadBadge percent={30} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cột SAU */}
            <Card className="border-success/50 bg-success/5 shadow-xs">
              <CardHeader className="p-4 pb-3 border-b border-success/20">
                <div className="flex items-center justify-between">
                  <Badge variant="success" className="text-xs px-2 py-0.5">
                    Dự báo (Sau khi áp dụng)
                  </Badge>
                  <span className="text-xs font-mono text-success font-semibold">
                    Spread: {proposal.spreadAfter}% (Đạt chuẩn ≤ 20%)
                  </span>
                </div>
                <CardDescription className="text-xs mt-1">
                  0 thành viên quá tải, san đều 16 giờ cho An, Spread giảm 23%.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 space-y-3">
                {/* Member load bars AFTER */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      Huy (Frontend Lead)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="line-through text-muted-foreground text-[10px] tabular-nums">118%</span>
                      <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                      <WorkloadBadge percent={88} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Minh (Backend)</span>
                    <WorkloadBadge percent={96} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Lan (PM)</span>
                    <WorkloadBadge percent={62} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Thảo (QA)</span>
                    <WorkloadBadge percent={45} />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">An (Fullstack - mới)</span>
                    <div className="flex items-center gap-1.5">
                      <span className="line-through text-muted-foreground text-[10px] tabular-nums">30%</span>
                      <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                      <WorkloadBadge percent={68} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recommendations List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Shuffle className="h-4 w-4 text-primary" />
                  Danh sách công việc chuyển giao (Huy → An)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Đã kiểm tra qua Validator kiến trúc: Đủ giờ trống khả dụng, không xung đột phụ thuộc và đạt độ khớp kỹ năng.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {proposal.recommendations.map((rec) => (
                <Card
                  key={rec.id}
                  className={cn(
                    "p-4 border-border/80 shadow-xs transition-all",
                    rec.applied && "border-success/50 bg-success/5"
                  )}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Task Info & Transfer Flow */}
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs font-semibold">
                          {rec.taskCode}
                        </Badge>
                        <h4 className="text-sm font-semibold text-foreground">
                          {rec.taskTitle}
                        </h4>
                        <Badge variant="secondary" className="font-mono text-xs tabular-nums">
                          {rec.hours} giờ
                        </Badge>
                      </div>

                      {/* Flow: From Huy -> To An */}
                      <div className="flex items-center gap-3 text-xs pt-1">
                        <div className="flex items-center gap-1.5 text-destructive font-medium">
                          <UserAvatar name={rec.fromUser.name} role={rec.fromUser.role} size="sm" showTooltip={false} />
                          <span>{rec.fromUser.name} ({rec.fromUser.beforeLoad}% → {rec.fromUser.afterLoad}%)</span>
                        </div>

                        <ArrowRight className="h-4 w-4 text-muted-foreground" />

                        <div className="flex items-center gap-1.5 text-success font-medium">
                          <UserAvatar name={rec.toUser.name} role={rec.toUser.role} size="sm" showTooltip={false} />
                          <span>{rec.toUser.name} ({rec.toUser.beforeLoad}% → {rec.toUser.afterLoad}%)</span>
                        </div>
                      </div>

                      {/* Rationale & Skill match */}
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        <strong className="text-foreground">Lý do:</strong> {rec.rationale}
                      </p>

                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                        <span>Đối chiếu ma trận kỹ năng: {rec.skillMatch}</span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="shrink-0 self-end lg:self-center">
                      {rec.applied ? (
                        <Badge variant="success" className="gap-1 text-xs py-1 px-2.5">
                          <Check className="h-3.5 w-3.5" />
                          Đã chuyển giao
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleApplySingle(rec.id)}
                          className="gap-1.5 text-xs"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Áp dụng dòng này
                        </Button>
                      )}
                    </div>
                  </div>
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
