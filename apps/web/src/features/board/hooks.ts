"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getSocket, joinProject } from "@/lib/socket";
import type { AttachmentView, CommentView, Paged, SuggestItem, TaskDetail, TaskListItem, TaskListResponse } from "@/lib/types";

export const taskKeys = {
  list: (projectId: string) => ["projects", projectId, "tasks"] as const,
  detail: (id: string) => ["tasks", id] as const,
  comments: (id: string) => ["tasks", id, "comments"] as const,
  attachments: (id: string) => ["tasks", id, "attachments"] as const,
};

export interface TaskFilters {
  sprintId?: string;
  assigneeId?: string;
  /** STORY | TASK | BUG — bỏ trống = mọi loại */
  type?: string;
  q?: string;
  priority?: string;
  backlog?: boolean;
}

/** GET /projects/:id/tasks → { items, deletedIds, serverTime } (docs 11 §3.6); task gốc, không phân trang. */
export function useTasks(projectId: string, filters: TaskFilters = {}) {
  return useQuery({
    queryKey: [...taskKeys.list(projectId), filters] as const,
    queryFn: () => api.get<TaskListResponse>(`/projects/${projectId}/tasks`, { ...filters, backlog: filters.backlog ? "true" : undefined }),
    select: (r) => r.items,
  });
}

export function useTask(id: string | null) {
  return useQuery({ queryKey: taskKeys.detail(id ?? ""), queryFn: () => api.get<TaskDetail>(`/tasks/${id}`), enabled: !!id });
}

/** Thay/cập nhật một task trong mọi danh sách đang cache của dự án. */
export function useTaskCache(projectId: string) {
  const qc = useQueryClient();
  return React.useMemo(
    () => ({
      upsert(task: TaskListItem) {
        qc.setQueriesData<TaskListResponse>({ queryKey: taskKeys.list(projectId) }, (cur) => {
          if (!cur) return cur;
          const exists = cur.items.some((t) => t.id === task.id);
          return { ...cur, items: exists ? cur.items.map((t) => (t.id === task.id ? { ...t, ...task } : t)) : [task, ...cur.items] };
        });
        qc.setQueryData<TaskDetail>(taskKeys.detail(task.id), (cur) => (cur ? { ...cur, ...task } : cur));
      },
      remove(taskId: string) {
        qc.setQueriesData<TaskListResponse>({ queryKey: taskKeys.list(projectId) }, (cur) => (cur ? { ...cur, items: cur.items.filter((t) => t.id !== taskId) } : cur));
      },
      invalidate() {
        void qc.invalidateQueries({ queryKey: taskKeys.list(projectId) });
      },
    }),
    [qc, projectId],
  );
}

/** PATCH /tasks/:id/move {version, columnId, position?} — optimistic; 409/422 → hoàn tác + ném lỗi cho caller toast. */
export function useMoveTask(projectId: string) {
  const qc = useQueryClient();
  const cache = useTaskCache(projectId);
  return useMutation({
    mutationFn: (v: { task: TaskListItem; columnId: string; position?: number }) =>
      api.patch<TaskDetail>(`/tasks/${v.task.id}/move`, { version: v.task.version, columnId: v.columnId, position: v.position }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: taskKeys.list(projectId) });
      const snapshot = qc.getQueriesData<TaskListResponse>({ queryKey: taskKeys.list(projectId) });
      cache.upsert({ ...v.task, columnId: v.columnId, position: v.position ?? v.task.position });
      return { snapshot };
    },
    onError: (_e, _v, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSuccess: (task) => cache.upsert(task),
  });
}

export function useTaskMutations(projectId: string) {
  const qc = useQueryClient();
  const cache = useTaskCache(projectId);
  const done = (task: TaskDetail) => {
    cache.upsert(task);
    qc.setQueryData(taskKeys.detail(task.id), task);
    if (task.parentId) void qc.invalidateQueries({ queryKey: taskKeys.detail(task.parentId) });
  };
  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<TaskDetail>(`/projects/${projectId}/tasks`, body),
    onSuccess: done,
  });
  const update = useMutation({
    mutationFn: (v: { id: string; version: number; patch: Record<string, unknown> }) => api.patch<TaskDetail>(`/tasks/${v.id}`, { version: v.version, ...v.patch }),
    onSuccess: done,
  });
  const progress = useMutation({
    mutationFn: (v: { id: string; version: number; progress?: number; remainingHours?: number }) =>
      api.patch<TaskDetail>(`/tasks/${v.id}/progress`, { version: v.version, progress: v.progress, remainingHours: v.remainingHours }),
    onSuccess: done,
  });
  const assignees = useMutation({
    mutationFn: (v: { id: string; version: number; userIds: string[] }) => api.put<TaskDetail>(`/tasks/${v.id}/assignees`, { version: v.version, userIds: v.userIds }),
    onSuccess: done,
  });
  const labels = useMutation({
    mutationFn: (v: { id: string; version: number; labelIds: string[] }) => api.put<TaskDetail>(`/tasks/${v.id}/labels`, { version: v.version, labelIds: v.labelIds }),
    onSuccess: done,
  });
  const skills = useMutation({
    mutationFn: (v: { id: string; version: number; skills: { skillId: string; minLevel: number }[] }) => api.put<TaskDetail>(`/tasks/${v.id}/skills`, { version: v.version, skills: v.skills }),
    onSuccess: done,
  });
  const dependencies = useMutation({
    mutationFn: (v: { id: string; version: number; dependsOnIds: string[] }) => api.put<TaskDetail>(`/tasks/${v.id}/dependencies`, { version: v.version, dependsOnIds: v.dependsOnIds }),
    onSuccess: done,
  });
  const subtask = useMutation({
    mutationFn: (v: { parentId: string; title: string; estimateHours?: number }) => api.post<TaskDetail>(`/tasks/${v.parentId}/subtasks`, { title: v.title, estimateHours: v.estimateHours }),
    onSuccess: (t) => {
      void qc.invalidateQueries({ queryKey: taskKeys.detail(t.parentId ?? "") });
      cache.invalidate();
    },
  });
  const move = useMutation({
    mutationFn: (v: { id: string; version: number; columnId: string }) => api.patch<TaskDetail>(`/tasks/${v.id}/move`, { version: v.version, columnId: v.columnId }),
    onSuccess: done,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: (_r, id) => {
      cache.remove(id);
      qc.removeQueries({ queryKey: taskKeys.detail(id) });
    },
  });
  return { create, update, progress, assignees, labels, skills, dependencies, subtask, move, remove };
}

