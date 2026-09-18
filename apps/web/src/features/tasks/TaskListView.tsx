"use client";

import * as React from "react";
import {
  Search,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/app/PageHeader";
import { UserAvatar } from "@/components/app/UserAvatar";
import { PriorityBadge } from "@/components/app/PriorityBadge";
import { TaskDetailSheet } from "@/components/app/TaskDetailSheet";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { StateToggle, type ScreenState } from "@/components/app/StateToggle";
import { Skeleton } from "@/components/ui/skeleton";
import { INITIAL_TASKS, type TaskItem } from "@/mocks/tasks";
import { MEMBERS } from "@/mocks/members";
import { statusToVariant } from "@/lib/status";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function TaskListView() {
  const [screenState, setScreenState] = React.useState<ScreenState>("data");
  const [tasks, setTasks] = React.useState<TaskItem[]>(INITIAL_TASKS);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [assigneeFilter, setAssigneeFilter] = React.useState<string>("all");
  const [priorityFilter, setPriorityFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [selectedTask, setSelectedTask] = React.useState<TaskItem | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAssignee =
      assigneeFilter === "all" || t.assigneeId === assigneeFilter;
    const matchesPriority =
      priorityFilter === "all" || t.priority === priorityFilter;
    const matchesStatus =
      statusFilter === "all" || t.status === statusFilter;

    return matchesSearch && matchesAssignee && matchesPriority && matchesStatus;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredTasks.map((t) => t.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkStatusChange = (newStatus: TaskItem["status"]) => {
    setTasks((prev) =>
      prev.map((t) => (selectedIds.includes(t.id) ? { ...t, status: newStatus } : t))
    );
    toast.success(`Đã cập nhật trạng thái cho ${selectedIds.length} công việc`);
    setSelectedIds([]);
  };

  const handleBulkDelete = () => {
    setTasks((prev) => prev.filter((t) => !selectedIds.includes(t.id)));
    toast.success(`Đã xoá ${selectedIds.length} công việc đã chọn`);
    setSelectedIds([]);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Danh sách Công việc Sprint 3"
        description="Bảng tổng hợp chi tiết toàn bộ các task, lọc nâng cao, cập nhật hàng loạt và phân bổ giờ."
        breadcrumbs={[
          { label: "VNPT Dev Team", href: "/workspaces" },
          { label: "SmartTask v1", href: "/projects/ST/dashboard" },
          { label: "Danh sách công việc" },
        ]}
      >
        <span className="text-xs text-muted-foreground tabular-nums">
          Tổng số: <strong className="text-foreground">{filteredTasks.length}</strong> việc
        </span>
      </PageHeader>

      {screenState === "loading" && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-36" />
          </div>
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      )}

      {screenState === "empty" && (
        <EmptyState
          title="Không tìm thấy công việc phù hợp"
          description="Thử xoá bộ lọc hoặc tạo công việc mới để bắt đầu quản lý."
          actionLabel="Đặt lại bộ lọc"
          onAction={() => {
            setSearchQuery("");
            setAssigneeFilter("all");
            setPriorityFilter("all");
            setStatusFilter("all");
            setScreenState("data");
          }}
        />
      )}

      {screenState === "error" && (
        <ErrorState
          code="TASK_VERSION_CONFLICT"
          message="Một số hàng trong danh sách vừa bị chỉnh sửa bởi thành viên khác. Hãy tải lại bảng để tránh ghi đè dữ liệu."
          onRetry={() => setScreenState("data")}
        />
      )}

      {screenState === "data" && (
        <div className="space-y-4">
          {/* Filters Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20 p-3 rounded-lg border border-border/70">
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo mã ST hoặc tiêu đề..."
                  className="pl-8 text-xs h-9 bg-background"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Assignee Filter */}
              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger className="h-8 text-xs w-36 bg-background">
                  <SelectValue placeholder="Người nhận" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả người</SelectItem>
                  {MEMBERS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} ({m.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Priority Filter */}
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="h-8 text-xs w-32 bg-background">
                  <SelectValue placeholder="Ưu tiên" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả ưu tiên</SelectItem>
                  <SelectItem value="URGENT">Khẩn</SelectItem>
                  <SelectItem value="HIGH">Cao</SelectItem>
                  <SelectItem value="MEDIUM">Trung bình</SelectItem>
                  <SelectItem value="LOW">Thấp</SelectItem>
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs w-32 bg-background">
                  <SelectValue placeholder="Trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả cột</SelectItem>
                  <SelectItem value="TODO">Cần làm</SelectItem>
                  <SelectItem value="IN_PROGRESS">Đang làm</SelectItem>
                  <SelectItem value="REVIEW">Review</SelectItem>
                  <SelectItem value="DONE">Hoàn thành</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Bulk Action Bar (Hiển thị khi chọn nhiều hàng) */}
          {selectedIds.length > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary text-primary-foreground text-xs shadow-md animate-in slide-in-from-top-2">
              <span className="font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Đã chọn {selectedIds.length} công việc
              </span>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleBulkStatusChange("DONE")}
                  className="h-7 text-xs"
                >
                  Chuyển Hoàn thành
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleBulkStatusChange("IN_PROGRESS")}
                  className="h-7 text-xs"
                >
                  Chuyển Đang làm
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleBulkDelete}
                  className="h-7 text-xs gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Xoá việc
                </Button>
              </div>
            </div>
          )}

          {/* Task Data Table */}
          <div className="rounded-xl border border-border/80 overflow-hidden bg-card shadow-xs">
            <ScrollArea className="w-full">
              <Table className="min-w-[960px]">
              <TableHeader className="bg-muted/40 text-xs">
                <TableRow>
                  <TableHead className="w-10 text-center">
                    <Checkbox
                      checked={
                        selectedIds.length === filteredTasks.length &&
                        filteredTasks.length > 0
                      }
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-24">Mã thẻ</TableHead>
                  <TableHead className="min-w-[320px]">Tiêu đề công việc</TableHead>
                  <TableHead className="w-28 text-center">Trạng thái</TableHead>
                  <TableHead className="w-28 text-center">Mức ưu tiên</TableHead>
                  <TableHead className="min-w-[150px]">Người thực hiện</TableHead>
                  <TableHead className="w-24 text-right">Ước lượng</TableHead>
                  <TableHead className="w-24 text-right">Thực tế</TableHead>
                  <TableHead className="w-28 text-center">Hạn chót</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="text-xs">
                {filteredTasks.map((task) => (
                  <TableRow
                    key={task.id}
                    onClick={() => {
                      setSelectedTask(task);
                      setSheetOpen(true);
                    }}
                    className={cn(
                      "cursor-pointer hover:bg-muted/50 transition-colors",
                      selectedIds.includes(task.id) && "bg-muted/40"
                    )}
                  >
                    {/* Checkbox */}
                    <TableCell
                      className="text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={selectedIds.includes(task.id)}
                        onCheckedChange={() => handleSelectRow(task.id)}
                      />
                    </TableCell>

                    {/* Code */}
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs font-semibold">
                        {task.code}
                      </Badge>
                    </TableCell>

                    {/* Title & AI / Labels */}
                    <TableCell className="font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        {task.isAiGenerated && (
                          <Badge variant="info" className="gap-1 text-[10px] px-1 py-0 h-4">
                            <Sparkles className="h-2.5 w-2.5" />
                            AI
                          </Badge>
                        )}
                        <span className="line-clamp-1">{task.title}</span>
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="text-center">
                      <Badge variant={statusToVariant(task.status)} className="text-[11px] py-0 px-2 font-normal">
                        {task.status === "TODO" && "Cần làm"}
                        {task.status === "IN_PROGRESS" && "Đang làm"}
                        {task.status === "REVIEW" && "Review"}
                        {task.status === "DONE" && "Hoàn thành"}
                      </Badge>
                    </TableCell>

                    {/* Priority */}
                    <TableCell className="text-center">
                      <PriorityBadge priority={task.priority} />
                    </TableCell>

                    {/* Assignee */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          name={task.assignee.name}
                          avatar={task.assignee.avatar}
                          role={task.assignee.role}
                          initials={task.assignee.initials}
                          isOnline={task.assignee.isOnline}
                          size="sm"
                          showTooltip={false}
                        />
                        <span className="text-xs text-foreground font-medium">
                          {task.assignee.name}
                        </span>
                      </div>
                    </TableCell>

                    {/* Estimate */}
                    <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                      {task.estimateHours}h
                    </TableCell>

                    {/* Actual */}
                    <TableCell className="text-right font-mono tabular-nums font-medium text-foreground">
                      {task.actualHours}h
                    </TableCell>

                    {/* Due Date */}
                    <TableCell className="text-center">
                      <span
                        className={cn(
                          "font-mono text-xs tabular-nums",
                          task.isOverdue && "text-destructive font-semibold"
                        )}
                      >
                        {task.dueDate.split("-").slice(1).reverse().join("/")}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>

          {/* Pagination Footer */}
            <div className="p-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground bg-muted/10">
              <span>Hiển thị 1–{filteredTasks.length} trong tổng số {filteredTasks.length} việc</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled className="h-7 text-xs px-2">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="font-medium text-foreground">Trang 1 / 1</span>
                <Button variant="outline" size="sm" disabled className="h-7 text-xs px-2">
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task Detail Sheet */}
      <TaskDetailSheet
        task={selectedTask}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdateTask={(updated) => {
          setTasks((prev) =>
            prev.map((t) => (t.id === updated.id ? updated : t))
          );
        }}
      />

      <StateToggle state={screenState} onChange={setScreenState} />
    </div>
  );
}
