"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/app/EmptyState";
import { api } from "@/lib/api";
import type { LabelView, ProjectDetail } from "@/lib/types";
import { toast } from "sonner";
import { toastApiError, useInvalidateProject } from "./shared";

/** Nhãn (UC-08): POST /projects/:id/labels, PATCH/DELETE /labels/:id. Màu là dữ liệu người dùng chọn (API yêu cầu mã hex). */
export function LabelsTab({ project }: { project: ProjectDetail }) {
  const invalidate = useInvalidateProject(project.id);
  const can = project.canManage && project.status === "ACTIVE";
  const [editing, setEditing] = React.useState<{ id?: string; name: string; color: string } | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const body = { name: editing!.name.trim(), color: editing!.color };
      return editing!.id ? api.patch<LabelView>(`/labels/${editing!.id}`, body) : api.post<LabelView>(`/projects/${project.id}/labels`, body);
    },
    onSuccess: () => {
      invalidate();
      setEditing(null);
      toast.success("Đã lưu nhãn");
    },
    onError: toastApiError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/labels/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success("Đã xoá nhãn (gỡ khỏi mọi task)");
    },
    onError: toastApiError,
  });

  return (
    <Card className="border-border/80">
      <CardHeader className="p-4 pb-2 flex-row items-start justify-between space-y-0 gap-2">
        <div>
          <CardTitle className="text-sm flex items-center gap-2">
            <Tags className="h-4 w-4" /> Nhãn ({project.labels.length})
          </CardTitle>
          <CardDescription className="text-xs">Gắn lên task để lọc; Trợ lý AI đọc tên nhãn trong ngữ cảnh.</CardDescription>
        </div>
        <Button size="sm" className="h-8 text-xs gap-1.5" disabled={!can || !!editing} onClick={() => setEditing({ name: "", color: "#64748b" })}>
          <Plus className="h-3.5 w-3.5" /> Thêm nhãn
        </Button>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        {editing && (
          <form
            className="flex items-center gap-2 rounded-md border border-border/60 p-2"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <input type="color" value={editing.color} onChange={(e) => setEditing({ ...editing, color: e.target.value })} className="h-8 w-10 rounded border border-border/60 bg-transparent" aria-label="Màu nhãn" />
            <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Tên nhãn" className="h-8 text-xs w-48" required maxLength={30} autoFocus />
            <Button type="submit" size="sm" className="h-8 text-xs gap-1" disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Lưu
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(null)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </form>
        )}
        {project.labels.length === 0 && !editing ? (
          <EmptyState icon={Tags} title="Chưa có nhãn" description="Thêm nhãn như Bug, Frontend, Cần review…" />
        ) : (
          <div className="flex flex-wrap gap-2">
            {project.labels.map((l) => (
              <div key={l.id} className="flex items-center gap-1 rounded-md border border-border/60 pl-2 pr-1 py-1">
                <span className="h-2.5 w-2.5 rounded-full border border-border/40" style={{ backgroundColor: l.color }} />
                <Badge variant="secondary" className="text-[10px] font-normal">
                  #{l.name}
                </Badge>
                {can && (
                  <>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditing({ id: l.id, name: l.name, color: l.color })}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" disabled={remove.isPending} onClick={() => remove.mutate(l.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
