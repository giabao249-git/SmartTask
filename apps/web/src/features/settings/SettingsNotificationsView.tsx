"use client";

import * as React from "react";
import {
  Bell,
  Settings,
  Shield,
  Bot,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Save,
  Key,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/app/PageHeader";
import { UserAvatar } from "@/components/app/UserAvatar";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { StateToggle, type ScreenState } from "@/components/app/StateToggle";
import { Skeleton } from "@/components/ui/skeleton";
import { MOCK_NOTIFICATIONS, type NotificationItem } from "@/mocks/notifications";
import { CURRENT_WORKSPACE } from "@/mocks/members";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function SettingsNotificationsView() {
  const [screenState, setScreenState] = React.useState<ScreenState>("data");
  const [notifications, setNotifications] = React.useState<NotificationItem[]>(MOCK_NOTIFICATIONS);
  const [filterType, setFilterType] = React.useState<"all" | "unread">("all");

  // Workspace Settings Form States
  const [capacity, setCapacity] = React.useState(CURRENT_WORKSPACE.defaultCapacity.toString());
  const [normalThreshold, setNormalThreshold] = React.useState(CURRENT_WORKSPACE.workloadThresholds.normal.toString());
  const [highThreshold, setHighThreshold] = React.useState(CURRENT_WORKSPACE.workloadThresholds.high.toString());
  const [overloadThreshold, setOverloadThreshold] = React.useState(CURRENT_WORKSPACE.workloadThresholds.overload.toString());
  const [aiProvider, setAiProvider] = React.useState(CURRENT_WORKSPACE.aiConfig.provider);
  const [aiModel, setAiModel] = React.useState(CURRENT_WORKSPACE.aiConfig.model);
  const [monthlyTokenQuota, setMonthlyTokenQuota] = React.useState(CURRENT_WORKSPACE.aiConfig.monthlyTokenQuota.toString());

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success("Đã đánh dấu tất cả thông báo là đã đọc");
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Đã lưu cấu hình Workspace & Tham số AI thành công");
  };

  // Group notifications by date
  const dateGroups = ["Hôm nay", "Hôm qua", "Tuần trước"] as const;

  const displayedNotifications = notifications.filter((n) =>
    filterType === "unread" ? !n.read : true
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Thông báo & Cài đặt Workspace"
        description="Quản lý lịch sử thông báo realtime và thiết lập tham số hệ thống, ngưỡng tải nhân sự và nhà cung cấp AI."
        breadcrumbs={[
          { label: "VNPT Dev Team", href: "/workspaces" },
          { label: "Cài đặt & Thông báo" },
        ]}
      />

      {screenState === "loading" && (
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      )}

      {screenState === "empty" && (
        <EmptyState
          title="Không có thông báo nào"
          description="Hộp thư thông báo của bạn đang trống. Mọi cập nhật công việc và cảnh báo tải sẽ xuất hiện tại đây."
        />
      )}

      {screenState === "error" && (
        <ErrorState
          code="INTERNAL"
          message="Không thể đồng bộ cấu hình workspace từ máy chủ. Vui lòng kiểm tra lại quyền Quản trị viên."
          onRetry={() => setScreenState("data")}
        />
      )}

      {screenState === "data" && (
        <Tabs defaultValue="notifications" className="w-full space-y-4">
          <TabsList className="grid w-full sm:w-80 grid-cols-2">
            <TabsTrigger value="notifications" className="text-xs gap-1.5">
              <Bell className="h-3.5 w-3.5" />
              Thông báo ({unreadCount})
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs gap-1.5">
              <Settings className="h-3.5 w-3.5" />
              Cài đặt Admin
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Trung tâm thông báo */}
          <TabsContent value="notifications" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant={filterType === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType("all")}
                  className="h-7 text-xs"
                >
                  Tất cả ({notifications.length})
                </Button>
                <Button
                  variant={filterType === "unread" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType("unread")}
                  className="h-7 text-xs"
                >
                  Chưa đọc ({unreadCount})
                </Button>
              </div>

              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllRead}
                  className="h-7 text-xs text-primary"
                >
                  Đánh dấu tất cả là đã đọc
                </Button>
              )}
            </div>

            <div className="space-y-6">
              {dateGroups.map((group) => {
                const groupItems = displayedNotifications.filter((n) => n.dateGroup === group);
                if (groupItems.length === 0) return null;

                return (
                  <div key={group} className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                      {group}
                    </h4>

                    <div className="divide-y divide-border/40 rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
                      {groupItems.map((n) => (
                        <div
                          key={n.id}
                          className={cn(
                            "p-4 flex items-start justify-between gap-4 transition-colors hover:bg-muted/40",
                            !n.read && "bg-primary/5"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5">
                              {n.type === "warning" && (
                                <div className="h-7 w-7 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                                  <AlertTriangle className="h-4 w-4" />
                                </div>
                              )}
                              {n.type === "ai" && (
                                <div className="h-7 w-7 rounded-full bg-info/10 text-info flex items-center justify-center">
                                  <Sparkles className="h-4 w-4" />
                                </div>
                              )}
                              {n.type === "task" && (
                                <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                                  <Clock className="h-4 w-4" />
                                </div>
                              )}
                              {n.type === "mention" && (
                                <div className="h-7 w-7 rounded-full bg-warning/10 text-warning flex items-center justify-center">
                                  <Bell className="h-4 w-4" />
                                </div>
                              )}
                            </div>

                            <div className="space-y-0.5">
                              <p className={cn("text-xs font-semibold", !n.read ? "text-foreground" : "text-muted-foreground")}>
                                {n.title}
                              </p>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {n.message}
                              </p>
                              <span className="text-[10px] text-muted-foreground block pt-1">
                                {n.timestamp}
                              </span>
                            </div>
                          </div>

                          {!n.read && (
                            <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* TAB 2: Cài đặt Workspace (Chỉ Admin thấy) */}
          <TabsContent value="settings" className="space-y-6">
            <form onSubmit={handleSaveSettings} className="space-y-6">
              {/* Giờ làm việc & Lịch chuẩn */}
              <Card className="shadow-xs border-border/80">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm font-semibold">
                      Giờ làm việc & Lịch tuần chuẩn
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    Cấu hình giờ định mức chuẩn của nhân sự và các ngày làm việc chính thức trong tuần.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Giờ làm việc chuẩn / tuần (mặc định)
                      </label>
                      <div className="relative">
                        <Input
                          type="number"
                          value={capacity}
                          onChange={(e) => setCapacity(e.target.value)}
                          className="text-xs h-9 font-mono tabular-nums"
                        />
                        <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">
                          giờ / tuần
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Hệ số quản trị dự án (Admin overhead)
                      </label>
                      <Input value="10% (4h / 40h)" disabled className="text-xs h-9 bg-muted/30" />
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Ngày làm việc trong tuần (Workdays)
                    </label>
                    <div className="flex items-center gap-4 flex-wrap text-xs pt-1">
                      {["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"].map((day, i) => (
                        <div key={day} className="flex items-center gap-2">
                          <Checkbox id={`day-${i}`} defaultChecked={i < 5} />
                          <label htmlFor={`day-${i}`} className="cursor-pointer">
                            {day}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Ngưỡng tải nhân sự */}
              <Card className="shadow-xs border-border/80">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-warning" />
                    <CardTitle className="text-sm font-semibold">
                      Ngưỡng phân loại Tải nhân sự (%)
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    Xác định điểm kích hoạt cảnh báo đổi màu trên Heatmap và khuyến nghị cân bằng tải.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-success">
                      Ngưỡng Bình thường (&lt;)
                    </label>
                    <Input
                      type="number"
                      value={normalThreshold}
                      onChange={(e) => setNormalThreshold(e.target.value)}
                      className="text-xs h-9 font-mono tabular-nums"
                    />
                    <span className="text-[10px] text-muted-foreground block">Mặc định: 70%</span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-warning-foreground">
                      Ngưỡng Cao / Đầy (70% - 110%)
                    </label>
                    <Input
                      type="number"
                      value={highThreshold}
                      onChange={(e) => setHighThreshold(e.target.value)}
                      className="text-xs h-9 font-mono tabular-nums"
                    />
                    <span className="text-[10px] text-muted-foreground block">Mặc định: 90%</span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-destructive">
                      Ngưỡng Quá tải (&gt;)
                    </label>
                    <Input
                      type="number"
                      value={overloadThreshold}
                      onChange={(e) => setOverloadThreshold(e.target.value)}
                      className="text-xs h-9 font-mono tabular-nums"
                    />
                    <span className="text-[10px] text-muted-foreground block">Mặc định: 110%</span>
                  </div>
                </CardContent>
              </Card>

              {/* Cấu hình AI Provider */}
              <Card className="shadow-xs border-info/50 bg-info/5">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-info" />
                      <CardTitle className="text-sm font-semibold">
                        Cấu hình Trí tuệ Nhân tạo (AI Agent Provider)
                      </CardTitle>
                    </div>
                    <Badge variant="info" className="text-[10px] px-2 py-0.5">
                      Chỉ Quản trị viên
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Lựa chọn dịch vụ LLM phụ trách phân rã WBS và tự động hóa đề xuất cân bằng tải.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Nhà cung cấp AI (Provider)
                      </label>
                      <Select value={aiProvider} onValueChange={setAiProvider}>
                        <SelectTrigger className="h-9 text-xs bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Gemini">Google Gemini API (Khuyến nghị)</SelectItem>
                          <SelectItem value="Ollama">Ollama Local (Nội bộ on-premise)</SelectItem>
                          <SelectItem value="OpenAI">OpenAI API (GPT-4o)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Phiên bản mô hình (Model)
                      </label>
                      <Select value={aiModel} onValueChange={setAiModel}>
                        <SelectTrigger className="h-9 text-xs bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gemini-1.5-pro">gemini-1.5-pro (Mặc định)</SelectItem>
                          <SelectItem value="gemini-1.5-flash">gemini-1.5-flash (Tốc độ cao)</SelectItem>
                          <SelectItem value="llama3:8b">llama3:8b (Ollama Local)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Token Usage & Quota */}
                  <div className="p-4 rounded-lg border bg-background space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">
                        Hạn mức Token tháng hiện tại
                      </span>
                      <span className="font-mono tabular-nums text-muted-foreground">
                        {CURRENT_WORKSPACE.aiConfig.tokensUsed.toLocaleString()} /{" "}
                        {Number(monthlyTokenQuota).toLocaleString()} tokens
                      </span>
                    </div>

                    <Progress
                      value={(CURRENT_WORKSPACE.aiConfig.tokensUsed / Number(monthlyTokenQuota)) * 100}
                      className="h-2"
                    />

                    <p className="text-[11px] text-muted-foreground pt-1">
                      Đã sử dụng 42.8% hạn mức tháng. Nếu đạt 100%, hệ thống tự động fallback về Ollama local.
                    </p>
                  </div>
                </CardContent>

                <CardFooter className="pt-0 flex items-center justify-end border-t border-info/20 py-3">
                  <Button type="submit" size="sm" className="gap-1.5 text-xs">
                    <Save className="h-3.5 w-3.5" />
                    Lưu toàn bộ thiết lập
                  </Button>
                </CardFooter>
              </Card>
            </form>
          </TabsContent>
        </Tabs>
      )}

      <StateToggle state={screenState} onChange={setScreenState} />
    </div>
  );
}
