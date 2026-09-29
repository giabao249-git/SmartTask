"use client";

import * as React from "react";
import { CalendarRange, Grid2X2, Inbox, Kanban, ListTodo, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/app/PageHeader";
import { useAuth } from "@/lib/auth";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { useSlideEnter } from "@/lib/hooks/use-enter-animation";
import { useTasks } from "@/features/board/hooks";
import { KanbanBoard } from "@/features/board/KanbanBoard";
import { TaskListView } from "@/features/tasks/TaskListView";
import { TimelineGanttView } from "@/features/timeline/TimelineGanttView";
import { EisenhowerMatrixView } from "@/features/eisenhower/EisenhowerMatrixView";
import { BacklogView } from "@/features/backlog/BacklogView";
import { WorkFilterBar } from "./WorkFilterBar";
import { useWorkFilters, WORK_VIEWS, WorkFiltersProvider, type WorkView as ViewKey } from "./filters";
import { WorkSelectionProvider } from "./selection";
import { WorkFocusProvider, useWorkFocus } from "./focus";
import { BulkActionBar } from "./BulkActionBar";

const ICON: Record<ViewKey, typeof Kanban> = {
  board: Kanban,
  list: ListTodo,
  timeline: CalendarRange,
  eisenhower: Grid2X2,
  backlog: Inbox,
};

/** Màn "Công việc": 4 cách nhìn cùng một tập task (GET /projects/:id/tasks), chung bộ lọc và chung cache. */
export function WorkView() {
  const project = useCurrentProject();
  return (
    <WorkFiltersProvider defaultSprintId={project.activeSprint?.id}>
      <WorkSelectionProvider>
        <WorkFocusProvider>
          <WorkBody />
        </WorkFocusProvider>
      </WorkSelectionProvider>
    </WorkFiltersProvider>
  );
}

function WorkBody() {
  const project = useCurrentProject();
  const auth = useAuth();
  const f = useWorkFilters();
  // Cùng khoá với 4 view bên trong → chỉ một lần gọi API cho cả màn
  const tasks = useTasks(project.id, f.query);
  const counts = React.useMemo(() => {
    const list = tasks.data ?? [];
    const selfId = auth.user?.id;
    return {
      my: selfId ? list.filter((t) => t.assignees.some((a) => a.id === selfId)).length : 0,
      unassigned: list.filter((t) => t.assignees.length === 0).length,
    };
  }, [tasks.data, auth.user?.id]);

  const current = WORK_VIEWS.find((v) => v.key === f.view) ?? WORK_VIEWS[0];
  const { focus, toggle, off } = useWorkFocus();
  // Đổi cách nhìn (Bảng/Danh sách/Timeline…) chỉ đổi ?view= chứ không đổi trang → trượt ngang theo hướng tab vừa bấm.
  // Theo vị trí view chứ không theo cả URL, để gõ ô tìm kiếm hay đổi bộ lọc không làm nội dung nháy.
  const viewRef = useSlideEnter<HTMLDivElement>(WORK_VIEWS.findIndex((v) => v.key === f.view), { axis: "x" });

  /** Phím F bật/tắt chế độ tập trung — bỏ qua khi đang gõ hoặc đang mở modal/menu. */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "f" && e.key !== "F") return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[role="dialog"]:not([data-state="closed"]),[role="alertdialog"]:not([data-state="closed"]),[role="menu"],[cmdk-root]')) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [toggle]);

  return (
    <div className="space-y-4">
      {focus ? (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Công việc · {project.key}</span>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={off}>
            <Minimize2 className="h-3.5 w-3.5" /> Thoát tập trung
            <kbd className="ml-1 rounded border bg-background px-1 font-mono text-[10px]">F</kbd>
          </Button>
        </div>
      ) : (
      <PageHeader
        title={`Công việc · ${project.key}`}
        description="Bốn cách nhìn cùng một danh sách công việc — đổi cách nhìn vẫn giữ nguyên bộ lọc."
        breadcrumbs={[
          { label: "Workspace", href: "/workspaces" },
          { label: project.name, href: `/projects/${project.id}/dashboard` },
          { label: current.label },
        ]}
      />
      )}

      {/* Chọn cách nhìn: tab trên màn rộng, select trên điện thoại */}
      <div className="flex items-center gap-3 flex-wrap">
        <Tabs value={f.view} onValueChange={(v) => f.setView(v as ViewKey)} className="hidden sm:block">
          <TabsList className="h-9">
            {WORK_VIEWS.map((v) => {
              const Icon = ICON[v.key];
              return (
                <TabsTrigger key={v.key} value={v.key} className="text-xs gap-1.5">
                  <Icon className="h-3.5 w-3.5" />
                  {v.short}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
        <Select value={f.view} onValueChange={(v) => f.setView(v as ViewKey)}>
          <SelectTrigger className="h-9 text-xs w-48 sm:hidden">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WORK_VIEWS.map((v) => (
              <SelectItem key={v.key} value={v.key} className="text-xs">
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <WorkFilterBar counts={counts} syncing={tasks.isFetching} />

      <div ref={viewRef}>
        {f.view === "board" && <KanbanBoard />}
        {f.view === "list" && <TaskListView />}
        {f.view === "timeline" && <TimelineGanttView />}
        {f.view === "eisenhower" && <EisenhowerMatrixView />}
        {f.view === "backlog" && <BacklogView />}
      </div>

      {/* Chọn nhiều dùng chung cho Bảng và Danh sách nên thanh hành động đặt ở đây */}
      {(f.view === "board" || f.view === "list" || f.view === "backlog") && <BulkActionBar project={project} tasks={tasks.data ?? []} />}
    </div>
  );
}
