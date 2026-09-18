"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Plus, Save, Trash2, UserCog, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { UserAvatar } from "@/components/app/UserAvatar";
import { api, describeError } from "@/lib/api";
import { qk, useWorkspaceMembers } from "@/lib/hooks/queries";
import type { MemberAlias, PromptView, WorkspaceMemberView } from "@/lib/types";
import { toast } from "sonner";

const keys = {
  prompt: (ws: string) => ["workspaces", ws, "ai", "prompt"] as const,
  aliases: (ws: string) => ["workspaces", ws, "member-aliases"] as const,
};

/**
 * Cài đặt admin cho Trợ lý AI (docs 12 §4–5): WORKSPACE prompt (chính sách chọn người), bí danh và danh tính
 * thành viên (chức danh/phòng ban/quản lý). Đây là DỮ LIỆU để LLM nhận diện — backend không tự chọn người.
 */
export function AiPolicyView({ workspaceId, canEdit }: { workspaceId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const prompt = useQuery({ queryKey: keys.prompt(workspaceId), queryFn: () => api.get<PromptView>(`/workspaces/${workspaceId}/ai/prompt`) });
  const aliases = useQuery({ queryKey: keys.aliases(workspaceId), queryFn: () => api.get<MemberAlias[]>(`/workspaces/${workspaceId}/member-aliases`) });
  const members = useWorkspaceMembers(workspaceId);
  const [text, setText] = React.useState<string | null>(null);
  const content = text ?? prompt.data?.content ?? "";

  const savePrompt = useMutation({
    mutationFn: (c: string) => api.put<PromptView>(`/workspaces/${workspaceId}/ai/prompt`, { content: c }),
    onSuccess: (p) => {
      qc.setQueryData(keys.prompt(workspaceId), p);
      setText(null);
      toast.success(`Đã lưu WORKSPACE prompt phiên bản ${p.version}`);
    },
    onError: (e) => toast.error(describeError(e).message),
  });
  const addAlias = useMutation({
    mutationFn: (v: { userId: string; alias: string }) => api.post<MemberAlias>(`/workspaces/${workspaceId}/member-aliases`, v),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.aliases(workspaceId) });
      toast.success("Đã thêm bí danh");
    },
    onError: (e) => {
      const { code, message } = describeError(e);
      toast.error(code === "CONFLICT" ? "Bí danh đã tồn tại trong workspace" : message);
    },
  });
  const removeAlias = useMutation({
    mutationFn: (id: string) => api.delete(`/workspaces/${workspaceId}/member-aliases/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.aliases(workspaceId) }),
    onError: (e) => toast.error(describeError(e).message),
  });
  const identity = useMutation({
    mutationFn: (v: { userId: string; department?: string | null; title?: string | null; managerUserId?: string | null }) =>
      api.patch<WorkspaceMemberView>(`/workspaces/${workspaceId}/members/${v.userId}/identity`, { department: v.department, title: v.title, managerUserId: v.managerUserId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.members(workspaceId) });
      toast.success("Đã cập nhật danh tính");
    },
    onError: (e) => toast.error(describeError(e).message),
  });

  return (
    <div className="space-y-4">
      <Card className="border-border/80">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bot className="h-4 w-4 text-info" /> Chính sách chọn người (WORKSPACE prompt)
            </CardTitle>
            {prompt.data && (
              <Badge variant="outline" className="text-[10px] font-mono">
                v{prompt.data.version}
              </Badge>
            )}
          </div>
          <CardDescription className="text-xs">
            Ví dụ: &quot;Khi tên trùng, ưu tiên người cùng phòng ban với người đang chat; khi giao việc ưu tiên cấp dưới trực tiếp; không chắc thì hỏi lại.&quot; Mỗi lần lưu là một phiên bản mới, ghi vào sổ token của các lượt sau.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-3">
          {prompt.isPending ? (
            <Skeleton className="h-32 w-full" />
          ) : prompt.isError ? (
            <ErrorState code={describeError(prompt.error).code} message={describeError(prompt.error).message} onRetry={() => prompt.refetch()} />
          ) : (
            <>
              <Textarea value={content} onChange={(e) => setText(e.target.value)} disabled={!canEdit} className="text-xs min-h-[140px] font-mono" maxLength={8000} placeholder="(chưa có — trợ lý chỉ dùng Master prompt)" />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{content.length}/8000 ký tự</span>
                <Button size="sm" className="h-7 text-xs gap-1.5" disabled={!canEdit || text === null || savePrompt.isPending} onClick={() => savePrompt.mutate(content)}>
                  <Save className="h-3.5 w-3.5" /> Lưu phiên bản mới
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="border-border/80">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Bí danh thành viên
            </CardTitle>
            <CardDescription className="text-xs">&quot;chị Lan&quot;, &quot;Minh BE&quot; — chỉ để AI nhận diện người, không mang chính sách.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-3">
            {canEdit && (
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const alias = String(f.get("alias") ?? "").trim();
                  const userId = String(f.get("userId") ?? "");
                  if (alias && userId) addAlias.mutate({ userId, alias }, { onSuccess: () => e.currentTarget?.reset?.() });
                }}
              >
                <Select name="userId" required>
                  <SelectTrigger className="h-8 text-xs w-44">
                    <SelectValue placeholder="Thành viên" />
                  </SelectTrigger>
                  <SelectContent>
                    {(members.data ?? []).map((m) => (
                      <SelectItem key={m.id} value={m.id} className="text-xs">
                        {m.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input name="alias" placeholder="Bí danh" className="h-8 text-xs" required maxLength={60} />
                <Button type="submit" size="sm" className="h-8 text-xs gap-1" disabled={addAlias.isPending}>
                  <Plus className="h-3.5 w-3.5" /> Thêm
                </Button>
              </form>
            )}
            {aliases.isPending ? (
              <Skeleton className="h-24 w-full" />
            ) : aliases.isError ? (
              <ErrorState code={describeError(aliases.error).code} message={describeError(aliases.error).message} onRetry={() => aliases.refetch()} />
            ) : aliases.data.length === 0 ? (
              <EmptyState title="Chưa có bí danh" description="Thêm cách gọi quen thuộc để AI đối chiếu đúng người." className="py-6" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Bí danh</TableHead>
                    <TableHead className="text-xs">Thành viên</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aliases.data.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs font-medium">&quot;{a.alias}&quot;</TableCell>
                      <TableCell className="text-xs">{a.user?.fullName ?? a.userId}</TableCell>
                      <TableCell>
                        {canEdit && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeAlias.mutate(a.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <UserCog className="h-4 w-4 text-primary" /> Danh tính thành viên
            </CardTitle>
            <CardDescription className="text-xs">Chức danh · phòng ban · quản lý trực tiếp — vào khối DANH TÍNH của prompt.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            {members.isPending ? (
              <Skeleton className="h-24 w-full" />
            ) : members.isError ? (
              <ErrorState code={describeError(members.error).code} message={describeError(members.error).message} onRetry={() => members.refetch()} />
            ) : (
              <div className="space-y-2">
                {members.data.map((m) => (
                  <IdentityRow key={m.id} member={m} members={members.data} canEdit={canEdit} saving={identity.isPending} onSave={(v) => identity.mutate({ userId: m.id, ...v })} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function IdentityRow({ member: m, members, canEdit, saving, onSave }: { member: WorkspaceMemberView; members: WorkspaceMemberView[]; canEdit: boolean; saving: boolean; onSave: (v: { department: string | null; title: string | null; managerUserId: string | null }) => void }) {
  const [title, setTitle] = React.useState(m.title ?? "");
  const [department, setDepartment] = React.useState(m.department ?? "");
  const [manager, setManager] = React.useState(m.managerUserId ?? "__none");
  const dirty = title !== (m.title ?? "") || department !== (m.department ?? "") || manager !== (m.managerUserId ?? "__none");
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 rounded-lg border border-border/60 bg-muted/20">
      <div className="flex items-center gap-2 w-40 shrink-0">
        <UserAvatar name={m.fullName} avatar={m.avatarUrl ?? undefined} role={m.role} size="sm" />
        <div className="truncate">
          <div className="text-xs font-medium truncate">{m.fullName}</div>
          <div className="text-[10px] text-muted-foreground">{m.role}</div>
        </div>
      </div>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Chức danh" disabled={!canEdit} className="h-8 text-xs" maxLength={80} />
      <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Phòng ban" disabled={!canEdit} className="h-8 text-xs" maxLength={80} />
      <Select value={manager} onValueChange={setManager} disabled={!canEdit}>
        <SelectTrigger className="h-8 text-xs sm:w-40">
          <SelectValue placeholder="Quản lý" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none" className="text-xs">
            — không —
          </SelectItem>
          {members
            .filter((x) => x.id !== m.id)
            .map((x) => (
              <SelectItem key={x.id} value={x.id} className="text-xs">
                {x.shortName ?? x.fullName}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      <Button size="sm" variant={dirty ? "default" : "outline"} className="h-8 text-xs" disabled={!canEdit || !dirty || saving} onClick={() => onSave({ title: title || null, department: department || null, managerUserId: manager === "__none" ? null : manager })}>
        Lưu
      </Button>
    </div>
  );
}