export function useComments(taskId: string | null) {
  return useQuery({
    queryKey: taskKeys.comments(taskId ?? ""),
    queryFn: () => api.get<Paged<CommentView>>(`/tasks/${taskId}/comments`, { limit: 100 }),
    enabled: !!taskId,
    select: (r) => r.items,
  });
}

export function useCommentMutations(taskId: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: taskKeys.comments(taskId) });
  const create = useMutation({
    mutationFn: (v: { body: string; mentionUserIds: string[] }) => api.post<CommentView>(`/tasks/${taskId}/comments`, v),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/comments/${id}`), onSuccess: invalidate });
  return { create, remove };
}

export function useSuggestMembers(projectId: string, q: string) {
  return useQuery({
    queryKey: ["projects", projectId, "suggest", q] as const,
    queryFn: () => api.get<{ provider: string; items: SuggestItem[] }>(`/projects/${projectId}/members/suggest`, { q, limit: 8 }),
    enabled: q.length >= 1,
    select: (r) => r.items,
    staleTime: 30_000,
  });
}

export function useAttachments(taskId: string | null) {
  return useQuery({ queryKey: taskKeys.attachments(taskId ?? ""), queryFn: () => api.get<AttachmentView[]>(`/tasks/${taskId}/attachments`), enabled: !!taskId });
}

/** Ba bước (docs 11 §3.7): sign → PUT tệp lên uploadUrl → confirm metadata. */
export function useUploadAttachment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const meta = { fileName: file.name, mime: file.type || "application/octet-stream", sizeBytes: file.size };
      const signed = await api.post<{ uploadUrl: string; storagePath: string; expiresAt: string }>(`/tasks/${taskId}/attachments/sign`, meta);
      const put = await fetch(signed.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": meta.mime } });
      if (!put.ok) throw new Error(`Tải tệp lên thất bại (HTTP ${put.status})`);
      return api.post<AttachmentView>(`/tasks/${taskId}/attachments`, { ...meta, storagePath: signed.storagePath });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: taskKeys.attachments(taskId) }),
  });
}

export function useDeleteAttachment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.delete(`/attachments/${id}`), onSuccess: () => void qc.invalidateQueries({ queryKey: taskKeys.attachments(taskId) }) });
}

export async function downloadAttachment(id: string): Promise<string> {
  const r = await api.get<{ url: string; expiresAt: string }>(`/attachments/${id}/download-url`);
  return r.url;
}

interface TaskSocketPayload {
  task?: { id: string; version: number; assigneeIds?: string[] };
  taskId?: string;
  version?: number;
  actorId?: string;
  diffKeys?: string[];
}

/**
 * Vào phòng dự án và nghe task:* / comment:* (docs 11 §4). Payload socket là bản rút gọn (assigneeIds, không có tên)
 * nên chỉ dùng để BÁO — dữ liệu thật tải lại qua REST (danh sách ≤ 1.000 task, gộp 300 ms). Sự kiện do chính mình gây
 * ra đã được mutation cập nhật nên bỏ qua.
 */
export function useBoardRealtime(projectId: string, opts: { selfId?: string; onTaskEvent?: (ev: string, p: TaskSocketPayload) => void } = {}) {
  const qc = useQueryClient();
  const handler = React.useRef(opts.onTaskEvent);
  handler.current = opts.onTaskEvent;
  const selfId = opts.selfId;
  React.useEffect(() => {
    const leave = joinProject(projectId, "board");
    const s = getSocket();
    if (!s) return leave;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refetch = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void qc.invalidateQueries({ queryKey: taskKeys.list(projectId) }), 300);
    };
    const onTask = (ev: string) => (p: TaskSocketPayload) => {
      const id = p.task?.id ?? p.taskId;
      if (p.actorId && p.actorId === selfId) return;
      refetch();
      if (id) void qc.invalidateQueries({ queryKey: taskKeys.detail(id) });
      handler.current?.(ev, p);
    };
    const bound = ["task:created", "task:updated", "task:moved", "task:assigned", "task:deleted"].map((ev) => [ev, onTask(ev)] as const);
    bound.forEach(([ev, fn]) => s.on(ev, fn));
    const onComment = (p: { taskId: string }) => void qc.invalidateQueries({ queryKey: taskKeys.comments(p.taskId) });
    ["comment:created", "comment:updated", "comment:deleted"].forEach((ev) => s.on(ev, onComment));
    return () => {
      if (timer) clearTimeout(timer);
      bound.forEach(([ev, fn]) => s.off(ev, fn));
      ["comment:created", "comment:updated", "comment:deleted"].forEach((ev) => s.off(ev, onComment));
      leave();
    };
  }, [projectId, qc, selfId]);
}
