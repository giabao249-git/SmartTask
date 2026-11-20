"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

interface WorkDetailContextValue {
  selectedTaskId: string | null;
  openTask: (id: string) => void;
  closeTask: () => void;
}

const WorkDetailContext = React.createContext<WorkDetailContextValue | null>(null);

export function WorkDetailProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("task");
    }
    return searchParams.get("task");
  });

  // Ghi nhớ URL param để chỉ mở khi URL bên ngoài thật sự thay đổi (router navigate)
  const prevUrlSearchRef = React.useRef(searchParams.get("task"));
  React.useEffect(() => {
    const current = searchParams.get("task");
    if (current && current !== prevUrlSearchRef.current) {
      prevUrlSearchRef.current = current;
      setSelectedTaskId(current);
    }
  }, [searchParams]);

  // Lắng nghe sự kiện Back/Forward của trình duyệt để đóng/mở panel theo URL
  React.useEffect(() => {
    const handlePopState = () => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      const taskFromUrl = params.get("task");
      prevUrlSearchRef.current = taskFromUrl;
      setSelectedTaskId(taskFromUrl);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const updateUrl = React.useCallback((taskId: string | null) => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      if (taskId) {
        url.searchParams.set("task", taskId);
      } else {
        url.searchParams.delete("task");
      }
      window.history.replaceState(window.history.state, "", url.toString());
      prevUrlSearchRef.current = taskId;
    } catch {
      /* ignore URL errors */
    }
  }, []);

  const openTask = React.useCallback(
    (id: string) => {
      setSelectedTaskId(id);
      updateUrl(id);
    },
    [updateUrl],
  );

  const closeTask = React.useCallback(() => {
    setSelectedTaskId(null);
    updateUrl(null);
  }, [updateUrl]);

  // Phím Esc đóng panel khi không trong ô nhập
  React.useEffect(() => {
    if (!selectedTaskId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return;
      // Bỏ qua nếu đang mở dropdown/popover/alert
      if (document.querySelector('[role="menu"],[data-radix-popper-content-wrapper],[role="alertdialog"]')) return;
      e.preventDefault();
      closeTask();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [selectedTaskId, closeTask]);

  const value = React.useMemo(
    () => ({
      selectedTaskId,
      openTask,
      closeTask,
    }),
    [selectedTaskId, openTask, closeTask],
  );

  return <WorkDetailContext.Provider value={value}>{children}</WorkDetailContext.Provider>;
}

export function useWorkDetail(): WorkDetailContextValue {
  const ctx = React.useContext(WorkDetailContext);
  if (!ctx) {
    throw new Error("useWorkDetail must be used within a <WorkDetailProvider>");
  }
  return ctx;
}
