"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { TaskListItem } from "@/lib/types";

export type WorkView = "board" | "list" | "timeline" | "eisenhower";
export type QuickFilter = "all" | "my" | "unassigned";
/** Nhóm thẻ trên bảng Kanban thành các hàng (swimlane). */
export type GroupBy = "none" | "assignee" | "priority";

export const WORK_VIEWS: { key: WorkView; label: string; short: string }[] = [
  { key: "board", label: "Bảng Kanban", short: "Bảng" },
  { key: "list", label: "Danh sách", short: "Danh sách" },
  { key: "timeline", label: "Gantt / Timeline", short: "Timeline" },
  { key: "eisenhower", label: "Ma trận Eisenhower", short: "Eisenhower" },
];

export interface WorkFilters {
  /** "__all" | "__backlog" | id sprint */
  sprint: string;
  /** "__all" | id người */
  assignee: string;
  /** "__all" | STORY | TASK | BUG */
  type: string;
  /** Nhóm bảng Kanban theo người thực hiện hoặc ưu tiên; "none" = không nhóm */
  group: GroupBy;
  q: string;
  quick: QuickFilter;
}

interface WorkFiltersCtx extends WorkFilters {
  view: WorkView;
  setView: (v: WorkView) => void;
  set: (patch: Partial<WorkFilters>) => void;
  /** Lọc phía client cho "Việc của tôi" / "Chưa giao" (server không có tham số này). */
  applyQuick: (tasks: TaskListItem[], selfId?: string) => TaskListItem[];
  /** Tham số gửi lên GET /projects/:id/tasks — dùng chung nên đổi view không gọi lại API. */
  query: { sprintId?: string; backlog?: true; assigneeId?: string; type?: string; q?: string };
  /** Có bộ lọc nào khác mặc định không — sprint đang chạy là mặc định nên không tính là "đang lọc". */
  isFiltered: boolean;
  /** Đưa mọi bộ lọc về mặc định. */
  clear: () => void;
  taskId: string | null;
  setTaskId: (id: string | null) => void;
}

const Ctx = React.createContext<WorkFiltersCtx | null>(null);

const isView = (v: string | null): v is WorkView => WORK_VIEWS.some((x) => x.key === v);

/**
 * Bộ lọc dùng chung cho 4 cách nhìn công việc, đồng bộ vào URL (`?view=&sprint=&assignee=&q=&quick=&task=`)
 * để đổi tab không mất lọc, F5 và chia sẻ link vẫn ra đúng khung nhìn.
 */
export function WorkFiltersProvider({ defaultSprintId, children }: { defaultSprintId?: string; children: React.ReactNode }) {
  const router = useRouter();
  const params = useSearchParams();
  const get = (k: string, d = "") => params.get(k) ?? d;

  const view: WorkView = isView(params.get("view")) ? (params.get("view") as WorkView) : "board";
  const sprint = get("sprint") || defaultSprintId || "__all";
  const assignee = get("assignee", "__all");
  const type = get("type", "__all");
  const group = (["none", "assignee", "priority"] as const).find((x) => x === get("group")) ?? "none";
  const q = get("q");
  const quick = (["all", "my", "unassigned"] as const).find((x) => x === get("quick")) ?? "all";
  const taskId = params.get("task");

  const write = React.useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (!v || v === "__all") next.delete(k);
        else next.set(k, v);
      }
      router.replace(`?${next.toString()}`, { scroll: false });
    },
    [params, router],
  );

  const explicitSprint = params.get("sprint");

  const value = React.useMemo<WorkFiltersCtx>(() => {
    const query = {
      sprintId: sprint !== "__all" && sprint !== "__backlog" ? sprint : undefined,
      backlog: sprint === "__backlog" ? (true as const) : undefined,
      assigneeId: assignee !== "__all" ? assignee : undefined,
      type: type !== "__all" ? type : undefined,
      q: q.trim() || undefined,
    };
    return {
      view,
      sprint,
      assignee,
      type,
      group,
      q,
      quick,
      taskId,
      query,
      isFiltered:
        (explicitSprint !== null && explicitSprint !== (defaultSprintId ?? "__all")) ||
        assignee !== "__all" ||
        type !== "__all" ||
        q.trim() !== "" ||
        quick !== "all",
      clear: () => write({ sprint: null, assignee: null, type: null, q: null, quick: null }),
      setView: (v) => write({ view: v === "board" ? null : v }),
      set: (patch) =>
        write(
          Object.fromEntries(
            Object.entries(patch).map(([k, v]) => [k, v === undefined ? null : String(v)]),
          ),
        ),
      setTaskId: (id) => write({ task: id }),
      applyQuick: (tasks, selfId) =>
        quick === "my"
          ? tasks.filter((t) => (selfId ? t.assignees.some((a) => a.id === selfId) : true))
          : quick === "unassigned"
            ? tasks.filter((t) => t.assignees.length === 0)
            : tasks,
    };
  }, [view, sprint, assignee, type, group, q, quick, taskId, write, explicitSprint, defaultSprintId]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkFilters(): WorkFiltersCtx {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useWorkFilters phải nằm trong <WorkFiltersProvider>");
  return v;
}
