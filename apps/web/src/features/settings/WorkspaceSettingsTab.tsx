"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/app/ErrorState";
import { api, describeError } from "@/lib/api";
import type { WorkspaceSettingsView } from "@/lib/types";
import { toast } from "sonner";

const PURPOSES = ["DECOMPOSE", "ASSIGN", "EXPLAIN", "CHAT"] as const;
const PURPOSE_LABEL: Record<(typeof PURPOSES)[number], string> = { DECOMPOSE: "Phân rã", ASSIGN: "Giao việc", EXPLAIN: "Giải thích dự báo", CHAT: "Chat" };
const DAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

type Form = {
  defaultCapacityHours: string;
  workdays: number[];
  workStart: string;
  workEnd: string;
  adminOverhead: string;
  high: string;
  full: string;
  overload: string;
  fairnessTarget: string;
  dailyLimitPerUser: string;
  enabledPurposes: string[];
  behaviorSignals: boolean;
};

const toForm = (s: WorkspaceSettingsView): Form => ({
  defaultCapacityHours: String(s.defaultCapacityHours),
  workdays: s.workdays,
  workStart: s.workHours.start,
  workEnd: s.workHours.end,
  adminOverhead: String(s.adminOverhead),
  high: String(s.workload.thresholds.high),
  full: String(s.workload.thresholds.full),
  overload: String(s.workload.thresholds.overload),
  fairnessTarget: String(s.workload.fairnessTarget),
  dailyLimitPerUser: String(s.ai.dailyLimitPerUser),
  enabledPurposes: s.ai.enabledPurposes,
  behaviorSignals: s.ai.behaviorSignals,
});

/** Cài đặt workspace (GET/PATCH /workspaces/:id/settings): năng lực, lịch làm việc, ngưỡng tải, hạn mức AI. */
export function WorkspaceSettingsTab({ workspaceId, canEdit }: { workspaceId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const key = ["workspaces", workspaceId, "settings"];
  const q = useQuery({ queryKey: key, queryFn: () => api.get<WorkspaceSettingsView>(`/workspaces/${workspaceId}/settings`) });
  const [form, setForm] = React.useState<Form | null>(null);
  React.useEffect(() => {
    if (q.data) setForm(toForm(q.data));
  }, [q.data]);
  const save = useMutation({
    mutationFn: (f: Form) =>
      api.patch<WorkspaceSettingsView>(`/workspaces/${workspaceId}/settings`, {
        defaultCapacityHours: Number(f.defaultCapacityHours),
        workdays: f.workdays,
        workHours: { start: f.workStart, end: f.workEnd },
        adminOverhead: Number(f.adminOverhead),
        workload: { thresholds: { high: Number(f.high), full: Number(f.full), overload: Number(f.overload) }, fairnessTarget: Number(f.fairnessTarget) },
        ai: { dailyLimitPerUser: Number(f.dailyLimitPerUser), enabledPurposes: f.enabledPurposes, behaviorSignals: f.behaviorSignals },
      }),
    onSuccess: (s) => {
      qc.setQueryData(key, s);
      toast.success("Đã lưu cài đặt workspace");
    },
    onError: (e) => {
      const { code, message } = describeError(e);
      toast.error(code === "VALIDATION_FAILED" ? "Giá trị không hợp lệ — kiểm tra lại các ô" : message, { description: code });
    },
  });

  if (q.isPending || !form) return <Skeleton className="h-96 w-full" />;
  if (q.isError) return <ErrorState code={describeError(q.error).code} message={describeError(q.error).message} onRetry={() => q.refetch()} />;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const num = (label: string, k: keyof Form, step = "1", hint?: string) => (
    <label className="space-y-1 text-xs">
      <span className="font-medium">{label}</span>
      <Input type="number" step={step} value={String(form[k])} onChange={(e) => set(k, e.target.value as never)} className="h-8 text-xs" disabled={!canEdit} />
      {hint && <span className="block text-[10px] text-muted-foreground">{hint}</span>}
    </label>
  );

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(form);
      }}
    >
      <Card className="border-border/80">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Lịch làm việc & năng lực</CardTitle>
          <CardDescription className="text-xs">Dùng cho công thức tải (docs 04 §0). Ngày lễ và trọng số burnout chỉnh qua API.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2 grid grid-cols-2 md:grid-cols-4 gap-3">
          {num("Giờ/tuần mặc định", "defaultCapacityHours", "1", "1–80")}
          {num("Overhead hành chính", "adminOverhead", "0.01", "0–0.5 (phần giờ mất cho họp/việc vặt)")}
          <label className="space-y-1 text-xs">
            <span className="font-medium">Bắt đầu</span>
            <Input type="time" value={form.workStart} onChange={(e) => set("workStart", e.target.value)} className="h-8 text-xs" disabled={!canEdit} />
          </label>
          <label className="space-y-1 text-xs">
            <span className="font-medium">Kết thúc</span>
            <Input type="time" value={form.workEnd} onChange={(e) => set("workEnd", e.target.value)} className="h-8 text-xs" disabled={!canEdit} />
          </label>
          <div className="col-span-2 md:col-span-4 flex items-center gap-3 text-xs flex-wrap">
            <span className="font-medium">Ngày làm việc</span>
            {DAYS.map((d, i) => {
              const v = i + 1;
              const on = form.workdays.includes(v);
              return (
                <label key={v} className="flex items-center gap-1">
                  <Checkbox checked={on} disabled={!canEdit} onCheckedChange={(c) => set("workdays", c ? [...form.workdays, v].sort() : form.workdays.filter((x) => x !== v))} />
                  {d}
                </label>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Ngưỡng tải</CardTitle>
          <CardDescription className="text-xs">Tỷ lệ U = giờ hiệu dụng / năng lực. Mặc định Cao 0.7 · Đầy 0.9 · Quá tải 1.1 · Spread mục tiêu 0.2.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2 grid grid-cols-2 md:grid-cols-4 gap-3">
          {num("Cao (HIGH)", "high", "0.05")}
          {num("Đầy (FULL)", "full", "0.05")}
          {num("Quá tải (OVERLOAD)", "overload", "0.05")}
          {num("Spread mục tiêu", "fairnessTarget", "0.05")}
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Trợ lý AI</CardTitle>
          <CardDescription className="text-xs">Hạn mức lượt/ngày mỗi người và các mục đích được bật. Chọn nhà cung cấp/model ở tab &quot;Cấu hình Trợ lý AI&quot;.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2 grid grid-cols-2 md:grid-cols-4 gap-3">
          {num("Lượt AI/ngày/người", "dailyLimitPerUser", "1", "0 = tắt")}
          <div className="col-span-2 md:col-span-3 flex items-center gap-4 text-xs flex-wrap">
            {PURPOSES.map((p) => (
              <label key={p} className="flex items-center gap-1">
                <Checkbox checked={form.enabledPurposes.includes(p)} disabled={!canEdit} onCheckedChange={(c) => set("enabledPurposes", c ? [...form.enabledPurposes, p] : form.enabledPurposes.filter((x) => x !== p))} />
                {PURPOSE_LABEL[p]}
              </label>
            ))}
            <label className="flex items-center gap-1">
              <Checkbox checked={form.behaviorSignals} disabled={!canEdit} onCheckedChange={(c) => set("behaviorSignals", c === true)} />
              Tín hiệu hành vi (EAR, đúng hạn) cho AI
            </label>
          </div>
        </CardContent>
        <CardFooter className="p-4 pt-0 justify-end">
          <Button type="submit" size="sm" className="h-8 text-xs gap-1.5" disabled={!canEdit || save.isPending}>
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Lưu cài đặt
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
