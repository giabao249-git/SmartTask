"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, Sparkles, ListTodo } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { AssigneePicker } from "@/components/app/TaskFieldPickers";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PriorityBadge } from "@/components/app/PriorityBadge";
import { TaskTypeBadge } from "@/components/app/TaskTypeBadge";
import { UserAvatar } from "@/components/app/UserAvatar";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { TaskDetailSheet } from "@/components/app/TaskDetailSheet";
import { fmtDay, taskKeyOf } from "@/components/app/TaskCard";
import { describeError } from "@/lib/api";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { useAuth } from "@/lib/auth";
import { useWorkFilters } from "@/features/work/filters";
import { useWorkSelection } from "@/features/work/selection";
import { Checkbox } from "@/components/ui/checkbox";
import { statusToVariant } from "@/lib/status";
import type { TaskListItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useBoardRealtime, useTaskMutations, useTasks } from "@/features/board/hooks";

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
  const [sheetOpen, setSheetOpen] = React.useState(!!params.get("task"));
  /**
   * `?task=` phải mở Sheet cả khi điều hướng trong trang (bảng lệnh, thông báo, link đã chia sẻ),
   * không chỉ lúc tải lần đầu — trước đây state chỉ đọc param một lần khi mount.
   */
  const urlTaskId = params.get("task");
  React.useEffect(() => {
    if (!urlTaskId) return;
    setSelectedId(urlTaskId);
    setSheetOpen(true);
  }, [urlTaskId]);

  const rows = React.useMemo(() => {
    const list = f
      .applyQuick(tasksQuery.data ?? [], auth.user?.id)
      .filter((t) => column === "__all" || t.columnId === column)
      .filter((t) => priority === "__all" || t.priority === priority);
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
  }, [tasksQuery.data, column, priority, sortKey, sortDir, f, auth.user?.id]);

  const toggleSort = (k: SortKey) => {
    const next = new URLSearchParams(params.toString());
    if (sortKey === k) next.set("dir", sortDir === "asc" ? "desc" : "asc");
    else {
      next.set("sort", k);
      next.set("dir", "asc");
    }
    router.replace(`?${next.toString()}`);
  };
  const Head = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <TableHead className={cn("text-xs cursor-pointer select-none", className)} onClick={() => toggleSort(k)}>
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown className={cn("h-3 w-3", sortKey === k ? "text-foreground" : "text-muted-foreground/50")} />
      </span>
    </TableHead>
  );
  const today = new Date().toISOString().slice(0, 10);
  /** Ô sửa tại chỗ không được để click lan ra làm mở Sheet. */
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="space-y-6">

      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="text-muted-foreground">Lọc riêng của bảng:</span>
        <Select value={column} onValueChange={(v) => setParam("column", v)}>
          <SelectTrigger className="h-8 text-xs w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all" className="text-xs">
              Mọi cột
            </SelectItem>
            {project.columns.map((c) => (
              <SelectItem key={c.id} value={c.id} className="text-xs">
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={(v) => setParam("priority", v)}>
          <SelectTrigger className="h-8 text-xs w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all" className="text-xs">
              Mọi ưu tiên
            </SelectItem>
            {["URGENT", "HIGH", "MEDIUM", "LOW"].map((p) => (
              <SelectItem key={p} value={p} className="text-xs">
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground ml-auto">{rows.length} công việc</span>
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
                <TableHead className="text-xs">Loại</TableHead>
                <TableHead className="text-xs">Cột</TableHead>
                <Head k="priority">Ưu tiên</Head>
                <TableHead className="text-xs">Người</TableHead>
                <Head k="estimateHours" className="text-right">
                  Giờ
                </Head>
                <Head k="progress" className="text-right">
                  %
                </Head>
                <Head k="dueDate">Hạn</Head>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => {
                const col = project.columns.find((c) => c.id === t.columnId);
                const overdue = !!t.dueDate && !t.completedAt && t.dueDate.slice(0, 10) < today;
                return (
                  <TableRow
                    key={t.id}
                    data-state={sel.isSelected(t.id) ? "selected" : undefined}
                    className="cursor-pointer text-xs"
                    onClick={() => {
                      setSelectedId(t.id);
                      setSheetOpen(true);
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
                      </span>
                    </TableCell>
                    <TableCell className="font-medium max-w-md truncate">{t.title}</TableCell>
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
                          <SelectTrigger className="h-7 w-32 text-[11px] border-transparent hover:border-border px-2">
                            <SelectValue />
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
                        <Badge variant={statusToVariant(col?.statusKey ?? "")} className="text-[10px]">
                          {col?.name ?? "—"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell onClick={stop}>
                      {editable ? (
                        <Select value={t.priority} onValueChange={(v) => patchRow(t, { priority: v }, "Đổi ưu tiên")}>
                          <SelectTrigger className="h-7 w-28 text-[11px] border-transparent hover:border-border px-2">
                            <SelectValue />
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
                    <TableCell className="text-right font-mono">{t.estimateHours ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono">{t.progress}</TableCell>
                    <TableCell onClick={stop} className={cn("font-mono", overdue && "text-destructive font-medium")}>
                      {editable ? (
                        <Input
                          type="date"
                          value={t.dueDate ? t.dueDate.slice(0, 10) : ""}
                          onChange={(e) => patchRow(t, { dueDate: e.target.value || null }, "Đổi hạn")}
                          className="h-7 w-32 text-[11px] border-transparent hover:border-border px-2"
                        />
                      ) : (
                        fmtDay(t.dueDate)
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <TaskDetailSheet
        taskId={selectedId}
        project={project}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onOpenFullPage={() => {
          const t = (tasksQuery.data ?? []).find((x) => x.id === selectedId);
          if (!t) return;
          setSheetOpen(false);
          router.push(`/projects/${project.id}/tasks/${taskKeyOf(project.key, t)}`);
        }}
      />
    </div>
  );
}
