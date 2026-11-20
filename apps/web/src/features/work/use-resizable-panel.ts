"use client";

import * as React from "react";

const STORAGE_KEY = "st.task_panel_width";
const DEFAULT_WIDTH = 520;
const MIN_WIDTH = 400;

export function useResizablePanel() {
  const [width, setWidth] = React.useState<number>(DEFAULT_WIDTH);
  const [isDragging, setIsDragging] = React.useState(false);

  // Khôi phục độ rộng đã lưu từ localStorage sau khi mount
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 380 && parsed <= 1200) {
          setWidth(parsed);
        }
      }
    } catch {
      /* ignore storage errors */
    }
  }, []);

  const handlePointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      setIsDragging(true);

      const startX = e.clientX;
      const startWidth = width;

      const onPointerMove = (moveEvent: PointerEvent) => {
        // Kéo sang trái (clientX nhỏ đi) -> tăng width
        const delta = startX - moveEvent.clientX;
        const maxW = Math.max(MIN_WIDTH, Math.min(980, Math.floor(window.innerWidth * 0.85)));
        const newWidth = Math.max(MIN_WIDTH, Math.min(maxW, startWidth + delta));
        setWidth(newWidth);
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        const delta = startX - upEvent.clientX;
        const maxW = Math.max(MIN_WIDTH, Math.min(980, Math.floor(window.innerWidth * 0.85)));
        const finalWidth = Math.max(MIN_WIDTH, Math.min(maxW, startWidth + delta));
        setWidth(finalWidth);
        setIsDragging(false);

        try {
          localStorage.setItem(STORAGE_KEY, String(Math.round(finalWidth)));
        } catch {
          /* ignore storage errors */
        }

        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    },
    [width],
  );

  const resetWidth = React.useCallback(() => {
    setWidth(DEFAULT_WIDTH);
    try {
      localStorage.setItem(STORAGE_KEY, String(DEFAULT_WIDTH));
    } catch {
      /* ignore */
    }
  }, []);

  return {
    width,
    isDragging,
    handlePointerDown,
    resetWidth,
  };
}
