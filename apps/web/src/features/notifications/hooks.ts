"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { NotificationView, Paged } from "@/lib/types";

const KEY = ["notifications"] as const;

export function useNotifications(unreadOnly = false) {
  return useQuery({ queryKey: [...KEY, unreadOnly], queryFn: () => api.get<Paged<NotificationView>>("/notifications", { unread: unreadOnly || undefined, limit: 50 }) });
}

export function useUnreadCount() {
  return useQuery({ queryKey: [...KEY, "unread-count"], queryFn: () => api.get<{ count: number }>("/notifications/unread-count"), staleTime: 30_000 });
}

export function useNotificationMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });
  const markRead = useMutation({ mutationFn: (id: string) => api.patch<void>(`/notifications/${id}/read`), onSuccess: invalidate });
  const readAll = useMutation({ mutationFn: () => api.post<void>("/notifications/read-all"), onSuccess: invalidate });
  return { markRead, readAll };
}

/** Socket `notification:new` tới user:{id} (docs 11 §4) → làm mới danh sách + số chưa đọc; trả thông báo mới nhất để toast. */
export function useNotificationRealtime(onNew?: (n: NotificationView) => void) {
  const qc = useQueryClient();
  const cb = React.useRef(onNew);
  cb.current = onNew;
  React.useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const handler = (p: { notification: NotificationView }) => {
      void qc.invalidateQueries({ queryKey: KEY });
      cb.current?.(p.notification);
    };
    s.on("notification:new", handler);
    return () => {
      s.off("notification:new", handler);
    };
  }, [qc]);
}
