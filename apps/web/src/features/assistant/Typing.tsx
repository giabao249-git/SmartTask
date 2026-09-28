"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Người dùng tắt hiệu ứng chuyển động trong hệ điều hành → bỏ mọi animation. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/**
 * "Đang suy luận" kèm ba dấu chấm chạy lần lượt (. .. ...) và nhãn mờ dần —
 * đúng kiểu chờ trả lời của các trợ lý LLM.
 */
export function ThinkingDots({ label = "Trợ lý AI đang suy luận", className }: { label?: string; className?: string }) {
  const reduced = usePrefersReducedMotion();
  return (
    <span className={cn("inline-flex items-baseline gap-1", className)} aria-live="polite">
      <span className={cn("font-semibold text-foreground", !reduced && "animate-pulse")}>{label}</span>
      <span className="inline-flex gap-0.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn("h-1 w-1 rounded-full bg-muted-foreground", !reduced && "animate-bounce")}
            style={reduced ? undefined : { animationDelay: `${i * 160}ms`, animationDuration: "1s" }}
          />
        ))}
      </span>
    </span>
  );
}

/**
 * Hiện dần văn bản như đang gõ. Chỉ dùng cho tin vừa nhận (`enabled`), tin cũ hiện ngay
 * để mở lại phiên không phải xem gõ lại từ đầu. Tổng thời gian chặn ở ~1,2 giây dù câu dài.
 */
export function TypewriterText({
  text,
  enabled,
  className,
  onDone,
}: {
  text: string;
  enabled: boolean;
  className?: string;
  onDone?: () => void;
}) {
  const reduced = usePrefersReducedMotion();
  const animate = enabled && !reduced && text.length > 0;
  const [shown, setShown] = React.useState(() => (animate ? 0 : text.length));
  const doneRef = React.useRef(onDone);
  doneRef.current = onDone;

  React.useEffect(() => {
    if (!animate) {
      setShown(text.length);
      return;
    }
    setShown(0);
    const total = Math.min(1200, Math.max(320, text.length * 12));
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / total);
      setShown(Math.round(p * text.length));
      if (p < 1) raf = requestAnimationFrame(tick);
      else doneRef.current?.();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, animate]);

  const typing = animate && shown < text.length;
  return (
    <p className={cn("whitespace-pre-wrap", className)}>
      {animate ? text.slice(0, shown) : text}
      {typing && <span className="inline-block w-1.5 h-3.5 -mb-0.5 ml-0.5 bg-foreground/70 animate-pulse" aria-hidden="true" />}
    </p>
  );
}

/**
 * Hiện dần N phần tử (dòng bảng, thẻ, khối): mỗi `stepMs` thêm một phần tử vào DOM. Thêm dần chứ không chỉ làm mờ
 * bằng CSS — để chiều cao tăng dần và khung chat "bám đáy" cuộn theo (bảng mờ sẵn đủ chiều cao thì khung nhảy xuống
 * đáy trống). `enabled` chỉ xét lúc gắn: tin cũ mở lại thì hiện ngay.
 */
export function useRevealCount(total: number, enabled: boolean, stepMs = 70, onDone?: () => void): number {
  const reduced = usePrefersReducedMotion();
  const [on] = React.useState(enabled);
  const [n, setN] = React.useState(on ? Math.min(1, total) : total);
  const doneRef = React.useRef(onDone);
  doneRef.current = onDone;
  const fired = React.useRef(false);
  React.useEffect(() => {
    if (!on || reduced) {
      setN(total);
    } else if (n < total) {
      const t = setTimeout(() => setN((x) => Math.min(total, x + 1)), stepMs);
      return () => clearTimeout(t);
    }
    if (!fired.current && (n >= total || !on || reduced)) {
      fired.current = true;
      doneRef.current?.();
    }
  }, [n, total, on, reduced, stepMs]);
  return n;
}
