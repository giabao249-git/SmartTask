"use client";

import * as React from "react";
import { Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { useSprints } from "@/lib/hooks/queries";
import { cn } from "@/lib/utils";
import { TASK_TYPES, typeToLabel } from "@/lib/status";
import { useWorkFilters, type GroupBy, type QuickFilter } from "./filters";
import { SavedFilters } from "./SavedFilters";

/** Thanh lọc dùng chung cho cả 4 cách nhìn công việc; mọi thay đổi ghi vào URL. */
export function WorkFilterBar({ counts, syncing }: { counts: { my: number; unassigned: number }; syncing?: boolean }) {
  const project = useCurrentProject();
  const sprints = useSprints(project.id);
  const f = useWorkFilters();
  const [draftQ, setDraftQ] = React.useState(f.q);
  React.useEffect(() => setDraftQ(f.q), [f.q]);
  React.useEffect(() => {
    if (draftQ === f.q) return;
    const t = setTimeout(() => f.set({ q: draftQ }), 300);
    return () => clearTimeout(t);
  }, [draftQ, f]);

  const quickBtn = (key: QuickFilter, label: string, count?: number, kbd?: string) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => f.set({ quick: f.quick === key ? "all" : key })}
      className={cn(
        "h-7 px-2.5 text-xs rounded-md font-medium transition-colors gap-1.5",
        f.quick === key
          ? key === "my"
            ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
            : "bg-background text-foreground shadow-2xs font-semibold"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span>{label}</span>
      {count !== undefined && (
        <Badge variant={f.quick === key && key === "my" ? "secondary" : "outline"} className="text-[10px] px-1 py-0 font-mono">
          {count}
        </Badge>
      )}
      {kbd && (
        <kbd className={cn("text-[9px] font-mono px-1 rounded border", f.quick === key ? "bg-primary-foreground/20 border-transparent text-primary-foreground" : "bg-background")}>{kbd}</kbd>
      )}
    </Button>
  );

  return (
    <div className="flex items-center gap-2 flex-wrap text-xs">
      <div className="flex items-center rounded-lg border border-border/80 bg-muted/40 p-0.5">
        {quickBtn("all", "Tất cả")}
        {quickBtn("my", "Việc của tôi", counts.my, "Q")}
        {quickBtn("unassigned", "Chưa giao", counts.unassigned)}
      </div>

      <Filter className="h-3.5 w-3.5 text-muted-foreground ml-1" />
      <Select value={f.sprint} onValueChange={(v) => f.set({ sprint: v })}>
        <SelectTrigger className="h-8 text-xs w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all" className="text-xs">
            Mọi sprint + backlog
          </SelectItem>
          <SelectItem value="__backlog" className="text-xs">
            Backlog
          </SelectItem>
          {(sprints.data ?? []).map((s) => (
            <SelectItem key={s.id} value={s.id} className="text-xs">
              {s.name} · {s.status}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={f.assignee} onValueChange={(v) => f.set({ assignee: v })}>
        <SelectTrigger className="h-8 text-xs w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all" className="text-xs">
            Mọi người
          </SelectItem>
          {project.members.map((m) => (
            <SelectItem key={m.id} value={m.id} className="text-xs">
              {m.fullName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={f.type} onValueChange={(v) => f.set({ type: v })}>
        <SelectTrigger className="h-8 text-xs w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all" className="text-xs">
            Mọi loại
          </SelectItem>
          {TASK_TYPES.map((t) => (
            <SelectItem key={t} value={t} className="text-xs">
              {typeToLabel(t)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input value={draftQ} onChange={(e) => setDraftQ(e.target.value)} placeholder="Tìm tiêu đề…" className="h-8 text-xs w-56" />
      {/* Nhóm chỉ có nghĩa trên bảng Kanban — ba view còn lại không có cột để xếp hàng */}
      {f.view === "board" && (
        <Select value={f.group} onValueChange={(v) => f.set({ group: v as GroupBy })}>
          <SelectTrigger className="h-8 text-xs w-40" title="Nhóm thẻ thành hàng trên bảng">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none" className="text-xs">
              Không nhóm
            </SelectItem>
            <SelectItem value="assignee" className="text-xs">
              Nhóm theo người
            </SelectItem>
            <SelectItem value="priority" className="text-xs">
              Nhóm theo ưu tiên
            </SelectItem>
          </SelectContent>
        </Select>
      )}
      <SavedFilters projectId={project.id} />
      {f.isFiltered && (
        <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => f.clear()}>
          Xoá lọc
        </Button>
      )}
      {syncing && <span className="text-[10px] text-muted-foreground">đang đồng bộ…</span>}
    </div>
  );
}
