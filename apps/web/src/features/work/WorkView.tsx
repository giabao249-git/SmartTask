"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, CalendarRange, ChevronDown, Grid2X2, Kanban, ListTodo, Minimize2, Scale, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/app/PageHeader";
import { contentVariants } from "@/lib/motion";
import { useAuth } from "@/lib/auth";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { useBoardRealtime, useTasks } from "@/features/board/hooks";
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
};

/** Màn "Công việc": các cách nhìn cùng một tập task (GET /projects/:id/tasks), chung bộ lọc và chung cache. */
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

  // Kích hoạt đồng bộ thời gian thực Socket.IO cho cả 4 chế độ xem (Bảng, Danh sách, Timeline, Eisenhower)
  useBoardRealtime(project.id, {
    view: f.view,
    selfId: auth.user?.id,
  });

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

  const router = useRouter();
  const isLeader =
    auth.user?.isSuperAdmin ||
    auth.workspaces.some(
      (w) => w.id === project.workspaceId && (w.role === "OWNER" || w.role === "ADMIN"),
    );

  const viewSwitcher = (
    <div className="flex items-center gap-2">
      <Tabs
        value={f.view}
        onValueChange={(v) => f.setView(v as ViewKey)}
        layoutId="project-work-views"
        className="hidden md:block"
      >
        <TabsList className="h-8 p-0.5 bg-muted/70">
          {WORK_VIEWS.map((v) => {
            const Icon = ICON[v.key];
            return (
              <TabsTrigger key={v.key} value={v.key} className="text-xs gap-1.5 px-2.5 h-7">
                <Icon className="h-3.5 w-3.5" />
                {v.short}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
      <Select value={f.view} onValueChange={(v) => f.setView(v as ViewKey)}>
        <SelectTrigger className="h-8 text-xs w-36 md:hidden">
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
  );

  const aiActions = isLeader && router ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5 border-violet-500/40 bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-indigo-500/10 hover:from-violet-500/20 hover:to-indigo-500/20 text-violet-700 dark:text-violet-300 font-medium px-3 shadow-2xs"
          title="Các công cụ thông minh tích hợp AI Agent"
        >
          <Sparkles className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
          <span>Công cụ AI ✨</span>
          <ChevronDown className="h-3 w-3 opacity-70 ml-0.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-1 text-xs shadow-md">
        <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1.5">
          Tác vụ AI Agent
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push(`/projects/${project.id}/ai-decompose`)}
          className="gap-2.5 cursor-pointer py-2 text-xs"
        >
          <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div className="flex flex-col text-left">
            <span className="font-semibold text-foreground">Phân rã AI (WBS)</span>
            <span className="text-xs text-muted-foreground">Tự động bẻ nhỏ requirement</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push(`/projects/${project.id}/people?tab=load`)}
          className="gap-2.5 cursor-pointer py-2 text-xs"
        >
          <Scale className="h-4 w-4 text-info shrink-0" />
          <div className="flex flex-col text-left">
            <span className="font-semibold text-foreground">Cân bằng tải AI</span>
            <span className="text-xs text-muted-foreground">Phân bổ workload nhân sự</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push(`/projects/${project.id}/assistant`)}
          className="gap-2.5 cursor-pointer py-2 text-xs"
        >
          <Bot className="h-4 w-4 text-primary shrink-0" />
          <div className="flex flex-col text-left">
            <span className="font-semibold text-foreground">Trợ lý AI SmartTask</span>
            <span className="text-xs text-muted-foreground">Hỏi đáp & tự động hóa</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  return (
    <div className="space-y-4">
      {focus ? (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Công việc · {project.key}</span>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={off}>
            <Minimize2 className="h-3.5 w-3.5" /> Thoát tập trung
            <kbd className="ml-1 rounded border bg-background px-1.5 py-0.5 font-mono text-[11px]">F</kbd>
          </Button>
        </div>
      ) : (
      <PageHeader
        title={`Công việc · ${project.key}`}
        breadcrumbs={[
          { label: "Workspace", href: "/workspaces" },
          { label: project.name, href: `/projects/${project.id}/dashboard` },
          { label: current.label },
        ]}
      />
      )}

      {/* Toolbar thống nhất: Tabs chuyển view + bộ lọc + nút tác vụ AI nằm chung một dòng */}
      <WorkFilterBar counts={counts} syncing={tasks.isFetching} leftSlot={viewSwitcher} rightSlot={aiActions} />

      <AnimatePresence mode="wait">
        <motion.div
          key={f.view}
          variants={contentVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {f.view === "board" && <KanbanBoard />}
          {/* Backlog = Danh sách lọc sprint "Backlog": cùng dữ liệu, chỉ thêm kéo thả xếp thứ tự */}
          {f.view === "list" && (f.sprint === "__backlog" ? <BacklogView /> : <TaskListView />)}
          {f.view === "timeline" && <TimelineGanttView />}
          {f.view === "eisenhower" && <EisenhowerMatrixView />}
        </motion.div>
      </AnimatePresence>

      {/* Chọn nhiều dùng chung cho Bảng và Danh sách nên thanh hành động đặt ở đây */}
      {(f.view === "board" || f.view === "list") && <BulkActionBar project={project} tasks={tasks.data ?? []} />}
    </div>
  );
}
