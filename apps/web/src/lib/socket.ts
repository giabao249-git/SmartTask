"use client";

import { io, type Socket } from "socket.io-client";
import { API_URL, tokenStore } from "./api";

/**
 * Một socket cho cả app (docs 11 §4): handshake mang access token trong `auth.token`, tự vào phòng `user:{id}`;
 * `project:join` theo dự án đang mở. Client chỉ NHẬN — ghi qua REST. Đổi token → kết nối lại với token mới.
 */
let socket: Socket | null = null;

export function socketOrigin(): string {
  return API_URL.replace(/\/api\/v1$/, "");
}

export function getSocket(): Socket | null {
  const token = tokenStore.get();
  if (!token) return null;
  if (!socket) {
    socket = io(socketOrigin(), { auth: { token }, transports: ["websocket"], autoConnect: true });
    tokenStore.subscribe((t) => {
      if (!socket) return;
      if (!t) {
        socket.disconnect();
        return;
      }
      socket.auth = { token: t };
      if (!socket.connected) socket.connect();
    });
  }
  return socket;
}

/** Vào phòng dự án; trả hàm rời phòng để dùng trong useEffect. */
export function joinProject(projectId: string, view = "board"): () => void {
  const s = getSocket();
  if (!s) return () => undefined;
  const join = () => s.emit("project:join", { projectId, view }, () => undefined);
  if (s.connected) join();
  s.on("connect", join);
  return () => {
    s.off("connect", join);
    s.emit("project:leave", { projectId });
  };
}

/** Gửi ping presence định kỳ khi đang xem dự án. */
export function pingPresence(projectId: string, view = "board"): void {
  const s = getSocket();
  if (s?.connected) {
    s.emit("presence:ping", { projectId, view }, () => undefined);
  }
}

/** Vào phòng workspace để nhận sự kiện toàn workspace (như audit:logged); trả hàm rời phòng. */
export function joinWorkspace(workspaceId: string): () => void {
  const s = getSocket();
  if (!s) return () => undefined;
  const join = () => s.emit("workspace:join", { workspaceId }, () => undefined);
  if (s.connected) join();
  s.on("connect", join);
  return () => {
    s.off("connect", join);
    s.emit("workspace:leave", { workspaceId });
  };
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
