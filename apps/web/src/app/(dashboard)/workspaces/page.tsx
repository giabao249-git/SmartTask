"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, UserPlus, Calendar, ArrowRight, Building2, FolderKanban, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/app/PageHeader";
import { UserAvatar } from "@/components/app/UserAvatar";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { api, describeError } from "@/lib/api";
import { qk, useProjects, useWorkspaceMembers, useWorkspaces } from "@/lib/hooks/queries";
import type { ProjectListItem, WorkspaceListItem } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const fmtDay = (d: string) => {
  const x = new Date(d);
  return `${String(x.getUTCDate()).padStart(2, "0")}/${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
};

export default function WorkspacesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const wsQuery = useWorkspaces();
  const [selectedWsId, setSelectedWsId] = React.useState<string | null>(null);
  const workspaces = React.useMemo(() => wsQuery.data ?? [], [wsQuery.data]);
  const ws = workspaces.find((w) => w.id === selectedWsId) ?? workspaces[0];
  const wsId = ws?.id;
  const projectsQuery = useProjects(wsId);
  const membersQuery = useWorkspaceMembers(wsId);
  const isAdmin = ws?.role === "OWNER" || ws?.role === "ADMIN";

  const [newProjectOpen, setNewProjectOpen] = React.useState(false);
  const [newWsOpen, setNewWsOpen] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);

  const createWs = useMutation({
    mutationFn: (name: string) => api.post<WorkspaceListItem>("/workspaces", { name }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: qk.workspaces });
      setSelectedWsId(created.id);
      setNewWsOpen(false);
      toast.success(`Đã tạo workspace ${created.name} (nạp 30 kỹ năng mẫu)`);
    },
    onError: (e) => toast.error(describeError(e).message),
  });

  const createProject = useMutation({
    mutationFn: (body: { key: string; name: string; description?: string; pmUserId: string }) =>
      api.post<ProjectListItem>(`/workspaces/${wsId}/projects`, body),
    onSuccess: async (p) => {
      await queryClient.invalidateQueries({ queryKey: qk.projects(wsId ?? "") });
      setNewProjectOpen(false);
      toast.success(`Đã tạo dự án ${p.key} — ${p.name}`);
      router.push(`/projects/${p.id}/board`);
    },
    onError: (e) => {
      const { code, message } = describeError(e);
      toast.error(message, { description: code });
    },
  });

  const invite = useMutation({
    mutationFn: (body: { email?: string; role: string }) => api.post<{ token: string; email: string | null }>(`/workspaces/${wsId}/invitations`, body),
    onSuccess: (inv) => {
      const link = `${window.location.origin}/invitations/${inv.token}`;
      setInviteOpen(false);
      toast.success(inv.email ? `Đã tạo lời mời cho ${inv.email}` : "Đã tạo link mời chung (7 ngày)", {
        description: link,
        action: { label: "Chép link", onClick: () => void navigator.clipboard.writeText(link) },
      });
    },
    onError: (e) => toast.error(describeError(e).message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Không gian làm việc & Dự án"
        description={ws ? `Dự án Agile trong workspace ${ws.name} — vai của bạn: ${ws.role}.` : "Chọn hoặc tạo workspace để bắt đầu."}
        breadcrumbs={[{ label: "Workspace" }, { label: "Danh sách dự án" }]}
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setNewWsOpen(true)}>
            <Building2 className="h-3.5 w-3.5" />
            <span>Workspace mới</span>
          </Button>
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setInviteOpen(true)}>
                <UserPlus className="h-3.5 w-3.5" />
                <span>Mời thành viên</span>
              </Button>
              <Button size="sm" className="gap-1.5 text-xs" onClick={() => setNewProjectOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                <span>Tạo dự án mới</span>
              </Button>
            </>
          )}
        </div>
      </PageHeader>

      {/* Workspaces */}
      {wsQuery.isPending ? (
        <Skeleton className="h-20 w-full rounded-xl" />
      ) : wsQuery.isError ? (
        <ErrorState code={describeError(wsQuery.error).code} message={describeError(wsQuery.error).message} onRetry={() => wsQuery.refetch()} />
      ) : workspaces.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Bạn chưa thuộc workspace nào"
          description="Tạo workspace đầu tiên (được nạp sẵn 30 kỹ năng mẫu) hoặc nhận lời mời từ quản trị viên."
          actionLabel="Tạo workspace"
          onAction={() => setNewWsOpen(true)}
        />
      ) : (
        <Card className="border-border/80">
          <CardContent className="p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <Tabs value={ws?.id} onValueChange={setSelectedWsId}>
              <TabsList className="h-9">
                {workspaces.map((w) => (
                  <TabsTrigger key={w.id} value={w.id} className="text-xs gap-1.5">
                    <span>{w.name}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      {w.role}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            {ws && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{ws._count.members} thành viên · {ws._count.projects} dự án</span>
                <div className="flex -space-x-1.5">
                  {(membersQuery.data ?? []).slice(0, 6).map((m) => (
                    <UserAvatar key={m.id} name={m.fullName} avatar={m.avatarUrl ?? undefined} role={m.role} size="sm" className="ring-2 ring-background" />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Projects */}
      {wsId &&
        (projectsQuery.isPending ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        ) : projectsQuery.isError ? (
          <ErrorState code={describeError(projectsQuery.error).code} message={describeError(projectsQuery.error).message} onRetry={() => projectsQuery.refetch()} />
        ) : projectsQuery.data.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="Chưa có dự án nào"
            description={isAdmin ? "Tạo dự án đầu tiên, chọn PM và bắt đầu lập sprint." : "Quản trị viên workspace chưa tạo dự án nào."}
            actionLabel={isAdmin ? "Tạo dự án mới" : undefined}
            onAction={isAdmin ? () => setNewProjectOpen(true) : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projectsQuery.data.map((p) => (
              <ProjectCard key={p.id} project={p} onOpen={() => router.push(`/projects/${p.id}/board`)} />
            ))}
          </div>
        ))}

      {/* Dialog: workspace mới */}
      <Dialog open={newWsOpen} onOpenChange={setNewWsOpen}>
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
              if (name) createWs.mutate(name);
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle className="text-base">Tạo workspace</DialogTitle>
              <DialogDescription className="text-xs">Bạn sẽ là OWNER; workspace được nạp cột Kanban và 30 kỹ năng mẫu.</DialogDescription>
            </DialogHeader>
            <Input name="name" placeholder="Tên workspace" className="text-xs h-9" required minLength={2} />
            <DialogFooter>
              <Button type="submit" size="sm" disabled={createWs.isPending}>
                Tạo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: dự án mới */}
      <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
        <DialogContent className="sm:max-w-lg">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              createProject.mutate({
                key: String(f.get("key") ?? "").toUpperCase(),
                name: String(f.get("name") ?? ""),
                description: String(f.get("description") ?? "") || undefined,
                pmUserId: String(f.get("pmUserId") ?? ""),
              });
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle className="text-base">Tạo dự án mới</DialogTitle>
              <DialogDescription className="text-xs">Mã dự án 2–6 ký tự in hoa (mã task = MÃ-số). Dự án cần đúng một PM.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Mã</label>
                <Input name="key" placeholder="ST" className="text-xs h-9 font-mono uppercase" required pattern="[A-Za-z][A-Za-z0-9]{1,5}" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Tên dự án</label>
                <Input name="name" placeholder="SmartTask v1" className="text-xs h-9" required minLength={2} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Mô tả</label>
              <Textarea name="description" className="text-xs min-h-[72px]" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Quản lý dự án (PM)</label>
              <Select name="pmUserId" required>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Chọn thành viên workspace" />
                </SelectTrigger>
                <SelectContent>
                  {(membersQuery.data ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      {m.fullName} · {m.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" size="sm" disabled={createProject.isPending}>
                Tạo dự án
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: mời thành viên */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              invite.mutate({ email: String(f.get("email") ?? "") || undefined, role: String(f.get("role") ?? "MEMBER") });
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle className="text-base">Mời thành viên</DialogTitle>
              <DialogDescription className="text-xs">Bỏ trống email để tạo link mời chung, hiệu lực 7 ngày.</DialogDescription>
            </DialogHeader>
            <Input name="email" type="email" placeholder="ten@congty.vn (tuỳ chọn)" className="text-xs h-9" />
            <Select name="role" defaultValue="MEMBER">
              <SelectTrigger className="text-xs h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["ADMIN", "MEMBER", "VIEWER"].map((r) => (
                  <SelectItem key={r} value={r} className="text-xs">
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button type="submit" size="sm" className="gap-1.5" disabled={invite.isPending}>
                <Copy className="h-3.5 w-3.5" /> Tạo lời mời
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectCard({ project: p, onOpen }: { project: ProjectListItem; onOpen: () => void }) {
  const active = p.status === "ACTIVE";
  return (
    <Card className={cn("border-border/80 flex flex-col", !active && "opacity-70")}>
      <CardHeader className="p-4 pb-2 space-y-2">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="font-mono text-[10px]">
            {p.key}
          </Badge>
          <Badge variant={active ? "success" : "secondary"} className="text-[10px]">
            {active ? "Đang diễn ra" : "Đã lưu trữ"}
          </Badge>
        </div>
        <CardTitle className="text-base leading-snug">{p.name}</CardTitle>
        {p.description && <CardDescription className="text-xs line-clamp-2">{p.description}</CardDescription>}
      </CardHeader>
      <CardContent className="p-4 pt-2 text-xs text-muted-foreground flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          {p.activeSprint ? `${p.activeSprint.name} · ${fmtDay(p.activeSprint.startDate)}–${fmtDay(p.activeSprint.endDate)}` : "Chưa có sprint chạy"}
        </span>
        <span className="font-mono">{p._count?.tasks ?? 0} công việc</span>
      </CardContent>
      <CardFooter className="p-4 pt-0 mt-auto flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{p.myRole ? `Vai: ${p.myRole}` : "Bạn chưa là thành viên"} · {p._count?.members ?? 0} người</span>
        <Button variant="ghost" size="sm" onClick={onOpen} className="h-7 text-xs gap-1">
          Mở dự án <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </CardFooter>
    </Card>
  );
}
