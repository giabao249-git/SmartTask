"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Crown,
  Plus,
  Search,
  ShieldAlert,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ErrorState } from "@/components/app/ErrorState";
import { UserAvatar } from "@/components/app/UserAvatar";
import { api, describeError } from "@/lib/api";
import { useWorkspaceMembers } from "@/lib/hooks/queries";
import type { ProjectDetail, ProjectRole } from "@/lib/types";
import { AddProjectMemberModal } from "@/features/people/AddProjectMemberModal";
import { toast } from "sonner";
import { toastApiError, useInvalidateProject } from "./shared";

/**
 * Quản lý Đội ngũ Thành viên Dự án (Phân định rạch ròi 2 Khu vực):
 * 1. Khu vực 1: Danh Sách Thành viên Đang Trong Dự Án (Project Roster, Phân quyền PM/MEMBER, Gỡ khỏi dự án).
 * 2. Khu vực 2: Tuyển chọn / Gợi ý Nhân sự khả dụng từ Workspace để thêm nhanh vào dự án.
 */
export function ProjectMembersTab({ project }: { project: ProjectDetail }) {
  const invalidate = useInvalidateProject(project.id);
  const wsMembers = useWorkspaceMembers(project.workspaceId);
  const can = project.canManage && project.status === "ACTIVE";

  const [modalOpen, setModalOpen] = React.useState(false);
  const [availableSearch, setAvailableSearch] = React.useState("");

  const currentMembers = React.useMemo(() => project.members ?? [], [project.members]);
  const currentMemberIds = React.useMemo(
    () => new Set(currentMembers.map((m) => m.id)),
    [currentMembers]
  );

  // Gỡ thành viên khỏi dự án (người bị gỡ sẽ mất assignee trong task)
  const removeMutation = useMutation({
    mutationFn: (userId: string) =>
      api.delete(`/projects/${project.id}/members/${userId}`),
    onSuccess: () => {
      invalidate();
      toast.success("Đã gỡ thành viên khỏi dự án");
    },
    onError: toastApiError,
  });

  // Chuyển giao vai trò PM dự án (duy nhất 1 PM)
  const makePmMutation = useMutation({
    mutationFn: (newPmUserId: string) => {
      const updatedMembers = currentMembers.map((m) => ({
        userId: m.id,
        role: (m.id === newPmUserId ? "PM" : "MEMBER") as ProjectRole,
      }));
      return api.put(`/projects/${project.id}/members`, { members: updatedMembers });
    },
    onSuccess: () => {
      invalidate();
      toast.success("Đã bổ nhiệm Trưởng dự án (PM) mới thành công!");
    },
    onError: toastApiError,
  });

  // Thêm nhanh 1 thành viên từ Workspace vào dự án
  const quickAddMutation = useMutation({
    mutationFn: (userId: string) =>
      api.post(`/projects/${project.id}/members`, {
        userIds: [userId],
        role: "MEMBER",
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Đã thêm thành viên vào dự án!");
    },
    onError: toastApiError,
  });

  // Danh sách thành viên workspace chưa vào dự án (và không phải VIEWER)
  const availableWorkspaceMembers = React.useMemo(() => {
    return (wsMembers.data ?? []).filter(
      (m) => !currentMemberIds.has(m.id) && m.role !== "VIEWER"
    );
  }, [wsMembers.data, currentMemberIds]);

  const filteredAvailable = React.useMemo(() => {
    const q = availableSearch.trim().toLowerCase();
    if (!q) return availableWorkspaceMembers;
    return availableWorkspaceMembers.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.department && m.department.toLowerCase().includes(q)) ||
        (m.title && m.title.toLowerCase().includes(q))
    );
  }, [availableWorkspaceMembers, availableSearch]);

  const currentPm = currentMembers.find((m) => m.role === "PM");

  return (
    <div className="space-y-6">
      <AddProjectMemberModal
        projectId={project.id}
        workspaceId={project.workspaceId}
        open={modalOpen}
        onOpenChange={setModalOpen}
        existingMemberIds={currentMembers.map((m) => m.id)}
        onSuccess={invalidate}
      />

      {/* KHU VỰC 1: ĐỘI NGŨ DỰ ÁN HIỆN TẠI (PROJECT ROSTER) */}
      <Card className="border-border/80">
        <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">
                Đội ngũ Dự án ({currentMembers.length} người)
              </CardTitle>
              {currentPm && (
                <Badge variant="outline" className="text-[10px] gap-1 font-normal border-primary/40 bg-primary/5">
                  <Crown className="h-3 w-3 text-amber-500 fill-amber-500" />
                  <span>PM: {currentPm.fullName}</span>
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs">
              Các nhân sự chính thức tham gia dự án Agile này. Dự án có duy nhất 1 PM chủ trì.
            </CardDescription>
          </div>

          {can && (
            <Button
              size="sm"
              onClick={() => setModalOpen(true)}
              className="h-8 text-xs gap-1.5 shrink-0"
            >
              <UserPlus className="h-3.5 w-3.5" /> Thêm thành viên từ Workspace
            </Button>
          )}
        </CardHeader>

        <CardContent className="p-4 pt-0">
          <div className="rounded-lg border border-border/70 overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/40 text-[11px]">
                <TableRow>
                  <TableHead>Thành viên</TableHead>
                  <TableHead>Email & Chức danh</TableHead>
                  <TableHead>Vai trò Dự án</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs divide-y divide-border/40">
                {currentMembers.map((m) => {
                  const isPm = m.role === "PM";
                  return (
                    <TableRow key={m.id} className="hover:bg-muted/30">
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar
                            name={m.fullName}
                            avatar={m.avatarUrl ?? undefined}
                            size="sm"
                          />
                          <div>
                            <div className="font-semibold text-foreground flex items-center gap-1.5">
                              <span>{m.fullName}</span>
                              {isPm && (
                                <Crown className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              Tham gia: {m.joinedAt ? m.joinedAt.slice(0, 10) : "Mặc định"}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="py-2.5 text-muted-foreground">
                        <div>{m.email}</div>
                      </TableCell>

                      <TableCell className="py-2.5">
                        {isPm ? (
                          <Badge className="text-[10px] font-semibold bg-primary text-primary-foreground">
                            Trưởng dự án (PM)
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-normal">
                            Thành viên
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isPm && can && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={makePmMutation.isPending}
                                  className="h-7 text-[11px] text-primary hover:text-primary gap-1"
                                >
                                  <Crown className="h-3 w-3" />
                                  <span>Bổ nhiệm PM</span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Chuyển quyền Trưởng dự án (PM) cho {m.fullName}?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription className="text-xs">
                                    Dự án chỉ có duy nhất 1 PM. Nếu bổ nhiệm <strong>{m.fullName}</strong> làm PM,
                                    trưởng dự án hiện tại ({currentPm?.fullName ?? "hiện tại"}) sẽ tự động chuyển thành thành viên thường.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="text-xs">Hủy</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => makePmMutation.mutate(m.id)}
                                    className="text-xs"
                                  >
                                    Xác nhận chuyển PM
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}

                          {!isPm && can && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={removeMutation.isPending}
                                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                  title="Gỡ khỏi dự án"
                                >
                                  <UserMinus className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                                    <ShieldAlert className="h-4 w-4" />
                                    <span>Gỡ {m.fullName} khỏi dự án?</span>
                                  </AlertDialogTitle>
                                  <AlertDialogDescription className="text-xs space-y-2">
                                    <p>
                                      Nhân sự này sẽ bị loại khỏi danh sách dự án. Họ sẽ vẫn giữ tư cách thành viên trong Workspace.
                                    </p>
                                    <p className="font-semibold text-destructive">
                                      Lưu ý: Mọi công việc (tasks) đang được giao cho họ trong dự án này sẽ bị rút assignee để tránh sai lệch tiến độ.
                                    </p>
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="text-xs">Hủy</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => removeMutation.mutate(m.id)}
                                    className="bg-destructive hover:bg-destructive/90 text-xs"
                                  >
                                    Gỡ thành viên
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}

                          {isPm && (
                            <span className="text-[11px] text-muted-foreground italic px-2">
                              PM chủ trì
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* KHU VỰC 2: NHÂN SỰ KHẢ DỤNG TỪ WORKSPACE */}
      {can && (
        <Card className="border-border/80 bg-muted/20">
          <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <CardTitle className="text-sm font-semibold">
                  Nhân sự Workspace khả dụng ({availableWorkspaceMembers.length} người)
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                Các thành viên thuộc Workspace chưa tham gia dự án này. Bấm &quot;+ Thêm&quot; để đưa vào đội ngũ ngay lập tức.
              </CardDescription>
            </div>

            {availableWorkspaceMembers.length > 3 && (
              <div className="relative w-52 shrink-0">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={availableSearch}
                  onChange={(e) => setAvailableSearch(e.target.value)}
                  placeholder="Lọc nhân sự..."
                  className="h-8 pl-8 text-xs bg-background"
                />
              </div>
            )}
          </CardHeader>

          <CardContent className="p-4 pt-0">
            {wsMembers.isPending ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : wsMembers.isError ? (
              <ErrorState
                code={describeError(wsMembers.error).code}
                message={describeError(wsMembers.error).message}
                onRetry={() => wsMembers.refetch()}
              />
            ) : availableWorkspaceMembers.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground border border-dashed border-border/80 rounded-lg">
                Toàn bộ nhân sự của Workspace đã tham gia vào dự án này.
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {filteredAvailable.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border/70 bg-card hover:border-primary/40 transition-colors gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <UserAvatar
                        name={m.fullName}
                        avatar={m.avatarUrl ?? undefined}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-foreground truncate">
                          {m.fullName}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {[m.department, m.title].filter(Boolean).join(" · ") || m.email}
                        </div>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={quickAddMutation.isPending}
                      onClick={() => quickAddMutation.mutate(m.id)}
                      className="h-7 text-xs px-2 gap-1 shrink-0 border-primary/30 text-primary hover:bg-primary/10"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Thêm</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
