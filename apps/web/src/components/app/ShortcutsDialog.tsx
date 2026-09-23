"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useModKey } from "@/lib/hooks/use-mod-key";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot,
  Kanban,
  Keyboard,
  Navigation,
} from "lucide-react";

export interface ShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  badge?: string;
}

interface ShortcutSection {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: ShortcutItem[];
}

const buildSections = (mod: string): ShortcutSection[] => [
  {
    title: "Trợ lý AI & Hộp hội thoại",
    icon: Bot,
    items: [
      {
        keys: ["Enter", `${mod} Enter`],
        description: "Gửi yêu cầu hoặc câu hỏi cho AI",
      },
      {
        keys: ["Shift", "Enter"],
        description: "Xuống dòng mới trong ô soạn thảo",
      },
      {
        keys: ["/"],
        description: "Mở menu gợi ý lệnh nhanh (/decompose, /assign, /rebalance...)",
        badge: "Gợi ý",
      },
      {
        keys: ["↑", "↓"],
        description: "Di chuyển chọn lệnh AI trong danh sách gợi ý",
      },
      {
        keys: ["Tab", "Enter"],
        description: "Xác nhận chọn lệnh gợi ý và tự động điền mẫu câu",
      },
      {
        keys: ["Esc"],
        description: "Đóng danh sách gợi ý lệnh AI",
      },
      {
        keys: [mod, "H"],
        description: "Mở hoặc đóng ngăn kéo Lịch sử các phiên chat",
        badge: "Phiên chat",
      },
    ],
  },
  {
    title: "Điều hướng & Toàn cục",
    icon: Navigation,
    items: [
      {
        keys: [mod, "K"],
        description: "Mở thanh tìm kiếm nhanh & danh mục lệnh (Command Palette)",
        badge: "Phổ biến",
      },
      {
        keys: [mod, "J"],
        description: "Truy cập nhanh vào Trợ lý AI từ bất kỳ màn hình nào",
      },
      {
        keys: [mod, "B"],
        description: "Ghim / Bỏ ghim thanh bên Zen Sidebar cố định hoặc thu gọn",
      },
      {
        keys: ["?"],
        description: "Mở bảng tra cứu phím tắt này",
      },
      {
        keys: ["Esc"],
        description: "Đóng cửa sổ phụ, modal chi tiết hoặc Popover đang mở",
      },
    ],
  },
  {
    title: "Bảng Kanban & Quản trị thẻ",
    icon: Kanban,
    items: [
      {
        keys: ["C"],
        description: "Mở ô tạo nhanh ở cột đầu — Enter tạo xong ô vẫn mở cho việc kế tiếp",
        badge: "Tạo task",
      },
      {
        keys: ["Q"],
        description: "Bật / Tắt bộ lọc nhanh 'Việc của tôi'",
        badge: "Bộ lọc",
      },
      {
        keys: ["J", "K"],
        description: "Trỏ xuống / lên thẻ kế tiếp trong cùng cột (hoặc ↓ ↑)",
      },
      {
        keys: ["N", "P"],
        description: "Trỏ sang cột kế / cột trước, giữ nguyên hàng (hoặc → ←)",
      },
      {
        keys: ["Enter", "O"],
        description: "Mở chi tiết thẻ đang trỏ",
      },
      {
        keys: ["I"],
        description: "Giao thẻ đang trỏ cho mình",
        badge: "Giao việc",
      },
      {
        keys: ["A"],
        description: "Mở menu thao tác của thẻ đang trỏ (giao việc, ưu tiên, hạn, nhân bản)",
      },
      {
        keys: ["X"],
        description: "Chọn / bỏ chọn thẻ đang trỏ để làm hàng loạt",
        badge: "Hàng loạt",
      },
      {
        keys: ["F"],
        description: "Chế độ tập trung — giấu tiêu đề trang và thanh vai trò, chỉ còn bộ lọc và bảng",
      },
      {
        keys: ["Esc"],
        description: "Bỏ chọn; nếu không chọn gì thì bỏ trỏ thẻ; trong ô tạo nhanh thì đóng ô",
      },
    ],
  },
];

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  const mod = useModKey();
  const sections = React.useMemo(() => buildSections(mod), [mod]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="p-4 pb-3 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
              <Keyboard className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold flex items-center gap-2">
                Phím tắt SmartTask
                <Badge variant="outline" className="text-[10px] font-mono py-0 px-1 text-muted-foreground">
                  Bàn phím
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Các phím bấm giúp tối ưu tốc độ làm việc như Linear và Jira
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 p-4 max-h-[60vh]">
          <div className="space-y-6">
            {sections.map((sec) => (
              <div key={sec.title} className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <sec.icon className="h-3.5 w-3.5 text-primary" />
                  <span>{sec.title}</span>
                </div>

                <div className="rounded-lg border border-border/60 divide-y divide-border/40 bg-card/40 overflow-hidden">
                  {sec.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 text-xs hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0 pr-3">
                        <span className="text-foreground text-[12px]">{item.description}</span>
                        {item.badge && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 font-normal">
                            {item.badge}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {item.keys.map((k, kIdx) => (
                          <React.Fragment key={kIdx}>
                            {kIdx > 0 && item.keys.length === 2 && !k.includes("Enter") && (
                              <span className="text-[10px] text-muted-foreground font-mono">+</span>
                            )}
                            {kIdx > 0 && (k.includes("Enter") || item.keys[0] === "Enter") && (
                              <span className="text-[10px] text-muted-foreground">hoặc</span>
                            )}
                            <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-mono font-medium rounded border border-border/80 bg-muted/80 text-foreground shadow-2xs">
                              {k}
                            </kbd>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-border/60 bg-muted/10 text-center text-[11px] text-muted-foreground flex items-center justify-between px-4">
          <span>
            Bấm <kbd className="font-mono bg-background border px-1 rounded text-[10px]">?</kbd> ở bất kỳ đâu để xem lại bảng này
            {mod === "Ctrl" && <> · phím <kbd className="font-mono bg-background border px-1 rounded text-[10px]">Super</kbd> cũng dùng được thay cho Ctrl</>}
          </span>
          <kbd className="font-mono bg-background border px-1.5 py-0.5 rounded text-[10px]">Esc đóng</kbd>
        </div>
      </DialogContent>
    </Dialog>
  );
}
