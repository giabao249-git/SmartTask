"use client";

import * as React from "react";

/**
 * Hai "ngôn ngữ chuyển động" tách biệt để người dùng cảm được mình đang ở tầng nào:
 * - Ngoài (usePageEnter): chuyển trang → các khối nội dung hiện lần lượt từ trên xuống (cascade), trồi + phóng nhẹ.
 * - Trong (useSlideEnter): đổi tab/mục trong trang → trượt theo hướng vừa bấm (sang phải thì vào từ phải…).
 * Tab dùng component Tabs chung chạy bằng CSS (.st-tab-next/.st-tab-prev trong globals.css) với cùng thông số với useSlideEnter.
 *
 * Dùng Web Animations API trên phần tử thật thay vì đổi `key` React: đổi key sẽ unmount cả cây con (mất state,
 * layout bên trong phải mount lại). Chỉ animate opacity + transform để trình duyệt xử lý trên GPU.
 */

// easeOutCubic: nhanh đầu, êm cuối, chuyển động trải đều — ease-out gắt hơn dồn hết vào ~100ms đầu, nhìn giật
export const MOTION_EASING = "cubic-bezier(0.33, 1, 0.68, 1)";

const PAGE_DURATION = 520;
const PAGE_STAGGER = 60;
/** Từ khối thứ 6 trở đi vào cùng lúc — trang dài không phải đợi cả giây mới hiện hết */
const PAGE_MAX_STEPS = 5;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Chuyển trang: các khối nội dung cấp đầu của trang hiện lần lượt. Chạy lúc mount và mỗi khi `key` (đường dẫn) đổi. */
export function usePageEnter<T extends HTMLElement>(key: unknown) {
  const ref = React.useRef<T>(null);

  // useLayoutEffect: đặt trạng thái đầu (ẩn) trước khi trình duyệt vẽ, không bị chớp nội dung mới
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== "function" || reducedMotion()) return;

    // Trang thường bọc nội dung trong 1–2 lớp div → đi xuống tới lớp có nhiều khối (header, bộ lọc, các card…)
    let container: Element = el;
    for (let depth = 0; depth < 3 && container.children.length === 1; depth++) container = container.children[0];
    const blocks = Array.from(container.children).filter(
      (c): c is HTMLElement => c instanceof HTMLElement && c.getClientRects().length > 0,
    );
    const targets = blocks.length >= 2 ? blocks : [el];

    const animations = targets.map((t, i) =>
      t.animate(
        [
          { opacity: 0, transform: "translateY(14px) scale(0.985)", transformOrigin: "50% 0" },
          { opacity: 1, transform: "none", transformOrigin: "50% 0" },
        ],
        // backwards: khối chưa tới lượt vẫn ẩn trong lúc chờ delay, không hiện sẵn rồi mới biến mất
        { duration: PAGE_DURATION, easing: MOTION_EASING, delay: Math.min(i, PAGE_MAX_STEPS) * PAGE_STAGGER, fill: "backwards" },
      ),
    );
    return () => animations.forEach((a) => a.cancel());
  }, [key]);

  return ref;
}

type SlideOptions = {
  /** Trục của thanh điều hướng: tab ngang → "x", menu dọc → "y". */
  axis?: "x" | "y";
  distance?: number;
  duration?: number;
};

/**
 * Đổi tab/mục trong trang: trượt vào theo hướng vừa đi. `index` là vị trí của tab/mục đang chọn trong thanh điều hướng.
 * Không chạy lúc mount (trang đã có hiệu ứng chuyển trang), chỉ chạy khi index đổi. So với index trước đó chứ không
 * đếm lần chạy: StrictMode (dev) chạy effect lúc mount 2 lần mà vẫn giữ ref.
 *
 * Khoảng trượt ngang 16px nằm gọn trong padding của <main> (p-4 = 16px) → không làm hiện thanh cuộn ngang lúc trượt.
 */
export function useSlideEnter<T extends HTMLElement>(index: number, { axis = "x", distance = 16, duration = 340 }: SlideOptions = {}) {
  const ref = React.useRef<T>(null);
  const lastIndex = React.useRef(index);

  React.useLayoutEffect(() => {
    const prev = lastIndex.current;
    lastIndex.current = index;
    if (prev === index) return;
    const el = ref.current;
    if (!el || typeof el.animate !== "function" || reducedMotion()) return;

    const offset = (index > prev ? 1 : -1) * distance;
    const animation = el.animate(
      [
        { opacity: 0, transform: axis === "x" ? `translateX(${offset}px)` : `translateY(${offset}px)` },
        { opacity: 1, transform: "none" },
      ],
      { duration, easing: MOTION_EASING },
    );
    return () => animation.cancel();
  }, [index, axis, distance, duration]);

  return ref;
}
