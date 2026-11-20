"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useResizablePanel } from "@/features/work/use-resizable-panel";
import { cn } from "@/lib/utils";

export interface SideDetailPanelProps {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
  contentClassName?: string;
}

/**
 * Panel trượt từ cạnh phải (cùng chuẩn với TaskDetailPanel bên Công việc):
 * không dùng lớp phủ tối (overlay đen), có thanh kéo co giãn độ rộng ở mép trái và đóng bằng phím Esc.
 */
export function SideDetailPanel({
  open,
  onClose,
  ariaLabel,
  children,
  showCloseButton = true,
  contentClassName,
}: SideDetailPanelProps) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const { width, isDragging, handlePointerDown, resetWidth } = useResizablePanel();

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.aside
          key="side-detail-panel"
          initial={{ x: "100%", opacity: 0.8 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0.8 }}
          transition={{ type: "spring", damping: 30, stiffness: 350 }}
          style={{ width: `${width}px` }}
          className="fixed top-14 bottom-0 right-0 z-40 flex flex-col border-l border-border/80 bg-card/98 shadow-2xl backdrop-blur-md overflow-hidden max-w-full"
          aria-label={ariaLabel}
        >
          {/* Thanh kéo co giãn (Resizable Splitter Handle) ở mép trái */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Kéo để chỉnh độ rộng panel chi tiết"
            onPointerDown={handlePointerDown}
            onDoubleClick={resetWidth}
            className="absolute -left-1.5 top-0 bottom-0 w-3 cursor-col-resize z-50 group flex items-center justify-center select-none"
            title="Kéo sang trái/phải để co giãn · Bấm đúp để đặt lại mặc định (520px)"
          >
            <div className="w-1 h-12 rounded-full bg-border/80 group-hover:bg-primary group-active:bg-primary transition-colors shadow-2xs" />
          </div>

          {/* Lớp màng vô hình ngăn bắt sự kiện khi đang kéo chuột */}
          {isDragging && (
            <div className="fixed inset-0 z-[60] cursor-col-resize select-none pointer-events-auto" />
          )}

          {showCloseButton && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-4 top-3.5 z-20 h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={onClose}
              aria-label="Đóng panel (Esc)"
              title="Đóng panel (Esc)"
            >
              <X className="h-4 w-4" />
            </Button>
          )}

          <div className={cn("flex-1 min-h-0 overflow-y-auto", contentClassName)}>
            {children}
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
