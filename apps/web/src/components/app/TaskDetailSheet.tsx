"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PriorityBadge } from "./PriorityBadge";
import { UserAvatar } from "./UserAvatar";
import { WorkloadBadge } from "./WorkloadBadge";
import { MEMBERS, type Member } from "@/mocks/members";
import { type TaskItem } from "@/mocks/tasks";
import { statusToVariant, type TaskStatus, type PriorityLevel } from "@/lib/status";
import {
  Calendar,
  Clock,
  Sparkles,
  CheckSquare,
  Link as LinkIcon,
  Paperclip,
  Send,
  UserCheck,
  ChevronsUpDown,
  History,
  MessageSquare,
  Plus,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TaskDetailSheetProps {
  task: TaskItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateTask?: (updatedTask: TaskItem) => void;
}

export function TaskDetailSheet({
  task,
  open,
  onOpenChange,
  onUpdateTask,
}: TaskDetailSheetProps) {
  if (!task) return null;

  const [title, setTitle] = React.useState(task.title);
  const [description, setDescription] = React.useState(task.description);
  const [status, setStatus] = React.useState<TaskStatus>(task.status);
  const [priority, setPriority] = React.useState<PriorityLevel>(task.priority);
  const [assigneeId, setAssigneeId] = React.useState(task.assigneeId);
  const [estimateHours, setEstimateHours] = React.useState(task.estimateHours);
  const [actualHours, setActualHours] = React.useState(task.actualHours);
  const [subtasks, setSubtasks] = React.useState(task.subtasks);
  const [comments, setComments] = React.useState(task.comments);
  const [newComment, setNewComment] = React.useState("");
  const [newSubtaskTitle, setNewSubtaskTitle] = React.useState("");
  const [assigneeOpen, setAssigneeOpen] = React.useState(false);

  // Sync state when task changes
  React.useEffect(() => {
    setTitle(task.title);
    setDescription(task.description);
    setStatus(task.status);
    setPriority(task.priority);
    setAssigneeId(task.assigneeId);
    setEstimateHours(task.estimateHours);
    setActualHours(task.actualHours);
    setSubtasks(task.subtasks);
    setComments(task.comments);
  }, [task]);

  const currentAssignee = MEMBERS.find((m) => m.id === assigneeId) || task.assignee;

  const handleToggleSubtask = (id: string) => {
    const next = subtasks.map((s) =>
      s.id === id ? { ...s, completed: !s.completed } : s
    );
    setSubtasks(next);
    toast.success("Đã cập nhật tiến độ công việc con");
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    const item = {
      id: `st-new-${Date.now()}`,
      title: newSubtaskTitle.trim(),
      completed: false,
    };
    setSubtasks([...subtasks, item]);
    setNewSubtaskTitle("");
    toast.success("Đã thêm công việc con mới");
  };

  const handleSendComment = () => {
    if (!newComment.trim()) return;
    const comment = {
      id: `c-${Date.now()}`,
      authorId: "user-lan",
      authorName: "Lan",
      authorRole: "PM",
      content: newComment.trim(),
      createdAt: "Vừa xong",
    };
    setComments([...comments, comment]);
    setNewComment("");
    toast.success("Đã gửi bình luận");
  };

  const handleAssigneeChange = (member: Member) => {
    setAssigneeId(member.id);
    setAssigneeOpen(false);
    toast.success(`Đã giao việc cho ${member.name} (Tải hiện tại: ${member.utilization}%)`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 flex flex-col h-full bg-background border-l border-border"
      >
        {/* Header Bar */}
        <div className="p-6 pb-4 border-b border-border/60">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs font-semibold px-2 py-0.5">
                {task.code}
              </Badge>
              {task.isAiGenerated && (
                <Badge variant="info" className="gap-1 text-xs">
                  <Sparkles className="h-3 w-3" />
                  Nguồn AI Agent
                </Badge>
              )}
              {task.isOverdue && (
                <Badge variant="destructive" className="gap-1 text-xs">
                  <AlertTriangle className="h-3 w-3" />
                  Quá hạn
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{task.sprint}</span>
          </div>

          {/* Inline Title Editing */}
          <SheetHeader className="text-left space-y-1">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-lg font-semibold border-transparent hover:border-input focus-visible:border-primary px-2 -mx-2 h-auto py-1 shadow-none transition-all"
              placeholder="Nhập tiêu đề công việc..."
            />
            <SheetDescription className="text-xs text-muted-foreground px-0">
              Chỉnh sửa thông tin, phân công nhân sự và trao đổi tiến độ realtime.
            </SheetDescription>
          </SheetHeader>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4 rounded-lg border p-4 bg-muted/20">
            {/* Status */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Trạng thái</label>
              <Select value={status} onValueChange={(val) => setStatus(val as TaskStatus)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODO">Cần làm</SelectItem>
                  <SelectItem value="IN_PROGRESS">Đang làm</SelectItem>
                  <SelectItem value="REVIEW">Review</SelectItem>
                  <SelectItem value="DONE">Hoàn thành</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Mức ưu tiên</label>
              <Select value={priority} onValueChange={(val) => setPriority(val as PriorityLevel)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Thấp</SelectItem>
                  <SelectItem value="MEDIUM">Trung bình</SelectItem>
                  <SelectItem value="HIGH">Cao</SelectItem>
                  <SelectItem value="URGENT">Khẩn</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Assignee Combobox with Workload Note */}
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Người thực hiện (Kèm tải tuần)
              </label>
              <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={assigneeOpen}
                    className="w-full justify-between h-9 px-3 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <UserAvatar
                        name={currentAssignee.name}
                        avatar={currentAssignee.avatar}
                        initials={currentAssignee.initials}
                        isOnline={currentAssignee.isOnline}
                        showTooltip={false}
                        size="sm"
                      />
                      <span className="font-medium text-foreground">{currentAssignee.name}</span>
                      <span className="text-muted-foreground text-[11px]">({currentAssignee.role})</span>
                      <WorkloadBadge percent={currentAssignee.utilization} className="ml-1" />
                    </div>
                    <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Tìm thành viên trong nhóm..." />
                    <CommandList>
                      <CommandEmpty>Không tìm thấy thành viên</CommandEmpty>
                      <CommandGroup heading="Thành viên dự án VNPT">
                        {MEMBERS.map((member) => (
                          <CommandItem
                            key={member.id}
                            value={member.name}
                            onSelect={() => handleAssigneeChange(member)}
                            className="flex items-center justify-between py-2 cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <UserAvatar
                                name={member.name}
                                avatar={member.avatar}
                                initials={member.initials}
                                isOnline={member.isOnline}
                                showTooltip={false}
                                size="sm"
                              />
                              <div>
                                <p className="text-xs font-medium leading-none">{member.name}</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">{member.role}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <WorkloadBadge percent={member.utilization} />
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Estimates */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Ước lượng (h)
              </label>
              <Input
                type="number"
                value={estimateHours}
                onChange={(e) => setEstimateHours(Number(e.target.value))}
                className="h-8 text-xs font-mono tabular-nums"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Thực tế đã làm (h)
              </label>
              <Input
                type="number"
                value={actualHours}
                onChange={(e) => setActualHours(Number(e.target.value))}
                className="h-8 text-xs font-mono tabular-nums"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Mô tả công việc</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[90px] text-xs leading-relaxed resize-none"
              placeholder="Nhập mô tả chi tiết yêu cầu kỹ thuật..."
            />
          </div>

          {/* Required Skills */}
          {task.requiredSkills && task.requiredSkills.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Kỹ năng yêu cầu
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {task.requiredSkills.map((sk) => (
                  <Badge key={sk.name} variant="secondary" className="gap-1.5 text-xs py-1">
                    <span>{sk.name}</span>
                    <span className="font-mono text-[10px] text-primary bg-primary/10 px-1 rounded-xs">
                      Mức {sk.level}/5
                    </span>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Subtasks Checklist */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <CheckSquare className="h-3.5 w-3.5" />
                Công việc con ({subtasks.filter((s) => s.completed).length}/{subtasks.length})
              </label>
            </div>

            <div className="space-y-1.5 rounded-lg border p-3 bg-card">
              {subtasks.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center gap-2 text-xs py-1 group hover:bg-muted/50 rounded px-1.5 transition-colors"
                >
                  <Checkbox
                    id={sub.id}
                    checked={sub.completed}
                    onCheckedChange={() => handleToggleSubtask(sub.id)}
                  />
                  <label
                    htmlFor={sub.id}
                    className={cn(
                      "flex-1 cursor-pointer select-none",
                      sub.completed && "line-through text-muted-foreground"
                    )}
                  >
                    {sub.title}
                  </label>
                </div>
              ))}

              <div className="flex items-center gap-2 pt-2 mt-1 border-t border-border/40">
                <Input
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  placeholder="Thêm việc con mới..."
                  className="h-7 text-xs"
                  onKeyDown={(e) => e.key === "Enter" && handleAddSubtask()}
                />
                <Button size="sm" variant="secondary" onClick={handleAddSubtask} className="h-7 px-2.5 text-xs">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Dependencies & Attachments */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <LinkIcon className="h-3.5 w-3.5" />
                <span>Phụ thuộc</span>
              </div>
              <div className="flex items-center gap-1 flex-wrap pt-1">
                {task.dependencies.length > 0 ? (
                  task.dependencies.map((dep) => (
                    <Badge key={dep} variant="outline" className="font-mono text-xs">
                      {dep}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">Không có</span>
                )}
              </div>
            </div>

            <div className="rounded-lg border p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Paperclip className="h-3.5 w-3.5" />
                <span>Đính kèm</span>
              </div>
              <p className="text-xs text-muted-foreground pt-1">2 tệp (diagram.png, spec.pdf)</p>
            </div>
          </div>

          {/* Tabs: Comments & Activity */}
          <Tabs defaultValue="comments" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="comments" className="gap-1.5 text-xs">
                <MessageSquare className="h-3.5 w-3.5" />
                Bình luận ({comments.length})
              </TabsTrigger>
              <TabsTrigger value="activity" className="gap-1.5 text-xs">
                <History className="h-3.5 w-3.5" />
                Hoạt động ({task.activities.length})
              </TabsTrigger>
            </TabsList>

            {/* Comments Tab */}
            <TabsContent value="comments" className="space-y-4 pt-3">
              <div className="space-y-3">
                {comments.map((cmt) => (
                  <div key={cmt.id} className="flex items-start gap-2.5 text-xs">
                    <UserAvatar
                      name={cmt.authorName}
                      role={cmt.authorRole}
                      size="sm"
                      showTooltip={false}
                    />
                    <div className="flex-1 rounded-lg border bg-muted/30 p-2.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">
                          {cmt.authorName}{" "}
                          <span className="font-normal text-muted-foreground">({cmt.authorRole})</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground">{cmt.createdAt}</span>
                      </div>
                      <p className="text-foreground leading-relaxed">
                        {cmt.content.split(" ").map((word, i) =>
                          word.startsWith("@") ? (
                            <span key={i} className="font-medium text-primary bg-primary/10 px-1 rounded-xs">
                              {word}{" "}
                            </span>
                          ) : (
                            word + " "
                          )
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Comment Input */}
              <div className="space-y-2 pt-2">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Viết bình luận (@mention thành viên, phím ⌘+Enter để gửi)..."
                  className="min-h-[70px] text-xs resize-none"
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      handleSendComment();
                    }
                  }}
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    Gợi ý: Gõ <kbd className="px-1 py-0.5 rounded bg-muted">@</kbd> để mention
                  </span>
                  <Button size="sm" onClick={handleSendComment} className="h-7 px-3 text-xs gap-1.5">
                    <Send className="h-3 w-3" />
                    Gửi
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Activity Timeline Tab */}
            <TabsContent value="activity" className="space-y-3 pt-3">
              <div className="space-y-3 pl-2 border-l-2 border-border/60">
                {task.activities.map((act) => (
                  <div key={act.id} className="relative pl-3 text-xs space-y-0.5">
                    <span className="absolute -left-[19px] top-1 h-2 w-2 rounded-full bg-primary" />
                    <p className="text-foreground">
                      <span className="font-medium">{act.actor}</span> {act.action}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{act.timestamp}</p>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
