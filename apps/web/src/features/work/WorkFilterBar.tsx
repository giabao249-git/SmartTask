"use client";

import * as React from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { useSprints } from "@/lib/hooks/queries";
import { cn } from "@/lib/utils";
import { TASK_TYPES, typeToLabel, sprintStatusLabel } from "@/lib/status";
import { useWorkFilters, type GroupBy } from "./filters";
import { SavedFilters } from "./SavedFilters";

const UNASSIGNED = "__unassigned";

/**
 * Thanh lọc dùng chung cho các cách nhìn công việc; mọi thay đổi ghi vào URL.
 * Một hàng điều khiển gom cả Tabs chọn view, công cụ lọc và nút thao tác AI.
 */
export function WorkFilterBar({
  counts,
  syncing,
  leftSlot,
  rightSlot,
}: {
  counts: { my: number; unassigned: number };
  syncing?: boolean;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
}) {
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

  const memberName = (id: string) => project.members.find((m) => m.id === id)?.fullName ?? "Người";

  // "Người" gộp ba trường hợp loại trừ nhau: một người cụ thể · chưa giao · mọi người
  const assigneeValue = f.quick === "unassigned" ? UNASSIGNED : f.assignee;
  const setAssignee = (v: string) =>
    v === UNASSIGNED ? f.set({ quick: "unassigned", assignee: "__all" }) : f.set({ assignee: v, quick: "all" });

  // Chip: chỉ hiển thị cho các bộ lọc bổ sung, KHÔNG lặp lại Sprint vì dropdown Sprint đã hiển thị rõ ràng
  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (f.quick === "my") chips.push({ key: "quick", label: "Việc của tôi", clear: () => f.set({ quick: "all" }) });
  if (f.quick === "unassigned") chips.push({ key: "unassigned", label: "Chưa giao", clear: () => f.set({ quick: "all" }) });
  if (f.assignee !== "__all") chips.push({ key: "assignee", label: memberName(f.assignee), clear: () => f.set({ assignee: "__all" }) });
  if (f.type !== "__all") chips.push({ key: "type", label: typeToLabel(f.type), clear: () => f.set({ type: "__all" }) });
  if (f.q.trim()) chips.push({ key: "q", label: `“${f.q.trim()}”`, clear: () => f.set({ q: "" }) });

  // Số bộ lọc nằm TRONG popover (người/loại) — để badge trên nút phản ánh đúng thứ bên trong
  const popoverCount =
    (f.assignee !== "__all" || f.quick === "unassigned" ? 1 : 0) +
    (f.type !== "__all" ? 1 : 0);

  const isMy = f.quick === "my";

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center gap-2 flex-wrap">
        {leftSlot}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={draftQ} onChange={(e) => setDraftQ(e.target.value)} placeholder="Lọc theo tiêu đề…" className="h-8 w-56 pl-7 text-xs" />
        </div>

        {/* Sprint là phạm vi chính của màn (kể cả Backlog) nên để ngoài, không giấu trong popover */}
        <Select value={f.sprint} onValueChange={(v) => f.set({ sprint: v })}>
          <SelectTrigger className="h-8 w-44 text-xs" title="Phạm vi: sprint hoặc backlog">
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
                {s.name} · {sprintStatusLabel(s.status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={isMy ? "default" : "outline"}
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => f.set({ quick: isMy ? "all" : "my", assignee: "__all" })}
          title="Chỉ việc giao cho tôi (phím Q)"
        >
          Việc của tôi
          <Badge variant={isMy ? "secondary" : "outline"} className="text-[11px] px-1.5 py-0 font-mono">
            {counts.my}
          </Badge>
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Bộ lọc
              {popoverCount > 0 && (
                <Badge className="text-[11px] px-1.5 py-0 font-mono">{popoverCount}</Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 space-y-3 p-3">
            <Field label="Người thực hiện">
              <Select value={assigneeValue} onValueChange={setAssignee}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all" className="text-xs">
                    Mọi người
                  </SelectItem>
                  <SelectItem value={UNASSIGNED} className="text-xs">
                    Chưa giao ({counts.unassigned})
                  </SelectItem>
                  {project.members.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      {m.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Loại">
              <Select value={f.type} onValueChange={(v) => f.set({ type: v })}>
                <SelectTrigger className="h-8 text-xs">
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
            </Field>
          </PopoverContent>
        </Popover>

        {/* Nhóm chỉ có nghĩa trên bảng Kanban — các view còn lại không có cột để xếp hàng */}
        {f.view === "board" && (
          <Select value={f.group} onValueChange={(v) => f.set({ group: v as GroupBy })}>
            <SelectTrigger className="h-8 w-36 text-xs" title="Nhóm thẻ thành hàng trên bảng">
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

        <div className="ml-auto flex items-center gap-2">
          {syncing && <span className="text-xs text-muted-foreground hidden lg:inline">đang đồng bộ…</span>}
          <SavedFilters projectId={project.id} />
          {rightSlot}
        </div>
      </div>

      {chips.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {chips.map((c) => (
            <Badge key={c.key} variant="secondary" className={cn("h-6 gap-1 pl-2 pr-1 text-xs font-normal")}>
              <span className="max-w-40 truncate">{c.label}</span>
              <button
                type="button"
                onClick={c.clear}
                className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                aria-label={`Bỏ lọc ${c.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {f.isFiltered && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground" onClick={() => f.clear()}>
              Xoá tất cả
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}
