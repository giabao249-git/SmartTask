"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Save, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState } from "@/components/app/ErrorState";
import { UserAvatar } from "@/components/app/UserAvatar";
import { api, describeError } from "@/lib/api";
import { useWorkspaceMembers } from "@/lib/hooks/queries";
import type { ProjectDetail, ProjectRole } from "@/lib/types";
import { toast } from "sonner";
import { toastApiError, useInvalidateProject } from "./shared";

/** Thành viên dự án (UC-08): PUT /projects/:id/members thay toàn bộ — đúng một PM; người bị gỡ mất assignee. Chọn từ thành viên workspace. */
export function ProjectMembersTab({ project }: { project: ProjectDetail }) {
  const invalidate = useInvalidateProject(project.id);
  const wsMembers = useWorkspaceMembers(project.workspaceId);
  const can = project.canManage && project.status === "ACTIVE";
  const initial = React.useMemo(() => new Map(project.members.map((m) => [m.id, m.role])), [project.members]);
  const [sel, setSel] = React.useState<Map<string, ProjectRole>>(initial);
  React.useEffect(() => setSel(initial), [initial]);
  const pmCount = [...sel.values()].filter((r) => r === "PM").length;

  const save = useMutation({
    mutationFn: () => api.put<unknown>(`/projects/${project.id}/members`, { members: [...sel.entries()].map(([userId, role]) => ({ userId, role })) }),
    onSuccess: () => {
      invalidate();
      toast.success("Đã lưu thành viên dự án");
    },
    onError: toastApiError,
  });
  const toggle = (id: string, on: boolean) =>
    setSel((s) => {
      const n = new Map(s);
      if (on) n.set(id, "MEMBER");
      else n.delete(id);
      return n;
    });
  const makePm = (id: string) =>
    setSel((s) => {
      const n = new Map<string, ProjectRole>();
      for (const [k, v] of s) n.set(k, v === "PM" ? "MEMBER" : v);
      n.set(id, "PM");
      return n;
    });

  return (
    <Card className="border-border/80">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="h-4 w-4" /> Thành viên dự án ({sel.size}/{wsMembers.data?.length ?? "…"})
        </CardTitle>
        <CardDescription className="text-xs">Tick để thêm vào dự án; chọn đúng một PM. Bỏ tick = gỡ khỏi dự án và khỏi mọi task đang được giao.</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0 overflow-x-auto">
        {wsMembers.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : wsMembers.isError ? (
          <ErrorState code={describeError(wsMembers.error).code} message={describeError(wsMembers.error).message} onRetry={() => wsMembers.refetch()} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-12">Trong DA</TableHead>
                <TableHead className="text-xs">Thành viên</TableHead>
                <TableHead className="text-xs">Vai workspace</TableHead>
                <TableHead className="text-xs w-32">Vai dự án</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wsMembers.data.map((m) => {
                const role = sel.get(m.id);
                return (
                  <TableRow key={m.id} className="text-xs">
                    <TableCell>
                      <Checkbox checked={!!role} disabled={!can || m.role === "VIEWER"} onCheckedChange={(c) => toggle(m.id, c === true)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserAvatar name={m.fullName} avatar={m.avatarUrl ?? undefined} size="sm" />
                        <div>
                          <div className="font-medium">{m.fullName}</div>
                          <div className="text-[10px] text-muted-foreground">{[m.department, m.title].filter(Boolean).join(" · ") || m.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {m.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {role === "PM" ? (
                        <Badge className="text-[10px]">PM</Badge>
                      ) : role ? (
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" disabled={!can} onClick={() => makePm(m.id)}>
                          MEMBER · làm PM
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <CardFooter className="p-4 pt-0 justify-between">
        <span className="text-[11px] text-muted-foreground">{pmCount !== 1 ? `Cần đúng một PM (hiện ${pmCount})` : "VIEWER của workspace không thể vào dự án."}</span>
        <Button size="sm" className="h-8 text-xs gap-1.5" disabled={!can || save.isPending || pmCount !== 1} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Lưu thành viên
        </Button>
      </CardFooter>
    </Card>
  );
}
