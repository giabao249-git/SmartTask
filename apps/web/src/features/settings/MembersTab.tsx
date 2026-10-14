"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, FolderPlus, Link2, Loader2, Trash2, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { UserAvatar } from "@/components/app/UserAvatar";
import { api, describeError } from "@/lib/api";
import type { BadgeVariant } from "@/lib/status";
import { useAuth } from "@/lib/auth";
import { qk, useProjects, useWorkspaceMembers } from "@/lib/hooks/queries";
import type { InvitationView, ProjectRole, WorkspaceMemberView, WorkspaceRole } from "@/lib/types";
import { toast } from "sonner";

const ROLES: WorkspaceRole[] = ["ADMIN", "MEMBER", "VIEWER"];
const roleVariant = (r: WorkspaceRole): BadgeVariant =>
  r === "OWNER" ? "default" : r === "ADMIN" ? "info" : r === "VIEWER" ? "outline" : "secondary";

/**
 * Thành viên Workspace & Điều phối Dự án:
 * - Xem toàn bộ nhân sự cấp Workspace.
 * - Hiển thị các dự án từng người đang tham gia.
 * - Hành động nhanh "Gán vào dự án..." đưa nhân sự vào dự án cụ thể ngay tại đây.
 */
export function MembersTab({ workspaceId, canEdit }: { workspaceId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const auth = useAuth();
  const [q, setQ] = React.useState("");
  const members = useWorkspaceMembers(workspaceId);
  const projectsQuery = useProjects(workspaceId);

  const invitations = useQuery({
    queryKey: ["workspaces", workspaceId, "invitations"],
    queryFn: () => api.get<InvitationView[]>(`/workspaces/${workspaceId}/invitations`),
    enabled: canEdit,
  });

  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<WorkspaceRole>("MEMBER");

  // State cho Modal "Gán vào dự án..."
  const [assignUser, setAssignUser] = React.useState<WorkspaceMemberView | null>(null);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>("");
  const [projectRole, setProjectRole] = React.useState<ProjectRole>("MEMBER");

  const onErr = (e: unknown) => {
    const { code, message } = describeError(e);
    toast.error(message, { description: code });
  };

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: WorkspaceRole }) =>
      api.patch<unknown>(`/workspaces/${workspaceId}/members/${userId}`, { role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.members(workspaceId) });
      toast.success("Đã đổi vai trò Workspace");
    },
    onError: onErr,
  });

  const remove = useMutation({
    mutationFn: (userId: string) => api.delete<void>(`/workspaces/${workspaceId}/members/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.members(workspaceId) });
      toast.success("Đã gỡ thành viên khỏi workspace");
    },
    onError: onErr,
  });

  const invite = useMutation({
    mutationFn: () =>
      api.post<InvitationView>(`/workspaces/${workspaceId}/invitations`, {
        email: inviteEmail.trim() || undefined,
        role: inviteRole,
      }),
    onSuccess: (inv) => {
      qc.invalidateQueries({ queryKey: ["workspaces", workspaceId, "invitations"] });
      setInviteEmail("");
      copyLink(inv.token);
    },
    onError: onErr,
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/workspaces/${workspaceId}/invitations/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspaces", workspaceId, "invitations"] });
      toast.success("Đã thu hồi lời mời");
    },
    onError: onErr,
  });

  const assignToProjectMutation = useMutation({
    mutationFn: () =>
      api.post(`/projects/${selectedProjectId}/members`, {
        userIds: [assignUser!.id],
        role: projectRole,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.members(workspaceId) });
      qc.invalidateQueries({ queryKey: qk.projects(workspaceId) });
      if (selectedProjectId) {
        qc.invalidateQueries({ queryKey: qk.project(selectedProjectId) });
      }
      toast.success(`Đã gán ${assignUser?.fullName} vào dự án thành công!`);
      setAssignUser(null);
    },
    onError: onErr,
  });

  const copyLink = (token: string) => {
    const link = `${window.location.origin}/invitations/${token}`;
    navigator.clipboard?.writeText(link).catch(() => undefined);
    toast.success("Đã sao chép link mời", { description: link });
  };

  const list = (members.data ?? []).filter(
    (m) => !q || `${m.fullName} ${m.email}`.toLowerCase().includes(q.toLowerCase())
  );

  // Tính danh sách các dự án khả dụng mà assignUser chưa tham gia
  const assignableProjects = React.useMemo(() => {
    if (!assignUser) return [];
    const userPIds = new Set((assignUser.projects ?? []).map((p) => p.id));
    return (projectsQuery.data ?? []).filter((p) => !userPIds.has(p.id) && p.status === "ACTIVE");
  }, [assignUser, projectsQuery.data]);

  return (
    <div className="space-y-6">
      {/* Modal Gán thành viên vào dự án */}
      <Dialog open={Boolean(assignUser)} onOpenChange={(o) => !o && setAssignUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <FolderPlus className="h-4 w-4 text-primary" />
              <span>Gán nhân sự vào Dự án</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Thêm <strong>{assignUser?.fullName}</strong> vào một dự án Agile cụ thể trong workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <label className="font-medium text-foreground">Chọn dự án tiếp nhận *</label>
              {assignableProjects.length === 0 ? (
                <div className="p-3 rounded border border-border text-xs text-muted-foreground bg-muted/30">
                  Thành viên này đã tham gia tất cả các dự án đang hoạt động trong workspace.
                </div>
              ) : (
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Chọn dự án..." />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.name} ({p.key})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1">
              <label className="font-medium text-foreground">Vai trò trong dự án *</label>
              <Select value={projectRole} onValueChange={(v) => setProjectRole(v as ProjectRole)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBER" className="text-xs">
                    Thành viên (MEMBER)
                  </SelectItem>
                  <SelectItem value="PM" className="text-xs">
                    Trưởng dự án (PM)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAssignUser(null)}
              className="h-8 text-xs"
            >
              Hủy
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!selectedProjectId || assignToProjectMutation.isPending}
              onClick={() => assignToProjectMutation.mutate()}
              className="h-8 text-xs gap-1.5"
            >
              {assignToProjectMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FolderPlus className="h-3.5 w-3.5" />
              )}
              <span>Gán vào dự án</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DANH SÁCH THÀNH VIÊN WORKSPACE */}
      <Card className="border-border/80">
        <CardHeader className="p-4 pb-3 flex-row items-center justify-between space-y-0 gap-2 flex-wrap">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span>Danh bạ Nhân sự Workspace ({members.data?.length ?? "…"} người)</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Toàn bộ nhân sự thuộc Workspace. Bạn có thể xem các dự án từng người đang tham gia và gán họ vào dự án nhanh.
            </CardDescription>
          </div>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Lọc tên/email..."
            className="h-8 text-xs w-52"
          />
        </CardHeader>

        <CardContent className="p-4 pt-0 overflow-x-auto">
          {members.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : members.isError ? (
            <ErrorState
              code={describeError(members.error).code}
              message={describeError(members.error).message}
              onRetry={() => members.refetch()}
            />
          ) : list.length === 0 ? (
            <EmptyState icon={Users} title="Không có thành viên khớp" description="Đổi từ khoá lọc." />
          ) : (
            <Table>
              <TableHeader className="bg-muted/40 text-[11px]">
                <TableRow>
                  <TableHead>Thành viên</TableHead>
                  <TableHead>Phòng / chức danh</TableHead>
                  <TableHead>Vai trò Workspace</TableHead>
                  <TableHead>Các dự án đang tham gia</TableHead>
                  <TableHead>Tham gia</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs divide-y divide-border/40">
                {list.map((m) => {
                  const locked = !canEdit || m.role === "OWNER" || m.id === auth.user?.id;
                  const projects = m.projects ?? [];

                  return (
                    <TableRow key={m.id} className="hover:bg-muted/30">
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-2">
                          <UserAvatar name={m.fullName} avatar={m.avatarUrl ?? undefined} size="sm" />
                          <div>
                            <div className="font-semibold text-foreground flex items-center gap-1.5">
                              <span>{m.fullName}</span>
                              {m.id === auth.user?.id && (
                                <Badge variant="secondary" className="text-[9px] px-1 py-0">
                                  Bạn
                                </Badge>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground">{m.email}</div>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="py-2.5 text-muted-foreground">
                        {[m.department, m.title].filter(Boolean).join(" · ") || "—"}
                      </TableCell>

                      <TableCell className="py-2.5">
                        {locked ? (
                          <Badge variant={roleVariant(m.role)} className="text-[10px] font-mono">
                            {m.role}
                          </Badge>
                        ) : (
                          <Select
                            value={m.role}
                            onValueChange={(v) =>
                              changeRole.mutate({ userId: m.id, role: v as WorkspaceRole })
                            }
                            disabled={changeRole.isPending}
                          >
                            <SelectTrigger className="h-7 text-xs w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map((r) => (
                                <SelectItem key={r} value={r} className="text-xs">
                                  {r}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>

                      <TableCell className="py-2.5">
                        {projects.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[220px]">
                            {projects.map((p) => (
                              <Badge
                                key={p.id}
                                variant={p.role === "PM" ? "default" : "outline"}
                                className="text-[9px] px-1.5 py-0 font-mono gap-1"
                              >
                                <span>{p.key}</span>
                                <span className="opacity-75 font-normal">({p.role})</span>
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">
                            Chưa vào dự án nào
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="font-mono text-muted-foreground py-2.5">
                        {m.joinedAt.slice(0, 10)}
                      </TableCell>

                      <TableCell className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && m.role !== "VIEWER" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setAssignUser(m);
                                const userPIds = new Set((m.projects ?? []).map((p) => p.id));
                                const firstAvail = (projectsQuery.data ?? []).find(
                                  (p) => !userPIds.has(p.id) && p.status === "ACTIVE"
                                );
                                setSelectedProjectId(firstAvail?.id ?? "");
                                setProjectRole("MEMBER");
                              }}
                              className="h-7 text-[11px] gap-1 text-primary hover:text-primary hover:bg-primary/10 px-2"
                              title="Gán nhân sự vào dự án"
                            >
                              <FolderPlus className="h-3 w-3" />
                              <span className="hidden sm:inline">Gán vào dự án</span>
                            </Button>
                          )}

                          {!locked && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                  title="Gỡ khỏi workspace"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Gỡ {m.fullName} khỏi workspace?</AlertDialogTitle>
                                  <AlertDialogDescription className="text-xs">
                                    Họ sẽ mất quyền truy cập vào tất cả dự án trong workspace này. Lịch sử công việc đã giao vẫn được lưu trữ an toàn.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="text-xs">Huỷ</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => remove.mutate(m.id)}
                                    className="bg-destructive hover:bg-destructive/90 text-xs"
                                  >
                                    Gỡ thành viên
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* LỜI MỜI GIA NHẬP WORKSPACE */}
      {canEdit && (
        <Card className="border-border/80">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              <span>Lời mời gia nhập Workspace</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Tạo link mời trực tiếp để gửi cho nhân sự mới tham gia vào Workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <form
              className="flex items-center gap-2 flex-wrap"
              onSubmit={(e) => {
                e.preventDefault();
                invite.mutate();
              }}
            >
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Email nhân sự (tuỳ chọn)..."
                className="h-8 text-xs w-60"
              />
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as WorkspaceRole)}>
                <SelectTrigger className="h-8 text-xs w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="text-xs">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" size="sm" className="h-8 text-xs gap-1.5" disabled={invite.isPending}>
                <Link2 className="h-3.5 w-3.5" /> Tạo link mời
              </Button>
            </form>

            {invitations.isPending ? (
              <Skeleton className="h-16 w-full" />
            ) : invitations.isError ? (
              <ErrorState
                code={describeError(invitations.error).code}
                message={describeError(invitations.error).message}
                onRetry={() => invitations.refetch()}
              />
            ) : invitations.data.length === 0 ? (
              <p className="text-xs text-muted-foreground">Chưa có lời mời nào đang chờ xử lý.</p>
            ) : (
              <Table>
                <TableHeader className="bg-muted/40 text-[11px]">
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Vai trò</TableHead>
                    <TableHead>Hết hạn</TableHead>
                    <TableHead>Người mời</TableHead>
                    <TableHead className="text-right w-20">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs divide-y divide-border/40">
                  {invitations.data.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="py-2">
                        {inv.email ?? <span className="italic text-muted-foreground">Link chung</span>}
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant={roleVariant(inv.role)} className="text-[10px]">
                          {inv.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground py-2">
                        {inv.expiresAt.slice(0, 10)}
                      </TableCell>
                      <TableCell className="text-muted-foreground py-2">
                        {inv.invitedBy?.fullName ?? "—"}
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Sao chép link"
                            onClick={() => copyLink(inv.token)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            title="Thu hồi"
                            onClick={() => revoke.mutate(inv.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
