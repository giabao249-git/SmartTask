"use client";

import * as React from "react";

const FLAG = "st.chunkReloadedAt";
const COOLDOWN_MS = 30_000;

const isChunkError = (message: string) =>
  /ChunkLoadError|Loading chunk [\d]+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(message);

/**
 * Sau khi web được build lại (deploy mới), tab đang mở còn trỏ tới file chunk cũ đã biến mất →
 * Next ném ChunkLoadError và màn hình hỏng. Nghe lỗi đó rồi tải lại trang MỘT lần
 * (có cooldown 30 giây để không rơi vào vòng lặp nếu lỗi do nguyên nhân khác).
 */
export function ChunkReloader() {
  React.useEffect(() => {
    const reloadOnce = (reason: string) => {
      let last = 0;
      try {
        last = Number(sessionStorage.getItem(FLAG) ?? 0);
      } catch {
        // sessionStorage bị chặn — vẫn thử tải lại một lần
      }
      if (Date.now() - last < COOLDOWN_MS) return;
      try {
        sessionStorage.setItem(FLAG, String(Date.now()));
      } catch {
        // bỏ qua
      }
      console.warn(`[SmartTask] Bản web vừa đổi (${reason}) — tải lại trang để lấy bản mới.`);
      window.location.reload();
    };

    const onError = (e: ErrorEvent) => {
      if (isChunkError(e.message ?? "")) reloadOnce(e.message);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason as { name?: string; message?: string } | undefined;
      const text = `${r?.name ?? ""} ${r?.message ?? String(e.reason ?? "")}`;
      if (isChunkError(text)) reloadOnce(text);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
