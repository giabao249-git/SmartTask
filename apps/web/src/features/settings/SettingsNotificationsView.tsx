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
  Users,
  UserCheck,
  Plus,
  Trash2,
  Tag,
  Briefcase,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageHeader } from "@/components/app/PageHeader";
import { UserAvatar } from "@/components/app/UserAvatar";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { StateToggle, type ScreenState } from "@/components/app/StateToggle";
import { Skeleton } from "@/components/ui/skeleton";
import { MOCK_NOTIFICATIONS, type NotificationItem } from "@/mocks/notifications";
import {
  CURRENT_WORKSPACE,
  MEMBERS,
  INITIAL_MEMBER_ALIASES,
  WORKSPACE_AI_POLICY,
  type Member,
  type MemberAlias,
} from "@/mocks/members";
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

  // WORKSPACE prompt policy & Member Aliases state
  const [aiPolicyText, setAiPolicyText] = React.useState(WORKSPACE_AI_POLICY);
  const [aliases, setAliases] = React.useState<MemberAlias[]>(INITIAL_MEMBER_ALIASES);
  const [membersList, setMembersList] = React.useState<Member[]>(MEMBERS);

  // New Alias Dialog state
  const [addAliasOpen, setAddAliasOpen] = React.useState(false);
  const [newAliasText, setNewAliasText] = React.useState("");
  const [newAliasUserId, setNewAliasUserId] = React.useState("user-lan");

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success("Đã đánh dấu tất cả thông báo là đã đọc");
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Đã lưu cấu hình Workspace & Tham số AI thành công");
  };

  const handleSaveAiPolicy = () => {
    toast.success("Đã cập nhật Chính sách chọn người (WORKSPACE prompt) thành công!");
  };

  const handleAddAlias = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAliasText.trim()) return;

    const targetMember = membersList.find((m) => m.id === newAliasUserId);
    const newEntry: MemberAlias = {
      id: `alias-${Date.now()}`,
      alias: newAliasText.trim(),
      userId: newAliasUserId,
      userName: targetMember ? targetMember.name : "Thành viên",
      department: targetMember?.department || "Phòng Phát triển",
      role: targetMember?.role || "Member",
      createdBy: "Admin (Lan)",
    };

    setAliases((prev) => [...prev, newEntry]);
    setNewAliasText("");
    setAddAliasOpen(false);
    toast.success(`Đã thêm alias "${newEntry.alias}" cho ${newEntry.userName}`);
  };

  const handleDeleteAlias = (aliasId: string) => {
    setAliases((prev) => prev.filter((a) => a.id !== aliasId));
    toast.info("Đã xoá bí danh (alias) thành viên");
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
        description="Quản lý lịch sử thông báo realtime, chính sách chọn người của AI, bí danh thành viên và tham số hệ thống."
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
          <TabsList className="grid w-full sm:w-[480px] grid-cols-3">
            <TabsTrigger value="notifications" className="text-xs gap-1.5">
              <Bell className="h-3.5 w-3.5" />
              Thông báo ({unreadCount})
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs gap-1.5">
              <Settings className="h-3.5 w-3.5" />
              Cấu hình AI & Hệ thống
            </TabsTrigger>
            <TabsTrigger value="members" className="text-xs gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Thành viên & Alias
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

          {/* TAB 2: Cài đặt Workspace & AI Policy */}
          <TabsContent value="settings" className="space-y-6">
            <form onSubmit={handleSaveSettings} className="space-y-6">
              {/* Card 1: Chính sách chọn người (WORKSPACE prompt) */}
              <Card className="shadow-xs border-info/50 bg-info/5">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-info" />
                      <CardTitle className="text-sm font-semibold">
                        Chính sách chọn người (WORKSPACE prompt)
                      </CardTitle>
                    </div>
                    <Badge variant="info" className="text-[10px] px-2 py-0.5 font-mono">
                      ai_prompt_configs · WORKSPACE
                    </Badge>
                  </div>
                  <CardDescription className="text-xs leading-relaxed">
                    Chính sách hệ thống để LLM suy luận phân bổ nhiệm vụ khi có sự mập mờ, viết tắt hoặc trùng tên thành viên trong nhóm.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground flex items-center justify-between">
                      <span>Nội dung chỉ dẫn phân bổ công việc (System Policy)</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {aiPolicyText.length} ký tự
                      </span>
                    </label>
                    <Textarea
                      value={aiPolicyText}
                      onChange={(e) => setAiPolicyText(e.target.value)}
                      rows={3}
                      className="text-xs font-mono bg-background leading-relaxed"
                      placeholder="Nhập quy tắc chọn người của workspace..."
                    />
                  </div>
                  <div className="p-2.5 rounded-lg border border-info/30 bg-background/70 text-[11px] text-muted-foreground space-y-1">
                    <span className="font-semibold text-foreground flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-info" />
                      Quy tắc bất biến:
                    </span>
                    <p>
                      Backend cung cấp dữ liệu DANH TÍNH (phòng ban, chức danh, quản lý, alias). LLM tự suy luận theo chính sách này. Nếu độ tự tin thấp hoặc có xung đột, LLM bắt buộc gọi <code>ASK_CLARIFICATION</code> để hỏi lại người dùng.
                    </p>
                  </div>
                </CardContent>
                <CardFooter className="pt-0 flex items-center justify-end border-t border-info/20 py-3">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveAiPolicy}
                    className="gap-1.5 text-xs bg-info hover:bg-info/90 text-info-foreground"
                  >
                    <Save className="h-3.5 w-3.5" />
                    Cập nhật chính sách AI
                  </Button>
                </CardFooter>
              </Card>

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
              <Card className="shadow-xs border-border/80">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-primary" />
                      <CardTitle className="text-sm font-semibold">
                        Cấu hình Trí tuệ Nhân tạo (AI Agent Provider)
                      </CardTitle>
                    </div>
                    <Badge variant="outline" className="text-[10px] px-2 py-0.5">
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

                <CardFooter className="pt-0 flex items-center justify-end border-t border-border/40 py-3">
                  <Button type="submit" size="sm" className="gap-1.5 text-xs">
                    <Save className="h-3.5 w-3.5" />
                    Lưu toàn bộ thiết lập
                  </Button>
                </CardFooter>
              </Card>
            </form>
          </TabsContent>

          {/* TAB 3: Thành viên & Bảng Alias định danh */}
          <TabsContent value="members" className="space-y-6">
            {/* Section 1: Alias thành viên */}
            <Card className="shadow-xs border-border/80">
              <CardHeader className="p-4 border-b border-border/60 flex flex-row items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base font-semibold">
                      Bí danh nhận diện (Member Aliases)
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs mt-0.5">
                    Ánh xạ câu xưng hô trong chat (&quot;chị Lan&quot;, &quot;Minh BE&quot;) sang định danh thành viên. Chỉ dùng để nhận diện, không mang quyền hạn.
                  </CardDescription>
                </div>

                {/* Add Alias Dialog */}
                <Dialog open={addAliasOpen} onOpenChange={setAddAliasOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1.5 text-xs">
                      <Plus className="h-3.5 w-3.5" />
                      Thêm Alias
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-base font-semibold">Thêm bí danh thành viên</DialogTitle>
                      <DialogDescription className="text-xs">
                        Đăng ký từ khoá hoặc tên gọi ngắn mà nhóm thường dùng khi chat với AI.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddAlias} className="space-y-4 py-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                          Bí danh / Tên gọi tắt (Alias)
                        </label>
                        <Input
                          placeholder="Ví dụ: Bảo QA, em An, anh Minh..."
                          value={newAliasText}
                          onChange={(e) => setNewAliasText(e.target.value)}
                          className="text-xs h-9"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                          Thành viên đại diện
                        </label>
                        <Select value={newAliasUserId} onValueChange={setNewAliasUserId}>
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {membersList.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.name} ({m.role}) · {m.department}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setAddAliasOpen(false)}
                        >
                          Huỷ
                        </Button>
                        <Button type="submit" size="sm">
                          Lưu bí danh
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>

              <ScrollArea className="w-full">
                <Table className="min-w-[680px]">
                  <TableHeader className="bg-muted/40 text-xs">
                    <TableRow>
                      <TableHead className="w-36">Bí danh (Alias)</TableHead>
                      <TableHead className="min-w-[160px]">Thành viên đích</TableHead>
                      <TableHead className="w-40">Phòng ban</TableHead>
                      <TableHead className="w-28">Vai trò</TableHead>
                      <TableHead className="w-28">Người tạo</TableHead>
                      <TableHead className="w-16 text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {aliases.map((item) => (
                      <TableRow key={item.id} className="hover:bg-muted/30">
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs font-semibold px-2 py-0.5">
                            {item.alias}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <UserAvatar
                              name={item.userName}
                              role={item.role as any}
                              initials={item.userName.slice(0, 2).toUpperCase()}
                              size="sm"
                            />
                            <span className="font-medium text-foreground">{item.userName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{item.department}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {item.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-[11px]">{item.createdBy}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteAlias(item.id)}
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            title="Xoá alias"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>

            {/* Section 2: Danh sách thành viên Workspace (Phòng ban, Chức danh, Quản lý) */}
            <Card className="shadow-xs border-border/80">
              <CardHeader className="p-4 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base font-semibold">
                    Danh sách nhân sự & Cấu trúc báo cáo ({membersList.length})
                  </CardTitle>
                </div>
                <CardDescription className="text-xs mt-0.5">
                  Thông tin phòng ban, chức danh và người quản lý trực tiếp phục vụ thuật toán suy luận và phân bổ công việc của AI.
                </CardDescription>
              </CardHeader>

              <ScrollArea className="w-full">
                <Table className="min-w-[860px]">
                  <TableHeader className="bg-muted/40 text-xs">
                    <TableRow>
                      <TableHead className="min-w-[200px]">Thành viên</TableHead>
                      <TableHead className="w-40">Phòng ban</TableHead>
                      <TableHead className="w-48">Chức danh (Title)</TableHead>
                      <TableHead className="w-40">Quản lý trực tiếp</TableHead>
                      <TableHead className="w-32 text-center">Tải tuần</TableHead>
                      <TableHead className="w-32">Bí danh gắn kèm</TableHead>
                      <TableHead className="w-24 text-center">Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {membersList.map((m) => (
                      <TableRow key={m.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <UserAvatar
                              name={m.name}
                              role={m.role}
                              initials={m.initials}
                              isOnline={m.isOnline}
                              size="sm"
                            />
                            <div className="space-y-0.5">
                              <p className="font-semibold text-foreground text-xs">{m.name}</p>
                              <p className="text-[10px] text-muted-foreground">{m.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {m.department || "Phòng Phát triển"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {m.title || `${m.role} Engineer`}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-foreground font-medium">
                            {m.managerName || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={cn(
                              "font-mono tabular-nums font-semibold px-2 py-0.5 rounded text-xs",
                              m.utilization > 110
                                ? "bg-destructive/10 text-destructive"
                                : m.utilization >= 90
                                ? "bg-warning/10 text-warning-foreground"
                                : "bg-success/10 text-success"
                            )}
                          >
                            {m.utilization}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 flex-wrap">
                            {m.aliases && m.aliases.length > 0 ? (
                              m.aliases.map((al) => (
                                <Badge key={al} variant="secondary" className="text-[9px] px-1 py-0">
                                  {al}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-[10px] text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={m.isOnline ? "success" : "secondary"}
                            className="text-[10px] px-1.5 py-0"
                          >
                            {m.isOnline ? "Online" : "Vắng mặt"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <StateToggle state={screenState} onChange={setScreenState} />
    </div>
  );
}
