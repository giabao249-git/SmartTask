"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { api } from "@/lib/api";
import { qk } from "@/lib/hooks/queries";
import type { ProjectDetail } from "@/lib/types";
import { toast } from "sonner";
import { toastApiError, useInvalidateProject } from "./shared";

/** Thông tin chung: PATCH /projects/:id (tên, mô tả, ngày, status), POST /projects/:id/archive. */
export function GeneralTab({ project }: { project: ProjectDetail }) {
  const router = useRouter();
  const qc = useQueryClient();
  const invalidate = useInvalidateProject(project.id);
  const can = project.canManage;
  const [form, setForm] = React.useState({ name: project.name, description: project.description ?? "", startDate: project.startDate?.slice(0, 10) ?? "", endDate: project.endDate?.slice(0, 10) ?? "" });
  React.useEffect(() => setForm({ name: project.name, description: project.description ?? "", startDate: project.startDate?.slice(0, 10) ?? "", endDate: project.endDate?.slice(0, 10) ?? "" }), [project]);

  const save = useMutation({
    mutationFn: () => api.patch<ProjectDetail>(`/projects/${project.id}`, { name: form.name.trim(), description: form.description.trim() || null, startDate: form.startDate || null, endDate: form.endDate || null }),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: qk.projects(project.workspaceId) });
      toast.success("Đã lưu thông tin dự án");
    },
    onError: toastApiError,
  });
  const archive = useMutation({
    mutationFn: () => (project.status === "ACTIVE" ? api.post<unknown>(`/projects/${project.id}/archive`, {}) : api.patch<ProjectDetail>(`/projects/${project.id}`, { status: "ACTIVE" })),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: qk.projects(project.workspaceId) });
      if (project.status === "ACTIVE") {
        toast.success("Đã lưu trữ dự án");
        router.push("/workspaces");
      } else toast.success("Đã mở lại dự án");
    },
    onError: toastApiError,
  });

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <form
        className="lg:col-span-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Card className="border-border/80 h-full">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">Thông tin dự án</CardTitle>
            <CardDescription className="text-xs">Mã dự án <span className="font-mono">{project.key}</span> cố định sau khi tạo (đi vào key task).</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2 grid gap-3 sm:grid-cols-2">
            <label className="text-xs space-y-1 sm:col-span-2">
              <span className="font-medium">Tên</span>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-8 text-xs" required maxLength={100} disabled={!can} />
            </label>
            <label className="text-xs space-y-1 sm:col-span-2">
              <span className="font-medium">Mô tả</span>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="text-xs min-h-[80px]" maxLength={2000} disabled={!can} />
            </label>
            <label className="text-xs space-y-1">
              <span className="font-medium">Bắt đầu</span>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="h-8 text-xs" disabled={!can} />
            </label>
            <label className="text-xs space-y-1">
              <span className="font-medium">Kết thúc dự kiến</span>
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="h-8 text-xs" disabled={!can} />
            </label>
          </CardContent>
          <CardFooter className="p-4 pt-0 justify-end">
            <Button type="submit" size="sm" className="h-8 text-xs gap-1.5" disabled={!can || save.isPending}>
              {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Lưu
            </Button>
          </CardFooter>
        </Card>
      </form>

      <Card className="border-destructive/30">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">{project.status === "ACTIVE" ? "Lưu trữ dự án" : "Mở lại dự án"}</CardTitle>
          <CardDescription className="text-xs">{project.status === "ACTIVE" ? "Dự án chuyển sang chỉ đọc, ẩn khỏi danh sách mặc định; không xoá dữ liệu." : "Dự án đang lưu trữ — mở lại để tiếp tục làm việc."}</CardDescription>
        </CardHeader>
        <CardFooter className="p-4 pt-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant={project.status === "ACTIVE" ? "destructive" : "outline"} size="sm" className="h-8 text-xs gap-1.5" disabled={!can || archive.isPending}>
                {project.status === "ACTIVE" ? <Archive className="h-3.5 w-3.5" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
                {project.status === "ACTIVE" ? "Lưu trữ" : "Mở lại"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{project.status === "ACTIVE" ? `Lưu trữ ${project.name}?` : `Mở lại ${project.name}?`}</AlertDialogTitle>
                <AlertDialogDescription>{project.status === "ACTIVE" ? "Thành viên vẫn xem được nhưng không sửa; sprint đang chạy giữ nguyên." : "Dự án sẽ hoạt động trở lại."}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Huỷ</AlertDialogCancel>
                <AlertDialogAction onClick={() => archive.mutate()}>Xác nhận</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>
    </div>
  );
}
