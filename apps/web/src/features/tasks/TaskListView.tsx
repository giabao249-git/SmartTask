"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, Search, Sparkles, ListTodo } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/app/PageHeader";
import { PriorityBadge } from "@/components/app/PriorityBadge";
import { UserAvatar } from "@/components/app/UserAvatar";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { TaskDetailSheet } from "@/components/app/TaskDetailSheet";
import { fmtDay, taskKeyOf } from "@/components/app/TaskCard";
import { describeError } from "@/lib/api";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { useSprints } from "@/lib/hooks/queries";
import { statusToVariant } from "@/lib/status";
import type { TaskListItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useBoardRealtime, useTasks } from "@/features/board/hooks";

type SortKey = "number" | "title" | "priority" | "dueDate" | "estimateHours" | "progress" | "updatedAt";
const PRIORITY_RANK: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

/** Danh sách task (UC-15): bộ lọc lưu trong URL, sắp xếp cột, cùng dữ liệu với Kanban. */
export function TaskListView() {
  const project = useCurrentProject();
  const router = useRouter();
  const params = useSearchParams();
  const sprintsQuery = useSprints(project.id);
  const get = (k: string, d = "") => params.get(k) ?? d;
  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v && v !== "__all") next.set(k, v);
    else next.delete(k);
    router.replace(`?${next.toString()}`);
  };
  const sprint = get("sprint", "__all");
  const assignee = get("assignee", "__all");
  const priority = get("priority", "__all");
  const column = get("column", "__all");
  const q = get("q");
  const sortKey = (get("sort", "number") as SortKey) || "number";
  const sortDir = get("dir", "asc") === "desc" ? "desc" : "asc";

  const tasksQuery = useTasks(project.id, {
    sprintId: sprint !== "__all" && sprint !== "__backlog" ? sprint : undefined,
    backlog: sprint === "__backlog" || undefined,
    assigneeId: assignee !== "__all" ? assignee : undefined,
    priority: priority !== "__all" ? priority : undefined,
    q: q || undefined,
  });
  useBoardRealtime(project.id);
  const [selectedId, setSelectedId] = React.useState<string | null>(params.get("task"));
  const [sheetOpen, setSheetOpen] = React.useState(!!params.get("task"));

  const rows = React.useMemo(() => {
    const list = (tasksQuery.data ?? []).filter((t) => column === "__all" || t.columnId === column);
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
  }, [tasksQuery.data, column, sortKey, sortDir]);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Danh sách công việc · ${project.key}`}
        description={`${rows.length} công việc theo bộ lọc hiện tại (lưu trong URL)`}
        breadcrumbs={[{ label: "Workspace", href: "/workspaces" }, { label: project.name, href: `/projects/${project.id}/dashboard` }, { label: "Danh sách task" }]}
      />

      <div className="flex items-center gap-2 flex-wrap text-xs">
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input defaultValue={q} onChange={(e) => setParam("q", e.target.value)} placeholder="Tìm tiêu đề…" className="h-8 text-xs pl-8 w-56" />
        </div>
        <Select value={sprint} onValueChange={(v) => setParam("sprint", v)}>
          <SelectTrigger className="h-8 text-xs w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all" className="text-xs">
              Mọi sprint
            </SelectItem>
            <SelectItem value="__backlog" className="text-xs">
              Backlog
            </SelectItem>
            {(sprintsQuery.data ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id} className="text-xs">
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        <Select value={assignee} onValueChange={(v) => setParam("assignee", v)}>
          <SelectTrigger className="h-8 text-xs w-40">
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
        <EmptyState icon={ListTodo} title="Không có công việc" description="Đổi bộ lọc hoặc tạo công việc mới trên bảng Kanban." actionLabel="Mở bảng Kanban" onAction={() => router.push(`/projects/${project.id}/board`)} />
      ) : (
        <div className="rounded-xl border border-border/80 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <Head k="number" className="w-24">
                  Mã
                </Head>
                <Head k="title">Tiêu đề</Head>
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
                    className="cursor-pointer text-xs"
                    onClick={() => {
                      setSelectedId(t.id);
                      setSheetOpen(true);
                    }}
                  >
                    <TableCell className="font-mono">
                      <span className="inline-flex items-center gap-1">
                        {taskKeyOf(project.key, t)}
                        {t.source === "AI" && <Sparkles className="h-3 w-3 text-info" />}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium max-w-md truncate">{t.title}</TableCell>
                    <TableCell>
                      <Badge variant={statusToVariant(col?.statusKey ?? "")} className="text-[10px]">
                        {col?.name ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={t.priority} showIcon={false} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {t.assignees.slice(0, 2).map((a) => (
                          <UserAvatar key={a.id} name={a.shortName ?? a.fullName} avatar={a.avatarUrl ?? undefined} size="sm" />
                        ))}
                        {t.assignees.length === 0 && <span className="text-muted-foreground italic">chưa giao</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">{t.estimateHours ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono">{t.progress}</TableCell>
                    <TableCell className={cn("font-mono", overdue && "text-destructive font-medium")}>{fmtDay(t.dueDate)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <TaskDetailSheet taskId={selectedId} project={project} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
