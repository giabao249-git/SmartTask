"use client";

import * as React from "react";

/**
 * Nhãn phím bổ trợ hiển thị cho người dùng, theo hệ điều hành đang mở web.
 *
 * Trên Windows/Linux hiện **Ctrl**, không hiện ký hiệu ⌘ của macOS. Phím Super/Windows vẫn
 * bấm được vì handler nhận cả `metaKey` (trên Linux/Windows chính là Super) lẫn `ctrlKey`;
 * nhưng nhãn mặc định là Ctrl vì phần lớn tổ hợp Super bị GNOME/KDE/Windows giữ trước,
 * không tới được trình duyệt — in "Super" ra rồi bấm không ăn thì tệ hơn.
 *
 * Lần render đầu luôn trả "Ctrl" để khớp HTML dựng sẵn trên server, sau đó mới đổi theo
 * máy thật — tránh cảnh báo lệch hydration.
 */
export function useModKey(): string {
  const [label, setLabel] = React.useState("Ctrl");
  React.useEffect(() => {
    const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
    if (/Mac|iPhone|iPad|iPod/.test(ua)) setLabel("⌘");
  }, []);
  return label;
}
