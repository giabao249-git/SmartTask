"use client";

import * as React from "react";
import { AlertTriangle, Lock, Wrench } from "lucide-react";
import { platformBlockStore, type PlatformBlock } from "@/lib/api";
import { cn } from "@/lib/utils";

const TEXT: Record<PlatformBlock["code"], { icon: typeof Wrench; title: string; hint: string; tone: string }> = {
  MAINTENANCE_MODE: {
    icon: Wrench,
    title: "Hệ thống đang bảo trì",
    hint: "Thao tác ghi tạm khoá. Trang sẽ hoạt động lại khi quản trị nền tảng tắt chế độ bảo trì.",
    tone: "bg-warning/15 text-warning-foreground border-warning/40",
  },
  WORKSPACE_READ_ONLY: {
    icon: Lock,
    title: "Workspace đang ở chế độ chỉ đọc",
    hint: "Bạn vẫn xem được dữ liệu; mọi thay đổi bị chặn cho tới khi quản trị nền tảng mở lại.",
    tone: "bg-warning/15 text-warning-foreground border-warning/40",
  },
  WORKSPACE_SUSPENDED: {
    icon: AlertTriangle,
    title: "Workspace đã bị đình chỉ",
    hint: "Liên hệ quản trị nền tảng (admin@smarttask.local) để biết lý do và mở lại.",
    tone: "bg-destructive/10 text-destructive border-destructive/40",
  },
};

/** Banner toàn cục khi API trả MAINTENANCE_MODE / WORKSPACE_SUSPENDED / WORKSPACE_READ_ONLY. */
export function PlatformBanner() {
  const [block, setBlock] = React.useState<PlatformBlock | null>(() => platformBlockStore.get());
  React.useEffect(() => {
    const off = platformBlockStore.subscribe(setBlock);
    return () => {
      off();
    };
  }, []);
  if (!block) return null;
  const t = TEXT[block.code];
  const Icon = t.icon;
  return (
    <div className={cn("flex items-start gap-2 border-b px-4 py-2 text-xs", t.tone)}>
      <Icon className="h-4 w-4 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <span className="font-semibold">{t.title}</span> · <span>{block.message}</span>
        <div className="text-[11px] opacity-80">{t.hint}</div>
      </div>
    </div>
  );
}
