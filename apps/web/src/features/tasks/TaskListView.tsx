"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, ChevronDown, Filter, Sparkles, ListTodo, Maximize2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AssigneePicker } from "@/components/app/TaskFieldPickers";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PriorityBadge } from "@/components/app/PriorityBadge";
import { TaskTypeBadge } from "@/components/app/TaskTypeBadge";
import { UserAvatar } from "@/components/app/UserAvatar";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { TaskDetailModal } from "@/components/app/TaskDetailModal";
import { fmtDay, taskKeyOf } from "@/components/app/TaskCard";
import { describeError } from "@/lib/api";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { useAuth } from "@/lib/auth";
import { useWorkFilters } from "@/features/work/filters";
import { useWorkSelection } from "@/features/work/selection";
import { Checkbox } from "@/components/ui/checkbox";
import { statusToVariant, sprintStatusLabel, TASK_TYPES, typeToLabel } from "@/lib/status";
import { useSprints } from "@/lib/hooks/queries";
import type { TaskListItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useBoardRealtime, useTaskMutations, useTasks } from "@/features/board/hooks";

/** Khoảng hạn lọc ở cột Hạn — tính theo ngày (YYYY-MM-DD) để không lệch múi giờ. */
const DUE_OPTIONS = [
  { value: "__all", label: "Mọi hạn" },
  { value: "overdue", label: "Quá hạn" },
  { value: "today", label: "Hôm nay" },
  { value: "week", label: "Tuần này" },
  { value: "none", label: "Chưa đặt hạn" },
];
function matchDue(t: TaskListItem, preset: string): boolean {
  if (preset === "__all") return true;
  if (preset === "none") return !t.dueDate;
  if (!t.dueDate) return false;
  const d = t.dueDate.slice(0, 10);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (preset === "overdue") return d < today && !t.completedAt;
  if (preset === "today") return d === today;
  if (preset === "week") {
    const dow = (now.getUTCDay() + 6) % 7; // thứ Hai = 0
    const mon = new Date(now.getTime() - dow * 86_400_000).toISOString().slice(0, 10);
    const sun = new Date(now.getTime() + (6 - dow) * 86_400_000).toISOString().slice(0, 10);
    return d >= mon && d <= sun;
  }
  return true;
}

type SortKey = "number" | "title" | "priority" | "dueDate" | "estimateHours" | "progress" | "updatedAt";
const PRIORITY_RANK: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

