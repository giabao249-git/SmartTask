"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAvatar } from "./UserAvatar";
import { useSkills } from "@/lib/hooks/queries";
import type { ProjectDetail, SkillView } from "@/lib/types";

/**
 * Ba ô chọn dùng chung cho CẢ hộp thoại tạo công việc lẫn Sheet chi tiết (docs 10 §1:
 * component dùng lại ≥ 2 nơi thì đặt ở components/app). Chúng chỉ báo giá trị ra ngoài qua
 * `onChange` — nơi gọi tự quyết định gửi PUT kèm version hay gom vào body POST khi tạo.
 */

export function AssigneePicker({ value, members, disabled, onChange }: { value: string[]; members: ProjectDetail["members"]; disabled: boolean; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<string[]>(value);
  React.useEffect(() => setDraft(value), [value]);
  const selected = members.filter((m) => value.includes(m.id));
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o && JSON.stringify([...draft].sort()) !== JSON.stringify([...value].sort())) onChange(draft);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="h-9 w-full justify-start gap-1.5 text-sm font-normal">
          {selected.length === 0 ? (
            <span className="text-muted-foreground">Chưa giao</span>
          ) : (
            <>
              <div className="flex -space-x-1.5">
                {selected.slice(0, 3).map((m) => (
                  <UserAvatar key={m.id} name={m.shortName ?? m.fullName} avatar={m.avatarUrl ?? undefined} size="sm" showTooltip={false} className="ring-2 ring-background" />
                ))}
              </div>
              <span className="truncate">{selected.map((m) => m.shortName ?? m.fullName).join(", ")}</span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 space-y-1" align="start">
        {members.map((m) => (
          <label key={m.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer text-xs">
            <Checkbox checked={draft.includes(m.id)} onCheckedChange={(c) => setDraft((d) => (c ? [...d, m.id] : d.filter((x) => x !== m.id)))} />
            <UserAvatar name={m.shortName ?? m.fullName} avatar={m.avatarUrl ?? undefined} size="sm" showTooltip={false} />
            <span className="flex-1 truncate">{m.fullName}</span>
            <span className="text-[10px] text-muted-foreground">{m.role}</span>
          </label>
        ))}
        <p className="text-[10px] text-muted-foreground px-1 pt-1">Đóng để lưu</p>
      </PopoverContent>
    </Popover>
  );
}

export /** Chọn nhãn dự án; đóng Popover mới lưu (PUT /tasks/:id/labels). */
function LabelPicker({ value, labels, disabled, onChange }: { value: string[]; labels: ProjectDetail["labels"]; disabled: boolean; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<string[]>(value);
  React.useEffect(() => setDraft(value), [value]);
  const selected = labels.filter((l) => value.includes(l.id));
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o && JSON.stringify([...draft].sort()) !== JSON.stringify([...value].sort())) onChange(draft);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="h-9 w-full justify-start gap-1.5 overflow-hidden text-sm font-normal">
          {selected.length === 0 ? <span className="text-muted-foreground">Không nhãn</span> : selected.map((l) => <Badge key={l.id} variant="secondary" className="text-[10px] px-1 py-0 font-normal">#{l.name}</Badge>)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2 space-y-1" align="start">
        {labels.length === 0 && <p className="text-[11px] text-muted-foreground px-1">Dự án chưa có nhãn — thêm ở Cấu hình dự án.</p>}
        {labels.map((l) => (
          <label key={l.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer text-xs">
            <Checkbox checked={draft.includes(l.id)} onCheckedChange={(c) => setDraft((d) => (c ? [...d, l.id] : d.filter((x) => x !== l.id)))} />
            <span className="h-2.5 w-2.5 rounded-full border border-border/40" style={{ backgroundColor: l.color }} />
            <span className="flex-1 truncate">{l.name}</span>
          </label>
        ))}
        <p className="text-[10px] text-muted-foreground px-1 pt-1">Đóng để lưu</p>
      </PopoverContent>
    </Popover>
  );
}

export /** Kỹ năng yêu cầu + mức tối thiểu 1–5 (PUT /tasks/:id/skills) — danh mục kỹ năng workspace. */
function SkillPicker({ value, workspaceId, disabled, onChange }: { value: { skillId: string; minLevel: number }[]; workspaceId: string; disabled: boolean; onChange: (skills: { skillId: string; minLevel: number }[]) => void }) {
  const skills = useSkills(workspaceId);
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const [q, setQ] = React.useState("");
  React.useEffect(() => setDraft(value), [value]);
  const byId = new Map((skills.data ?? []).map((s) => [s.id, s]));
  const same = JSON.stringify([...draft].sort((a, b) => a.skillId.localeCompare(b.skillId))) === JSON.stringify([...value].sort((a, b) => a.skillId.localeCompare(b.skillId)));
  const list = (skills.data ?? []).filter((s: SkillView) => !q || s.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o && !same) onChange(draft);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="h-9 w-full justify-start gap-1.5 overflow-hidden text-sm font-normal">
          {value.length === 0 ? <span className="text-muted-foreground">Không yêu cầu</span> : value.map((s) => <Badge key={s.skillId} variant="outline" className="text-[10px] px-1 py-0 font-normal">{byId.get(s.skillId)?.name ?? "…"} ≥ {s.minLevel}</Badge>)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2 space-y-1" align="start">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lọc kỹ năng…" className="h-7 text-xs" />
        <div className="max-h-56 overflow-y-auto space-y-0.5">
          {list.slice(0, 40).map((s) => {
            const cur = draft.find((d) => d.skillId === s.id);
            return (
              <div key={s.id} className="flex items-center gap-2 p-1 rounded hover:bg-muted text-xs">
                <Checkbox checked={!!cur} onCheckedChange={(c) => setDraft((d) => (c ? [...d, { skillId: s.id, minLevel: 2 }] : d.filter((x) => x.skillId !== s.id)))} />
                <span className="flex-1 truncate">{s.name}</span>
                {cur && (
                  <Select value={String(cur.minLevel)} onValueChange={(v) => setDraft((d) => d.map((x) => (x.skillId === s.id ? { ...x, minLevel: Number(v) } : x)))}>
                    <SelectTrigger className="h-6 w-14 text-[10px] px-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((l) => (
                        <SelectItem key={l} value={String(l)} className="text-xs">
                          ≥ {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground px-1 pt-1">Đóng để lưu · Trợ lý AI và bảng năng lực dùng mức này</p>
      </PopoverContent>
    </Popover>
  );
}
