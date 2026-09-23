"use client";

import * as React from "react";

/** Giới hạn cứng một lô (docs 02/05 §B1): ghi tuần tự nên 50 đã là ~50 request. */
export const MAX_BULK = 50;

interface SelectionCtx {
  selected: string[];
  isSelected: (id: string) => boolean;
  /** Bấm chọn một thẻ/dòng; giữ Shift để chọn cả dải kể từ thẻ bấm gần nhất. */
  toggle: (id: string, orderedIds: string[], shiftKey?: boolean) => void;
  selectAll: (ids: string[]) => void;
  clear: () => void;
  active: boolean;
}

const Ctx = React.createContext<SelectionCtx | null>(null);

/**
 * Lựa chọn nhiều công việc, dùng chung cho cả bảng Kanban lẫn màn Danh sách — đổi cách nhìn
 * không mất những gì đang chọn (cùng tinh thần với bộ lọc dùng chung ở `filters.tsx`).
 */
export function WorkSelectionProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = React.useState<string[]>([]);
  const anchorRef = React.useRef<string | null>(null);

  const value = React.useMemo<SelectionCtx>(
    () => ({
      selected,
      active: selected.length > 0,
      isSelected: (id) => selected.includes(id),
      toggle: (id, orderedIds, shiftKey) => {
        setSelected((cur) => {
          if (shiftKey && anchorRef.current) {
            const a = orderedIds.indexOf(anchorRef.current);
            const b = orderedIds.indexOf(id);
            if (a >= 0 && b >= 0) {
              const range = orderedIds.slice(Math.min(a, b), Math.max(a, b) + 1);
              return Array.from(new Set([...cur, ...range])).slice(0, MAX_BULK);
            }
          }
          anchorRef.current = id;
          return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(0, MAX_BULK);
        });
      },
      selectAll: (ids) => {
        anchorRef.current = ids[0] ?? null;
        setSelected(ids.slice(0, MAX_BULK));
      },
      clear: () => {
        anchorRef.current = null;
        setSelected([]);
      },
    }),
    [selected],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkSelection(): SelectionCtx {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useWorkSelection phải nằm trong <WorkSelectionProvider>");
  return v;
}