/** Danh sách task (UC-15): bộ lọc lưu trong URL, sắp xếp cột, cùng dữ liệu với Kanban. */
export function TaskListView() {
  const project = useCurrentProject();
  const auth = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const f = useWorkFilters();
  const get = (k: string, d = "") => params.get(k) ?? d;
  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v && v !== "__all") next.set(k, v);
    else next.delete(k);
    router.replace(`?${next.toString()}`);
  };
  const priority = get("priority", "__all");
  const column = get("column", "__all");
  const due = get("due", "__all");
  const sortKey = (get("sort", "number") as SortKey) || "number";
  const sortDir = get("dir", "asc") === "desc" ? "desc" : "asc";

  // Cùng khoá truy vấn với Kanban/Timeline/Eisenhower → đổi cách nhìn không gọi lại API.
  const tasksQuery = useTasks(project.id, f.query);
  const mut = useTaskMutations(project.id);
  const sel = useWorkSelection();
  useBoardRealtime(project.id);

  /**
   * Sửa tại chỗ trong bảng (docs 02/05 §B2) — dùng lại đúng mutation của Kanban nên vẫn mang
   * `version`, vẫn cập nhật lạc quan, vẫn phát task:*. 409 thì báo rồi tải lại, không ghi đè.
   */
  const fail = (e: unknown, what: string, key: string) => {
    const { code, message } = describeError(e);
    if (code === "TASK_VERSION_CONFLICT") toast.error(`${key} vừa được người khác sửa — đã tải lại`, { description: code });
    else toast.error(`${what} thất bại`, { description: `${code}: ${message}` });
    void tasksQuery.refetch();
  };
  const editable = project.canEdit;
  const patchRow = (t: TaskListItem, patch: Record<string, unknown>, what: string) =>
    mut.update.mutate({ id: t.id, version: t.version, patch }, { onError: (e) => fail(e, what, taskKeyOf(project.key, t)) });
  const [selectedId, setSelectedId] = React.useState<string | null>(params.get("task"));
  const [detailOpen, setDetailOpen] = React.useState(!!params.get("task"));
  /**
   * `?task=` phải mở modal chi tiết cả khi điều hướng trong trang (bảng lệnh, thông báo, link đã chia sẻ),
   * không chỉ lúc tải lần đầu — trước đây state chỉ đọc param một lần khi mount.
   */
  const urlTaskId = params.get("task");
  React.useEffect(() => {
    if (!urlTaskId) return;
    setSelectedId(urlTaskId);
    setDetailOpen(true);
  }, [urlTaskId]);

  const sprints = useSprints(project.id);

  const sorted = React.useMemo(() => {
    const list = f
      .applyQuick(tasksQuery.data ?? [], auth.user?.id)
      .filter((t) => column === "__all" || t.columnId === column)
      .filter((t) => priority === "__all" || t.priority === priority)
      .filter((t) => matchDue(t, due));
    const cmp = (a: TaskListItem, b: TaskListItem): number => {
      switch (sortKey) {
        case "title":
          return a.title.localeCompare(b.title, "vi");
        case "priority":
          return (PRIORITY_RANK[a.priority] ?? 0) - (PRIORITY_RANK[b.priority] ?? 0);
        case "dueDate":
          return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
        case "estimateHours":
          return (a.estimateHours ?? 0) - (b.estimateHours ?? 0);
        case "progress":
          return a.progress - b.progress;
        case "updatedAt":
          return a.updatedAt.localeCompare(b.updatedAt);
        default:
          return a.number - b.number;
      }
    };
    return [...list].sort((a, b) => (sortDir === "asc" ? cmp(a, b) : cmp(b, a)));
  }, [tasksQuery.data, column, priority, due, sortKey, sortDir, f, auth.user?.id]);

  /**
   * Chia danh sách thành từng khoảng sprint ở đầu mỗi nhóm: đang chạy → kế hoạch → đã đóng (mới nhất trước) → backlog.
   * Thứ tự sắp xếp cột vẫn áp BÊN TRONG mỗi nhóm. `rows` là dãy phẳng theo đúng thứ tự hiển thị để
   * chọn nhiều (Shift-click) và "chọn tất cả" khớp với những gì người dùng thấy.
   */
  const groups = React.useMemo(() => {
    const byId = new Map<string, TaskListItem[]>();
    for (const t of sorted) {
      const k = t.sprintId ?? "__backlog";
      const arr = byId.get(k);
      if (arr) arr.push(t);
      else byId.set(k, [t]);
    }
    const rank = { ACTIVE: 0, PLANNED: 1, CLOSED: 2 } as const;
    const list = [...byId.entries()].map(([id, tasks]) => {
      const sprint = id === "__backlog" ? null : (sprints.data ?? []).find((x) => x.id === id) ?? null;
      const hours = tasks.reduce((n, t) => n + (t.estimateHours ?? 0), 0);
      const done = tasks.filter((t) => t.completedAt).length;
      return { id, sprint, tasks, hours, done };
    });
    return list.sort((a, b) => {
      if (!a.sprint || !b.sprint) return a.sprint ? -1 : b.sprint ? 1 : 0;
      const r = rank[a.sprint.status] - rank[b.sprint.status];
      if (r) return r;
      return a.sprint.status === "CLOSED" ? b.sprint.startDate.localeCompare(a.sprint.startDate) : a.sprint.startDate.localeCompare(b.sprint.startDate);
    });
  }, [sorted, sprints.data]);
  const rows = React.useMemo(() => groups.flatMap((g) => g.tasks), [groups]);

  const toggleSort = (k: SortKey) => {
    const next = new URLSearchParams(params.toString());
    if (sortKey === k) next.set("dir", sortDir === "asc" ? "desc" : "asc");
    else {
      next.set("sort", k);
      next.set("dir", "asc");
    }
    router.replace(`?${next.toString()}`);
  };
  const Head = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => {
    const isRight = className?.includes("text-right");
    return (
      <TableHead className={cn("text-xs cursor-pointer select-none", className)} onClick={() => toggleSort(k)}>
        <span className={cn("inline-flex items-center gap-1", isRight && "justify-end w-full")}>
          {children}
          <ArrowUpDown className={cn("h-3 w-3", sortKey === k ? "text-foreground" : "text-muted-foreground/50")} />
        </span>
      </TableHead>
    );
  };
  /**
   * Tiêu đề cột kiêm bộ lọc: bấm vào mở menu chọn giá trị lọc của cột đó (và sắp xếp nếu cột sắp xếp được).
   * Cột đang lọc được tô nổi và hiện giá trị đang chọn ngay trên tiêu đề.
   */
  const FilterHead = ({
    label,
    value,
    options,
    onChange,
    sortKeyOf,
    className,
  }: {
    label: string;
    value: string;
    options: { value: string; label: string }[];
    onChange: (v: string) => void;
    sortKeyOf?: SortKey;
    className?: string;
  }) => {
    const active = value !== "__all";
    const current = options.find((o) => o.value === value)?.label;
    return (
      <TableHead className={cn("text-xs", className)}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1 rounded px-1 -mx-1 py-0.5 hover:bg-muted-foreground/10 transition-colors",
                active && "bg-primary/10 text-foreground font-semibold",
              )}
              title={`Lọc theo ${label.toLowerCase()}`}
            >
              {label}
              {active && <span className="max-w-24 truncate font-normal">: {current}</span>}
              {active ? <Filter className="h-3 w-3" /> : <ChevronDown className="h-3 w-3 text-muted-foreground/60" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44">
            {sortKeyOf && (
              <>
                <DropdownMenuLabel className="text-[11px] text-muted-foreground">Sắp xếp</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={sortKey === sortKeyOf ? sortDir : ""}
                  onValueChange={(d) => {
                    const next = new URLSearchParams(params.toString());
                    next.set("sort", sortKeyOf);
                    next.set("dir", d);
                    router.replace(`?${next.toString()}`);
                  }}
                >
                  <DropdownMenuRadioItem value="asc" className="text-xs">{sortKeyOf === "dueDate" ? "Sớm → muộn" : "Thấp → cao"}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="desc" className="text-xs">{sortKeyOf === "dueDate" ? "Muộn → sớm" : "Cao → thấp"}</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuLabel className="text-[11px] text-muted-foreground">Lọc {label.toLowerCase()}</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
              {options.map((o) => (
                <DropdownMenuRadioItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableHead>
    );
  };
  const today = new Date().toISOString().slice(0, 10);
  /** Ô sửa tại chỗ không được để click lan ra làm mở modal chi tiết. */
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-end text-xs text-muted-foreground">
        <span>{rows.length} công việc · bấm tiêu đề cột để lọc</span>
      </div>

      {tasksQuery.isPending ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : tasksQuery.isError ? (
        <ErrorState code={describeError(tasksQuery.error).code} message={describeError(tasksQuery.error).message} onRetry={() => tasksQuery.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon={ListTodo} title="Không có công việc" description="Đổi bộ lọc hoặc tạo công việc mới trên bảng Kanban." actionLabel="Mở bảng Kanban" onAction={() => f.setView("board")} />
      ) : (
        <div className="rounded-xl border border-border/80 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {editable && (
                  <TableHead className="w-8">
                    <Checkbox
                      aria-label="Chọn tất cả công việc đang hiện"
                      checked={rows.length > 0 && rows.every((r) => sel.isSelected(r.id))}
                      onCheckedChange={(c) => (c ? sel.selectAll(rows.map((r) => r.id)) : sel.clear())}
                    />
                  </TableHead>
                )}
                <Head k="number" className="w-24">
                  Mã
                </Head>
                <Head k="title">Tiêu đề</Head>
                <FilterHead
                  label="Loại"
                  value={f.type}
                  onChange={(v) => f.set({ type: v })}
                  options={[{ value: "__all", label: "Mọi loại" }, ...TASK_TYPES.map((t) => ({ value: t, label: typeToLabel(t) }))]}
                />
                <FilterHead
                  label="Cột"
                  value={column}
                  onChange={(v) => setParam("column", v)}
                  options={[{ value: "__all", label: "Mọi cột" }, ...project.columns.map((c) => ({ value: c.id, label: c.name }))]}
                />
                <FilterHead
                  label="Ưu tiên"
                  value={priority}
                  onChange={(v) => setParam("priority", v)}
                  sortKeyOf="priority"
                  options={[{ value: "__all", label: "Mọi ưu tiên" }, ...["URGENT", "HIGH", "MEDIUM", "LOW"].map((p) => ({ value: p, label: p }))]}
                />
                <FilterHead
                  label="Người"
                  value={f.quick === "unassigned" ? "__unassigned" : f.assignee}
                  onChange={(v) => (v === "__unassigned" ? f.set({ quick: "unassigned", assignee: "__all" }) : f.set({ assignee: v, quick: "all" }))}
                  options={[
                    { value: "__all", label: "Mọi người" },
                    { value: "__unassigned", label: "Chưa giao" },
                    ...project.members.map((m) => ({ value: m.id, label: m.fullName })),
                  ]}
                />
                <Head k="estimateHours" className="text-right">
                  Giờ
                </Head>
                <Head k="progress" className="text-right">
                  %
                </Head>
                <FilterHead
                  label="Hạn"
                  value={due}
                  onChange={(v) => setParam("due", v)}
                  sortKeyOf="dueDate"
                  options={DUE_OPTIONS}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g) => (
                <React.Fragment key={g.id}>
                  <TableRow className="bg-muted hover:bg-muted border-y border-border/80">
                    <TableCell colSpan={editable ? 10 : 9} className="py-2">
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="font-semibold text-sm text-foreground">{g.sprint ? g.sprint.name : "Backlog"}</span>
                        {g.sprint ? (
                          <>
                            <Badge variant={g.sprint.status === "ACTIVE" ? "default" : "outline"} className="text-xs font-medium">
                              {sprintStatusLabel(g.sprint.status)}
                            </Badge>
                            <span className="text-muted-foreground tabular-nums">
                              {fmtDay(g.sprint.startDate)} – {fmtDay(g.sprint.endDate)}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">chưa vào sprint nào</span>
                        )}
                        <span className="ml-auto text-muted-foreground tabular-nums">
                          {g.tasks.length} việc · {g.done} xong · {g.hours}h
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                  {g.tasks.map((t) => {
                const col = project.columns.find((c) => c.id === t.columnId);
                const overdue = !!t.dueDate && !t.completedAt && t.dueDate.slice(0, 10) < today;
                return (
                  <TableRow
                    key={t.id}
                    data-state={sel.isSelected(t.id) ? "selected" : undefined}
                    className="cursor-pointer text-xs"
                    onClick={() => {
                      setSelectedId(t.id);
                      setDetailOpen(true);
                    }}
                  >
                    {editable && (
                      <TableCell onClick={stop} className="w-8">
                        <Checkbox
                          aria-label={`Chọn ${taskKeyOf(project.key, t)}`}
                          checked={sel.isSelected(t.id)}
                          // Shift-click chọn cả dải kể từ dòng bấm gần nhất (theo Jira)
                          onClick={(e) => sel.toggle(t.id, rows.map((r) => r.id), (e as React.MouseEvent).shiftKey)}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-mono">
                      <span className="inline-flex items-center gap-1">
                        {taskKeyOf(project.key, t)}
                        {t.source === "AI" && <Sparkles className="h-3 w-3 text-info" />}
                        {/* Mở thẳng trang chi tiết, không phải qua modal rồi bấm thêm lần nữa */}
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-muted-foreground hover:text-foreground"
                          aria-label={`Mở trang chi tiết ${taskKeyOf(project.key, t)}`}
                          title="Mở trang chi tiết (Ctrl+click để mở tab mới)"
                          onClick={stop}
                        >
                          <Link href={`/projects/${project.id}/tasks/${taskKeyOf(project.key, t)}`}>
                            <Maximize2 className="h-3 w-3" />
                          </Link>
                        </Button>
                      </span>
                    </TableCell>
                    <TableCell className="font-semibold text-foreground max-w-md truncate">{t.title}</TableCell>
                    <TableCell>
                      <TaskTypeBadge type={t.type} />
                    </TableCell>
                    <TableCell onClick={stop}>
                      {editable ? (
                        <Select
                          value={t.columnId}
                          onValueChange={(columnId) =>
                            mut.move.mutate({ id: t.id, version: t.version, columnId }, { onError: (e) => fail(e, "Chuyển cột", taskKeyOf(project.key, t)) })
                          }
                        >
                          <SelectTrigger className="h-6 w-auto border-none bg-transparent hover:bg-muted/80 p-0 shadow-none focus:ring-0 gap-1 text-xs">
                            <Badge variant={statusToVariant(col?.statusKey ?? "")} className="font-medium text-[11px] tracking-wide gap-1 cursor-pointer">
                              {col?.name ?? "—"}
                              <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {project.columns.map((c) => (
                              <SelectItem key={c.id} value={c.id} className="text-xs">
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={statusToVariant(col?.statusKey ?? "")} className="text-xs font-medium">
                          {col?.name ?? "—"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell onClick={stop}>
                      {editable ? (
                        <Select value={t.priority} onValueChange={(v) => patchRow(t, { priority: v }, "Đổi ưu tiên")}>
                          <SelectTrigger className="h-6 w-auto border-none bg-transparent hover:bg-muted/80 p-0 shadow-none focus:ring-0 gap-1">
                            <PriorityBadge priority={t.priority} showIcon={false} className="cursor-pointer font-normal border-border/60" />
                          </SelectTrigger>
                          <SelectContent>
                            {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((pr) => (
                              <SelectItem key={pr} value={pr} className="text-xs">
                                <PriorityBadge priority={pr} showIcon={false} />
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <PriorityBadge priority={t.priority} showIcon={false} />
                      )}
                    </TableCell>
                    <TableCell onClick={stop} className="w-44">
                      {editable ? (
                        <AssigneePicker
                          value={t.assignees.map((a) => a.id)}
                          members={project.members}
                          disabled={false}
                          onChange={(userIds) =>
                            mut.assignees.mutate({ id: t.id, version: t.version, userIds }, { onError: (e) => fail(e, "Giao việc", taskKeyOf(project.key, t)) })
                          }
                        />
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {t.assignees.slice(0, 2).map((a) => (
                            <UserAvatar key={a.id} name={a.shortName ?? a.fullName} avatar={a.avatarUrl ?? undefined} size="sm" />
                          ))}
                          {t.assignees.length === 0 && <span className="text-muted-foreground italic">chưa giao</span>}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{t.estimateHours != null ? `${t.estimateHours}h` : "—"}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{t.progress}%</TableCell>
                    <TableCell onClick={stop} className={cn("font-mono tabular-nums", overdue && "text-destructive font-medium")}>
                      {editable ? (
                        <Input
                          type="date"
                          value={t.dueDate ? t.dueDate.slice(0, 10) : ""}
                          onChange={(e) => patchRow(t, { dueDate: e.target.value || null }, "Đổi hạn")}
                          className="h-6 w-32 text-[11px] border-none bg-transparent hover:bg-muted/60 p-1 rounded font-mono shadow-none focus-visible:ring-1"
                        />
                      ) : (
                        fmtDay(t.dueDate)
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TaskDetailModal
        taskId={selectedId}
        project={project}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onOpenFullPage={() => {
          const t = (tasksQuery.data ?? []).find((x) => x.id === selectedId);
          if (!t) return;
          setDetailOpen(false);
          router.push(`/projects/${project.id}/tasks/${taskKeyOf(project.key, t)}`);
        }}
      />
    </div>
  );
}
