"use client";

import * as React from "react";

const KEY = "st.work.focus";

interface FocusCtx {
  focus: boolean;
  toggle: () => void;
  off: () => void;
}

const Ctx = React.createContext<FocusCtx | null>(null);

/**
 * Chế độ tập trung cho màn Công việc (docs 02/05 §C5).
 *
 * Khi lập kế hoạch sprint, tiêu đề trang + breadcrumb + thanh vai trò chiếm gần nửa chiều cao
 * màn mà không giúp được gì cho việc đang làm. Phím `F` giấu chúng đi, chỉ để lại bộ lọc và
 * bảng. Lựa chọn nhớ trong localStorage nên mở lại vẫn đúng chế độ vừa dùng.
 *
 * Chỉ tác động trong khu vực màn Công việc — không đụng sidebar của AppShell (sidebar đã có
 * `Ctrl/Super + B` riêng).
 */
export function WorkFocusProvider({ children }: { children: React.ReactNode }) {
  const [focus, setFocus] = React.useState(false);

  // Đọc sau khi gắn vào cây: localStorage không có trên server, đọc lúc render sẽ lệch hydration
  React.useEffect(() => {
    try {
      setFocus(localStorage.getItem(KEY) === "1");
    } catch {
      /* chế độ riêng tư: cứ để tắt */
    }
  }, []);

  const set = React.useCallback((v: boolean) => {
    setFocus(v);
    try {
      localStorage.setItem(KEY, v ? "1" : "0");
    } catch {
      /* mất tiện ích thôi, không ảnh hưởng dữ liệu */
    }
  }, []);

  const value = React.useMemo<FocusCtx>(
    () => ({ focus, toggle: () => set(!focus), off: () => set(false) }),
    [focus, set],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkFocus(): FocusCtx {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useWorkFocus phải nằm trong <WorkFocusProvider>");
  return v;
}
