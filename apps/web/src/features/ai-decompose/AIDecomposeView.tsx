"use client";

import * as React from "react";
import {
  Sparkles,
  Bot,
  Check,
  X,
  Clock,
  Send,
  Loader2,
  AlertCircle,
  HelpCircle,
  CheckSquare,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/app/PageHeader";
import { UserAvatar } from "@/components/app/UserAvatar";
import { WorkloadBadge } from "@/components/app/WorkloadBadge";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { StateToggle, type ScreenState } from "@/components/app/StateToggle";
import {
  DEFAULT_AI_PROMPT,
  MOCK_DECOMPOSED_TASKS,
  type DecomposedTaskItem,
} from "@/mocks/ai-decompose";
import { MEMBERS } from "@/mocks/members";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function AIDecomposeView() {
  const [screenState, setScreenState] = React.useState<ScreenState>("data");
  const [prompt, setPrompt] = React.useState(DEFAULT_AI_PROMPT);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [tasks, setTasks] = React.useState<DecomposedTaskItem[]>(MOCK_DECOMPOSED_TASKS);
  const [hasDecomposed, setHasDecomposed] = React.useState(true);

  const selectedCount = tasks.filter((t) => t.selected).length;
  const totalHours = tasks
    .filter((t) => t.selected)
    .reduce((acc, cur) => acc + cur.estimateHours, 0);

  const handleDecompose = () => {
    if (!prompt.trim()) return;
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setHasDecomposed(true);
      toast.success("AI Agent đã hoàn tất phân rã WBS và đề xuất phân công!");
    }, 1800);
  };

  const handleToggleSelectAll = (checked: boolean) => {
    setTasks((prev) => prev.map((t) => ({ ...t, selected: checked })));
  };

  const handleToggleRow = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  const handleTitleChange = (id: string, newTitle: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, title: newTitle } : t))
    );
  };

  const handleHoursChange = (id: string, hours: number) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, estimateHours: hours } : t))
    );
  };

  const handleApplyTasks = () => {
    toast.success(`Đã áp dụng ${selectedCount} công việc vào Sprint 3`, {
      description: `Tổng số giờ ước lượng: ${totalHours}h. Đã tự động cập nhật tải cho Minh, An, Lan, Thảo.`,
    });
  };

  const handleReject = () => {
    toast.info("Đã từ chối bản đề xuất phân rã này");
    setHasDecomposed(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Phân rã yêu cầu thành công việc"
        description="Mô hình AI Agent tự động bóc tách WBS, nhận diện kỹ năng và đề xuất giao việc cân bằng tải."
        breadcrumbs={[
          { label: "VNPT Dev Team", href: "/workspaces" },
          { label: "SmartTask v1", href: "/projects/ST/dashboard" },
          { label: "AI Decompose" },
        ]}
      />

      {screenState === "loading" && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      )}

      {screenState === "empty" && (
        <EmptyState
          title="Chưa có yêu cầu nào cần phân rã"
          description="Nhập yêu cầu phần mềm hoặc mô tả tính năng để AI Agent hỗ trợ bóc tách danh sách việc con và tính toán tải khả dụng."
          actionLabel="Tải yêu cầu mẫu"
          onAction={() => {
            setPrompt(DEFAULT_AI_PROMPT);
            setScreenState("data");
          }}
        />
      )}

      {screenState === "error" && (
        <ErrorState
          code="AI_QUOTA_EXCEEDED"
          message="Bạn đã dùng hết hạn mức token AI trong tháng của workspace VNPT (1.000.000 tokens). Vui lòng chuyển sang Ollama local hoặc liên hệ Quản trị viên."
          onRetry={() => setScreenState("data")}
        />
      )}

      {screenState === "data" && (
        <div className="space-y-6">
          {/* Prompt Input Card */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-info/10 text-info">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-base font-semibold">
                    Nhập yêu cầu phần mềm (User Story / BRD)
                  </CardTitle>
                </div>
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  Mô hình: Gemini 1.5 Pro
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Mô tả tính năng từ 3–5 câu để AI Agent tự động phân rã WBS, ước lượng giờ và gán nhân sự theo kỹ năng.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Nhập yêu cầu phần mềm chi tiết tại đây..."
                className="min-h-[100px] text-xs leading-relaxed"
                disabled={isProcessing}
              />
            </CardContent>

            <CardFooter className="pt-0 flex items-center justify-between border-t border-border/40 py-3 bg-muted/10">
              <span className="text-[11px] text-muted-foreground">
                Gợi ý: Bao gồm cả yêu cầu backend, frontend, bảo mật và kịch bản test.
              </span>
              <Button
                onClick={handleDecompose}
                disabled={isProcessing || !prompt.trim()}
                className="gap-2 text-xs"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang phân rã yêu cầu...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Bắt đầu phân rã WBS
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          {/* Streaming Skeleton during processing */}
          {isProcessing && (
            <Card className="border-info/50 bg-info/5 p-6 space-y-4 animate-pulse">
              <div className="flex items-center gap-2 text-info text-sm font-semibold">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>AI Agent đang bóc tách WBS và kiểm tra Validator tải trống...</span>
              </div>
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </Card>
          )}

          {/* Decomposed Tasks Preview Panel (Chờ xác nhận: viền info + badge info) */}
          {!isProcessing && hasDecomposed && (
            <Card className="border-info/60 bg-card shadow-sm ring-1 ring-info/20">
              <CardHeader className="pb-3 border-b border-info/20 bg-info/5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="info" className="gap-1.5 py-0.5 px-2 text-xs">
                      <Sparkles className="h-3 w-3" />
                      Đề xuất chờ xác nhận từ AI Agent
                    </Badge>
                    <span className="text-xs font-semibold text-foreground">
                      {tasks.length} công việc con được tạo
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Đã chọn:</span>
                    <Badge variant="secondary" className="font-mono tabular-nums">
                      {selectedCount}/{tasks.length} việc · {totalHours}h
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/40 text-xs">
                      <TableRow>
                        <TableHead className="w-10 text-center">
                          <Checkbox
                            checked={selectedCount === tasks.length}
                            onCheckedChange={handleToggleSelectAll}
                            aria-label="Chọn tất cả"
                          />
                        </TableHead>
                        <TableHead className="min-w-[280px]">Tiêu đề công việc (WBS)</TableHead>
                        <TableHead className="w-24 text-center">Giờ ước tính</TableHead>
                        <TableHead className="min-w-[160px]">Kỹ năng cần thiết</TableHead>
                        <TableHead className="w-24">Phụ thuộc</TableHead>
                        <TableHead className="min-w-[150px]">Người được đề xuất</TableHead>
                        <TableHead className="w-28 text-center">Tải sau nhận</TableHead>
                        <TableHead className="min-w-[220px]">Lý do phân công</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody className="text-xs">
                      {tasks.map((t) => (
                        <TableRow
                          key={t.id}
                          className={cn(
                            "transition-colors",
                            !t.selected && "opacity-40 bg-muted/10"
                          )}
                        >
                          {/* Checkbox */}
                          <TableCell className="text-center">
                            <Checkbox
                              checked={t.selected}
                              onCheckedChange={() => handleToggleRow(t.id)}
                            />
                          </TableCell>

                          {/* Editable Title */}
                          <TableCell className="font-medium">
                            <Input
                              value={t.title}
                              onChange={(e) => handleTitleChange(t.id, e.target.value)}
                              className="h-7 text-xs px-2 border-transparent hover:border-input focus-visible:border-primary shadow-none"
                            />
                          </TableCell>

                          {/* Estimate Hours */}
                          <TableCell className="text-center">
                            <Input
                              type="number"
                              value={t.estimateHours}
                              onChange={(e) => handleHoursChange(t.id, Number(e.target.value))}
                              className="h-7 w-16 text-center text-xs font-mono tabular-nums mx-auto"
                            />
                          </TableCell>

                          {/* Required Skills */}
                          <TableCell>
                            <div className="flex items-center gap-1 flex-wrap">
                              {t.requiredSkills.map((sk) => (
                                <Badge
                                  key={sk.name}
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 h-4"
                                >
                                  {sk.name} ({sk.level})
                                </Badge>
                              ))}
                            </div>
                          </TableCell>

                          {/* Dependencies */}
                          <TableCell>
                            <div className="flex items-center gap-1 flex-wrap">
                              {t.dependencies.length > 0 ? (
                                t.dependencies.map((dep) => (
                                  <Badge
                                    key={dep}
                                    variant="outline"
                                    className="font-mono text-[10px] px-1 py-0 h-4"
                                  >
                                    {dep}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-muted-foreground text-[11px]">—</span>
                              )}
                            </div>
                          </TableCell>

                          {/* Suggested Assignee */}
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <UserAvatar
                                name={t.suggestedAssigneeName}
                                role={t.suggestedAssigneeRole}
                                size="sm"
                                showTooltip={false}
                              />
                              <div>
                                <span className="font-medium text-foreground">
                                  {t.suggestedAssigneeName}
                                </span>
                                <span className="text-[10px] text-muted-foreground block">
                                  {t.suggestedAssigneeRole}
                                </span>
                              </div>
                            </div>
                          </TableCell>

                          {/* Post-assign Workload */}
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-muted-foreground text-[10px] line-through tabular-nums">
                                {t.currentWorkload}%
                              </span>
                              <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                              <WorkloadBadge percent={t.postAssignWorkload} />
                            </div>
                          </TableCell>

                          {/* Rationale */}
                          <TableCell className="text-muted-foreground text-[11px] leading-snug">
                            {t.assignmentRationale}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>

              {/* Action Bar Footer */}
              <CardFooter className="p-4 border-t border-info/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-muted/20">
                <div className="text-xs text-muted-foreground">
                  Đề xuất tuân thủ công thức tải khả dụng và khớp ma trận kỹ năng của nhóm VNPT.
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReject}
                    className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                    Từ chối
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleApplyTasks}
                    disabled={selectedCount === 0}
                    className="gap-1.5 text-xs bg-primary text-primary-foreground shadow"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Áp dụng {selectedCount} công việc
                  </Button>
                </div>
              </CardFooter>
            </Card>
          )}
        </div>
      )}

      <StateToggle state={screenState} onChange={setScreenState} />
    </div>
  );
}
