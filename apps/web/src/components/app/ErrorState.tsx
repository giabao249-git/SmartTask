import * as React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface ErrorStateProps {
  code?: string; // e.g. TASK_VERSION_CONFLICT, WIP_LIMIT_EXCEEDED
  message?: string;
  onRetry?: () => void;
  className?: string;
}

/** Tiêu đề theo mã lỗi — mặc định cũ luôn ghi "xung đột phiên bản" kể cả khi lỗi là 404/403. */
const TITLE: Record<string, string> = {
  NOT_FOUND: "Không tìm thấy dữ liệu",
  FORBIDDEN: "Bạn không có quyền xem mục này",
  UNAUTHENTICATED: "Phiên đăng nhập đã hết hạn",
  NETWORK: "Không kết nối được máy chủ",
  MAINTENANCE_MODE: "Hệ thống đang bảo trì",
  WORKSPACE_SUSPENDED: "Workspace đã bị đình chỉ",
  WORKSPACE_READ_ONLY: "Workspace đang ở chế độ chỉ đọc",
  TASK_VERSION_CONFLICT: "Xảy ra xung đột phiên bản dữ liệu",
  WIP_LIMIT_EXCEEDED: "Cột đã đạt giới hạn WIP",
  AI_PROVIDER_UNAVAILABLE: "Dịch vụ AI tạm thời không sẵn sàng",
  AI_QUOTA_EXCEEDED: "Đã hết hạn mức AI hôm nay",
};

export function ErrorState({
  code = "INTERNAL",
  message = "Không tải được dữ liệu. Thử lại sau ít phút.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div className={className}>
      <Alert variant="destructive" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <AlertTitle className="text-sm font-semibold">
                {TITLE[code] ?? "Không tải được dữ liệu"}
              </AlertTitle>
              <Badge variant="destructive" className="font-mono text-[10px] tracking-wider uppercase">
                {code}
              </Badge>
            </div>
            <AlertDescription className="text-xs text-destructive/90">
              {message}
            </AlertDescription>
          </div>
        </div>

        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="shrink-0 gap-1.5 self-end sm:self-auto border-destructive/40 text-destructive hover:bg-destructive/10"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Tải lại trang
          </Button>
        )}
      </Alert>
    </div>
  );
}
