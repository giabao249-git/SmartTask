"use client";

import * as React from "react";
import Link from "next/link";
import {
  Plus,
  UserPlus,
  Calendar,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/app/PageHeader";
import { UserAvatar } from "@/components/app/UserAvatar";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { StateToggle, type ScreenState } from "@/components/app/StateToggle";
import { Skeleton } from "@/components/ui/skeleton";
import { CURRENT_WORKSPACE, MEMBERS } from "@/mocks/members";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function WorkspacesPage() {
  const [screenState, setScreenState] = React.useState<ScreenState>("data");
  const [newProjectOpen, setNewProjectOpen] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    setNewProjectOpen(false);
    toast.success("Đã khởi tạo dự án mới thành công!");
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setInviteOpen(false);
    toast.success(`Đã gửi lời mời tham gia workspace tới ${inviteEmail}`);
    setInviteEmail("");
  };

  const projects = [
    {
      id: "proj-1",
      key: "ST",
      name: "SmartTask v1",
      description: "Nền tảng quản trị dự án Agile/Kanban thời gian thực, cân bằng tải nhân sự theo ma trận kỹ năng.",
      sprint: "Sprint 3 · 23/10–29/10",
      status: "active",
      taskCount: 18,
      progress: 52,
      members: MEMBERS,
    },
    {
      id: "proj-2",
      key: "CRM",
      name: "Hệ thống Quản lý Khách hàng VNPT CRM",
      description: "Cổng thông tin tra cứu hợp đồng, tích hợp tổng đài hỗ trợ và phân tích hành vi thuê bao.",
      sprint: "Sprint 14 · Hoàn thành",
      status: "completed",
      taskCount: 42,
      progress: 100,
      members: [MEMBERS[0], MEMBERS[1], MEMBERS[3]],
    },
    {
      id: "proj-3",
      key: "PAY",
      name: "VNPT Pay Gateway SDK",
      description: "Bộ thư viện tích hợp thanh toán mã QR và thẻ nội địa dành cho đối tác e-Commerce.",
      sprint: "Lập kế hoạch Q4/2026",
      status: "planning",
      taskCount: 12,
      progress: 15,
      members: [MEMBERS[0], MEMBERS[1], MEMBERS[4]],
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Không gian làm việc & Dự án"
        description="Quản trị các dự án Agile và phân quyền thành viên trong workspace VNPT Dev Team."
        breadcrumbs={[
          { label: "Workspace VNPT", href: "/workspaces" },
          { label: "Danh sách dự án" },
        ]}
      >
        <div className="flex items-center gap-2">
          {/* Invite Member Dialog */}
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <UserPlus className="h-3.5 w-3.5" />
                Mời thành viên
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold">Mời thành viên mới</DialogTitle>
                <DialogDescription className="text-xs">
                  Gửi lời mời tham gia workspace {CURRENT_WORKSPACE.name}.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleInvite} className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Email người dùng</label>
                  <Input
                    type="email"
                    placeholder="dongnghiep@vnpt.vn"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="text-xs h-9"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Vai trò trong Workspace</label>
                  <Select defaultValue="DEV">
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DEV">Lập trình viên (Developer)</SelectItem>
                      <SelectItem value="QA">Kiểm thử viên (QA)</SelectItem>
                      <SelectItem value="PM">Quản lý dự án (Project Manager)</SelectItem>
                      <SelectItem value="VIEWER">Chỉ xem (Viewer)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" size="sm" onClick={() => setInviteOpen(false)}>
                    Hủy
                  </Button>
                  <Button type="submit" size="sm">
                    Gửi thư mời
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Create Project Dialog */}
          <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Tạo dự án mới
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold">Khởi tạo Dự án Agile</DialogTitle>
                <DialogDescription className="text-xs">
                  Định nghĩa thông tin dự án, tiền tố mã thẻ và chỉ định PM điều phối.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateProject} className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Tên dự án</label>
                  <Input placeholder="Ví dụ: SmartTask v2" className="text-xs h-9" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Mã dự án (Key)</label>
                    <Input placeholder="ST2" className="text-xs h-9 font-mono uppercase" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Quản lý dự án (PM)</label>
                    <Select defaultValue="lan">
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lan">Lan (PM)</SelectItem>
                        <SelectItem value="minh">Minh (Tech Lead)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Mô tả mục tiêu</label>
                  <Textarea placeholder="Mô tả phạm vi và thời gian triển khai..." className="text-xs min-h-[60px]" />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" size="sm" onClick={() => setNewProjectOpen(false)}>
                    Hủy
                  </Button>
                  <Button type="submit" size="sm">
                    Tạo dự án
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      {screenState === "loading" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-full rounded-xl" />
          ))}
        </div>
      )}

      {screenState === "empty" && (
        <EmptyState
          title="Chưa có dự án nào trong workspace"
          description="Bắt đầu bằng cách tạo dự án Agile đầu tiên để quản lý công việc và phân bổ tải nhóm."
          actionLabel="Tạo dự án mới"
          onAction={() => setScreenState("data")}
        />
      )}

      {screenState === "error" && (
        <ErrorState
          code="WORKSPACE_SLUG_TAKEN"
          message="Không thể tải danh sách dự án do phiên làm việc workspace không hợp lệ."
          onRetry={() => setScreenState("data")}
        />
      )}

      {screenState === "data" && (
        <div className="space-y-6">
          {/* Workspace Info Card */}
          <Card className="border-border/80 bg-muted/20 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                  VN
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground text-sm">
                      {CURRENT_WORKSPACE.name}
                    </h3>
                    <Badge variant="outline" className="text-[10px] font-medium">
                      Gói {CURRENT_WORKSPACE.plan}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {CURRENT_WORKSPACE.memberCount} thành viên · Giờ làm chuẩn: 40h/tuần · Lịch làm: T2–T6
                  </p>
                </div>
              </div>

              <div className="flex items-center -space-x-1.5">
                {MEMBERS.map((m) => (
                  <UserAvatar
                    key={m.id}
                    name={m.name}
                    avatar={m.avatar}
                    role={m.role}
                    initials={m.initials}
                    isOnline={m.isOnline}
                    workloadPercent={m.utilization}
                    size="sm"
                  />
                ))}
              </div>
            </div>
          </Card>

          {/* Project Grid Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((proj) => (
              <Card
                key={proj.id}
                className={cn(
                  "flex flex-col justify-between transition-all hover:border-primary/50 hover:shadow-md border-border/80 bg-card",
                  proj.status === "active" && "ring-1 ring-primary/20"
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <Badge variant="outline" className="font-mono text-xs font-semibold px-2">
                      {proj.key}
                    </Badge>
                    {proj.status === "active" ? (
                      <Badge variant="success" className="text-[10px] py-0 px-2">
                        Đang diễn ra
                      </Badge>
                    ) : proj.status === "completed" ? (
                      <Badge variant="secondary" className="text-[10px] py-0 px-2">
                        Đã đóng gói
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] py-0 px-2">
                        Chuẩn bị
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-base font-semibold text-foreground">
                    {proj.name}
                  </CardTitle>
                  <CardDescription className="text-xs line-clamp-2 leading-relaxed mt-1">
                    {proj.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3 pt-0">
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/40">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {proj.sprint}
                    </span>
                    <span className="font-mono tabular-nums">{proj.taskCount} công việc</span>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Tiến độ</span>
                      <span className="font-mono tabular-nums font-medium text-foreground">
                        {proj.progress}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          proj.progress === 100 ? "bg-success" : "bg-primary"
                        )}
                        style={{ width: `${proj.progress}%` }}
                      />
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="pt-3 border-t border-border/40 flex items-center justify-between bg-muted/10">
                  <div className="flex items-center -space-x-1.5">
                    {proj.members.map((m) => (
                      <UserAvatar
                        key={m.id}
                        name={m.name}
                        avatar={m.avatar}
                        role={m.role}
                        initials={m.initials}
                        size="sm"
                        showTooltip={false}
                      />
                    ))}
                  </div>

                  <Button asChild size="sm" variant="ghost" className="text-xs gap-1 hover:text-primary">
                    <Link href={`/projects/${proj.key}/dashboard`}>
                      <span>Mở dự án</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}

      <StateToggle state={screenState} onChange={setScreenState} />
    </div>
  );
}
