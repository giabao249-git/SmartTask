"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SideDetailPanel } from "@/components/app/SideDetailPanel";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { SprintView } from "@/lib/types";
import { toast } from "sonner";
import { localIso, overlapping, toastSprintError } from "./shared";

type Form = { name: string; goal: string; startDate: string; endDate: string };

/**
 * Sprint mới mặc định bắt đầu NGAY SAU sprint cuối và dài bằng nó (14 ngày nếu chưa có sprint nào).
 * Trước đây mặc định "hôm nay → +13" theo giờ UTC: chồng lên sprint kế tiếp và trước 7 giờ sáng ra hôm qua.
 */
export function defaults(sprints: SprintView[]): Form {
  const last = [...sprints].sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
  const day = 86_400_000;
  if (!last) {
    const start = new Date();
    return {
      name: "Sprint 1",
      goal: "",
      startDate: localIso(start),
      endDate: localIso(new Date(start.getTime() + 13 * day)),
    };
  }
  const lastStart = new Date(`${last.startDate.slice(0, 10)}T00:00:00`);
  const lastEnd = new Date(`${last.endDate.slice(0, 10)}T00:00:00`);
  const length = Math.max(1, Math.round((lastEnd.getTime() - lastStart.getTime()) / day));
  const start = new Date(lastEnd.getTime() + day);
  const n = /(\d+)\s*$/.exec(last.name);
  return {
    name: n ? last.name.replace(/(\d+)\s*$/, String(Number(n[1]) + 1)) : `Sprint ${sprints.length + 1}`,
    goal: "",
    startDate: localIso(start),
    endDate: localIso(new Date(start.getTime() + length * day)),
  };
}

/** Tạo / sửa sprint (UC-09): POST /projects/:id/sprints, PATCH /sprints/:id. */
export function SprintFormDialog({
  projectId,
  sprints,
  editing,
  onClose,
  onSaved,
}: {
  projectId: string;
  sprints: SprintView[];
  /** "new" = tạo mới; sprint = sửa; null = đóng */
  editing: SprintView | "new" | null;
  onClose: () => void;
  onSaved: (s: SprintView) => void;
}) {
  const [form, setForm] = React.useState<Form>(() => defaults(sprints));
  React.useEffect(() => {
    if (editing === "new") setForm(defaults(sprints));
    else if (editing)
      setForm({
        name: editing.name,
        goal: editing.goal ?? "",
        startDate: editing.startDate.slice(0, 10),
        endDate: editing.endDate.slice(0, 10),
      });
    // Chỉ đặt lại khi mở hộp thoại, không phải mỗi lần danh sách sprint làm mới
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        goal: form.goal.trim() || undefined,
        startDate: form.startDate,
        endDate: form.endDate,
      };
      return editing === "new" ? api.post<SprintView>(`/projects/${projectId}/sprints`, body) : api.patch<SprintView>(`/sprints/${(editing as SprintView).id}`, body);
    },
    onSuccess: (s) => {
      toast.success(editing === "new" ? `Đã tạo ${s.name}` : `Đã lưu ${s.name}`);
      onSaved(s);
    },
    onError: toastSprintError,
  });

  const target = editing && editing !== "new" ? editing : null;
  const clash = overlapping(sprints, form.startDate, form.endDate, target?.id);
  const badRange = form.startDate > form.endDate;

  return (
    <SideDetailPanel
      open={editing !== null}
      onClose={onClose}
      ariaLabel={target ? `Sửa ${target.name}` : "Tạo sprint"}
      contentClassName="p-5 sm:p-6"
    >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5 pr-8">
            <h2 className="text-base font-semibold text-foreground">{target ? `Sửa ${target.name}` : "Tạo sprint"}</h2>
            <p className="text-xs text-muted-foreground">Mục tiêu sprint hiện ở trang Sprint, Dashboard và trong hộp thoại bắt đầu — một câu nói sprint này xong thì được gì.</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="sprint-name" className="text-sm font-medium">
              Tên
            </label>
            <Input id="sprint-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={60} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="sprint-goal" className="text-sm font-medium">
              Mục tiêu <span className="text-muted-foreground font-normal">(tuỳ chọn)</span>
            </label>
            <Textarea
              id="sprint-goal"
              value={form.goal}
              onChange={(e) => setForm({ ...form, goal: e.target.value })}
              placeholder="Ví dụ: người dùng đăng nhập và kéo thả được việc trên bảng"
              className="min-h-[72px]"
              maxLength={1000}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="sprint-start" className="text-sm font-medium">
                Bắt đầu
              </label>
              <Input id="sprint-start" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="sprint-end" className="text-sm font-medium">
                Kết thúc
              </label>
              <Input id="sprint-end" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
            </div>
          </div>
          {badRange && <p className="text-sm text-destructive">Ngày kết thúc phải sau ngày bắt đầu.</p>}
          {!badRange && clash && (
            <p className="flex items-start gap-2 text-sm text-foreground bg-warning/15 rounded-md px-3 py-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-warning" />
              Trùng ngày với {clash.name} ({clash.startDate.slice(5, 10)} → {clash.endDate.slice(5, 10)}). Vẫn lưu được, nhưng burn-down hai sprint sẽ chồng nhau.
            </p>
          )}
          <div className="pt-3 border-t border-border/40 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Huỷ
            </Button>
            <Button type="submit" disabled={save.isPending || badRange || !form.name.trim()}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {editing === "new" ? "Tạo sprint" : "Lưu"}
            </Button>
          </div>
        </form>
    </SideDetailPanel>
  );
}
