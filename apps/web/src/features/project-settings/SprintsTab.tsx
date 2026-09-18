"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { Flag, Loader2, Pencil, Play, Plus, Square } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { api, describeError } from "@/lib/api";
import { useSprints } from "@/lib/hooks/queries";
import type { ProjectDetail, SprintView } from "@/lib/types";
import { toast } from "sonner";
import { toastApiError, useInvalidateProject } from "./shared";

type SprintRow = SprintView & { estimateHours?: number; remainingHours?: number };
type Form = { name: string; goal: string; startDate: string; endDate: string };
const empty = (): Form => {
  const d = new Date();
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  const end = new Date(d.getTime() + 13 * 86_400_000);
  return { name: "", goal: "", startDate: iso(d), endDate: iso(end) };
};
const statusVariant = (s: SprintView["status"]) => (s === "ACTIVE" ? "success" : s === "PLANNED" ? "info" : "secondary") as "success" | "info" | "secondary";

/** Sprint (UC-09): GET/POST /projects/:id/sprints, PATCH /sprints/:id, POST start/close {moveOpenTo}. */
export function SprintsTab({ project }: { project: ProjectDetail }) {
  const sprints = useSprints(project.id);
  const invalidate = useInvalidateProject(project.id);
  const [editing, setEditing] = React.useState<SprintRow | "new" | null>(null);
  const [form, setForm] = React.useState<Form>(empty());
  const [closing, setClosing] = React.useState<SprintRow | null>(null);
  const [moveTo, setMoveTo] = React.useState("backlog");
  const can = project.canManage && project.status === "ACTIVE";

  const openEdit = (s: SprintRow | "new") => {
    setForm(s === "new" ? empty() : { name: s.name, goal: s.goal ?? "", startDate: s.startDate.slice(0, 10), endDate: s.endDate.slice(0, 10) });
    setEditing(s);
  };
  const save = useMutation({
    mutationFn: () => {
      const body = { name: form.name.trim(), goal: form.goal.trim() || undefined, startDate: form.startDate, endDate: form.endDate };
      return editing === "new" ? api.post<SprintView>(`/projects/${project.id}/sprints`, body) : api.patch<SprintView>(`/sprints/${(editing as SprintRow).id}`, body);
    },
    onSuccess: () => {
      invalidate();
      setEditing(null);
      toast.success(editing === "new" ? "Đã tạo sprint" : "Đã lưu sprint");
    },
    onError: toastApiError,
  });
  const start = useMutation({
    mutationFn: (id: string) => api.post<SprintView>(`/sprints/${id}/start`, {}),
    onSuccess: (s) => {
      invalidate();
      toast.success(`${s.name} bắt đầu — scope giờ đã chốt`);
    },
    onError: toastApiError,
  });
  const close = useMutation({
    mutationFn: () => api.post<SprintView>(`/sprints/${closing!.id}/close`, { moveOpenTo: moveTo }),
    onSuccess: () => {
      invalidate();
      setClosing(null);
      toast.success("Đã kết thúc sprint");
    },
    onError: toastApiError,
  });

  const rows = (sprints.data ?? []) as SprintRow[];
  const targets = rows.filter((s) => closing && s.id !== closing.id && s.status !== "CLOSED");

  return (
    <Card className="border-border/80">
      <CardHeader className="p-4 pb-2 flex-row items-start justify-between space-y-0 gap-2">
        <div>
          <CardTitle className="text-sm flex items-center gap-2">
            <Flag className="h-4 w-4" /> Sprint ({rows.length})
          </CardTitle>
          <CardDescription className="text-xs">Mỗi dự án một sprint ACTIVE. Bắt đầu = chốt scope giờ để vẽ burndown; kết thúc = việc dở về backlog hoặc sprint khác.</CardDescription>
        </div>
        <Button size="sm" className="h-8 text-xs gap-1.5" disabled={!can} onClick={() => openEdit("new")}>
          <Plus className="h-3.5 w-3.5" /> Tạo sprint
        </Button>
      </CardHeader>
      <CardContent className="p-4 pt-0 overflow-x-auto">
        {sprints.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : sprints.isError ? (
          <ErrorState code={describeError(sprints.error).code} message={describeError(sprints.error).message} onRetry={() => sprints.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Flag} title="Chưa có sprint" description="Tạo sprint đầu tiên để bắt đầu lập kế hoạch." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Sprint</TableHead>
                <TableHead className="text-xs">Trạng thái</TableHead>
                <TableHead className="text-xs">Thời gian</TableHead>
                <TableHead className="text-xs text-right">Việc</TableHead>
                <TableHead className="text-xs text-right">Giờ ước / còn</TableHead>
                <TableHead className="text-xs w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id} className="text-xs">
                  <TableCell>
                    <div className="font-medium">{s.name}</div>
                    {s.goal && <div className="text-[10px] text-muted-foreground line-clamp-1">{s.goal}</div>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(s.status)} className="text-[10px]">
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {s.startDate.slice(5, 10)} → {s.endDate.slice(5, 10)}
                  </TableCell>
                  <TableCell className="text-right font-mono">{s.taskCount ?? 0}</TableCell>
                  <TableCell className="text-right font-mono">
                    {s.estimateHours ?? 0} / {s.remainingHours ?? 0}
                  </TableCell>
                  <TableCell>
                    {can && s.status !== "CLOSED" && (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Sửa" onClick={() => openEdit(s)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {s.status === "PLANNED" && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-success" title="Bắt đầu" disabled={start.isPending} onClick={() => start.mutate(s.id)}>
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {s.status === "ACTIVE" && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Kết thúc" onClick={() => { setMoveTo("backlog"); setClosing(s); }}>
                            <Square className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
            className="space-y-3"
          >
            <DialogHeader>
              <DialogTitle>{editing === "new" ? "Tạo sprint" : "Sửa sprint"}</DialogTitle>
              <DialogDescription className="text-xs">Ngày kết thúc phải sau ngày bắt đầu; sprint đang chạy vẫn sửa được tên/mục tiêu/ngày.</DialogDescription>
            </DialogHeader>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Sprint 3" className="h-8 text-xs" required maxLength={60} />
            <Textarea value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} placeholder="Mục tiêu sprint (tuỳ chọn)" className="text-xs min-h-[60px]" maxLength={1000} />
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs space-y-1">
                <span>Bắt đầu</span>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="h-8 text-xs" required />
              </label>
              <label className="text-xs space-y-1">
                <span>Kết thúc</span>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="h-8 text-xs" required />
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setEditing(null)}>
                Huỷ
              </Button>
              <Button type="submit" size="sm" className="text-xs gap-1.5" disabled={save.isPending}>
                {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Lưu
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!closing} onOpenChange={(o) => !o && setClosing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kết thúc {closing?.name}?</DialogTitle>
            <DialogDescription className="text-xs">Việc chưa hoàn thành ({closing?.remainingHours ?? 0} h còn lại) sẽ chuyển đi đâu?</DialogDescription>
          </DialogHeader>
          <Select value={moveTo} onValueChange={setMoveTo}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="backlog" className="text-xs">
                Backlog
              </SelectItem>
              {targets.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">
                  {s.name} · {s.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setClosing(null)}>
              Huỷ
            </Button>
            <Button size="sm" className="text-xs gap-1.5" disabled={close.isPending} onClick={() => close.mutate()}>
              {close.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Kết thúc sprint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
