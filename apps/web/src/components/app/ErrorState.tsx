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

export function ErrorState({
  code = "TASK_VERSION_CONFLICT",
  message = "Công việc vừa được người khác cập nhật, dữ liệu cục bộ không còn đồng bộ. Hãy tải lại để xem phiên bản mới nhất.",
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
                Xảy ra xung đột phiên bản dữ liệu
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
