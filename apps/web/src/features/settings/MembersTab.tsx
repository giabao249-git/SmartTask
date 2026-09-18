"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, Trash2, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { UserAvatar } from "@/components/app/UserAvatar";
import { api, describeError } from "@/lib/api";
import type { BadgeVariant } from "@/lib/status";
import { useAuth } from "@/lib/auth";
import { qk, useWorkspaceMembers } from "@/lib/hooks/queries";
import type { InvitationView, WorkspaceRole } from "@/lib/types";
import { toast } from "sonner";

const ROLES: WorkspaceRole[] = ["ADMIN", "MEMBER", "VIEWER"];
const roleVariant = (r: WorkspaceRole): BadgeVariant => (r === "OWNER" ? "default" : r === "ADMIN" ? "info" : r === "VIEWER" ? "outline" : "secondary");

/** Thành viên & lời mời (UC-05/06): GET/PATCH/DELETE members, GET/POST/DELETE invitations. */
export function MembersTab({ workspaceId, canEdit }: { workspaceId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const auth = useAuth();
  const [q, setQ] = React.useState("");
  const members = useWorkspaceMembers(workspaceId);
  const invitations = useQuery({ queryKey: ["workspaces", workspaceId, "invitations"], queryFn: () => api.get<InvitationView[]>(`/workspaces/${workspaceId}/invitations`), enabled: canEdit });
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<WorkspaceRole>("MEMBER");

  const onErr = (e: unknown) => {
    const { code, message } = describeError(e);
    toast.error(message, { description: code });
  };
  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: WorkspaceRole }) => api.patch<unknown>(`/workspaces/${workspaceId}/members/${userId}`, { role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.members(workspaceId) });
      toast.success("Đã đổi vai");
    },
    onError: onErr,
  });
  const remove = useMutation({
    mutationFn: (userId: string) => api.delete<void>(`/workspaces/${workspaceId}/members/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.members(workspaceId) });
      toast.success("Đã gỡ thành viên");
    },
    onError: onErr,
  });
  const invite = useMutation({
    mutationFn: () => api.post<InvitationView>(`/workspaces/${workspaceId}/invitations`, { email: inviteEmail.trim() || undefined, role: inviteRole }),
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
  const copyLink = (token: string) => {
    const link = `${window.location.origin}/invitations/${token}`;
    navigator.clipboard?.writeText(link).catch(() => undefined);
    toast.success("Đã sao chép link mời", { description: link });
  };

  const list = (members.data ?? []).filter((m) => !q || `${m.fullName} ${m.email}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <Card className="border-border/80">
        <CardHeader className="p-4 pb-2 flex-row items-center justify-between space-y-0 gap-2">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" /> Thành viên ({members.data?.length ?? "…"})
            </CardTitle>
            <CardDescription className="text-xs">OWNER không đổi vai/gỡ ở đây (dùng chuyển quyền sở hữu). Alias & danh tính ở tab Trợ lý AI.</CardDescription>
          </div>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lọc tên/email…" className="h-8 text-xs w-48" />
        </CardHeader>
        <CardContent className="p-4 pt-0 overflow-x-auto">
          {members.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : members.isError ? (
            <ErrorState code={describeError(members.error).code} message={describeError(members.error).message} onRetry={() => members.refetch()} />
          ) : list.length === 0 ? (
            <EmptyState icon={Users} title="Không có thành viên khớp" description="Đổi từ khoá lọc." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Thành viên</TableHead>
                  <TableHead className="text-xs">Phòng / chức danh</TableHead>
                  <TableHead className="text-xs">Vai</TableHead>
                  <TableHead className="text-xs">Tham gia</TableHead>
                  <TableHead className="text-xs w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((m) => {
                  const locked = !canEdit || m.role === "OWNER" || m.id === auth.user?.id;
                  return (
                    <TableRow key={m.id} className="text-xs">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserAvatar name={m.fullName} avatar={m.avatarUrl ?? undefined} size="sm" />
                          <div>
                            <div className="font-medium">{m.fullName}</div>
                            <div className="text-[10px] text-muted-foreground">{m.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{[m.department, m.title].filter(Boolean).join(" · ") || "—"}</TableCell>
                      <TableCell>
                        {locked ? (
                          <Badge variant={roleVariant(m.role)} className="text-[10px]">
                            {m.role}
                          </Badge>
                        ) : (
                          <Select value={m.role} onValueChange={(v) => changeRole.mutate({ userId: m.id, role: v as WorkspaceRole })} disabled={changeRole.isPending}>
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
                      <TableCell className="font-mono text-muted-foreground">{m.joinedAt.slice(0, 10)}</TableCell>
                      <TableCell>
                        {!locked && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Gỡ {m.fullName} khỏi workspace?</AlertDialogTitle>
                                <AlertDialogDescription>Họ mất quyền vào mọi dự án; việc đã giao vẫn giữ lịch sử.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Huỷ</AlertDialogCancel>
                                <AlertDialogAction onClick={() => remove.mutate(m.id)}>Gỡ</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canEdit && (
        <Card className="border-border/80">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Lời mời
            </CardTitle>
            <CardDescription className="text-xs">Không gửi email trong phạm vi đồ án — tạo link rồi tự gửi (Zalo/Slack). Email bỏ trống = link chung.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <form
              className="flex items-center gap-2 flex-wrap"
              onSubmit={(e) => {
                e.preventDefault();
                invite.mutate();
              }}
            >
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email (tuỳ chọn)" className="h-8 text-xs w-56" />
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as WorkspaceRole)}>
                <SelectTrigger className="h-8 text-xs w-28">
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
              <ErrorState code={describeError(invitations.error).code} message={describeError(invitations.error).message} onRetry={() => invitations.refetch()} />
            ) : invitations.data.length === 0 ? (
              <p className="text-xs text-muted-foreground">Chưa có lời mời đang hiệu lực.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">Vai</TableHead>
                    <TableHead className="text-xs">Hết hạn</TableHead>
                    <TableHead className="text-xs">Người mời</TableHead>
                    <TableHead className="text-xs w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.data.map((inv) => (
                    <TableRow key={inv.id} className="text-xs">
                      <TableCell>{inv.email ?? <span className="italic text-muted-foreground">link chung</span>}</TableCell>
                      <TableCell>
                        <Badge variant={roleVariant(inv.role)} className="text-[10px]">
                          {inv.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">{inv.expiresAt.slice(0, 10)}</TableCell>
                      <TableCell className="text-muted-foreground">{inv.invitedBy?.fullName ?? "—"}</TableCell>
                      <TableCell className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Sao chép link" onClick={() => copyLink(inv.token)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Thu hồi" onClick={() => revoke.mutate(inv.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
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
