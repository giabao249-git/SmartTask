"use client";

import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const isChunkError = (e: Error) =>
  /ChunkLoadError|Loading chunk [\d]+ failed|Failed to fetch dynamically imported module/i.test(`${e.name} ${e.message}`);

/**
 * Lưới an toàn cho mọi màn (trước đây lỗi render = màn hình trắng).
 * Lỗi tải chunk sau khi web được build lại → tự tải lại trang để lấy bản mới.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const chunk = isChunkError(error);
  React.useEffect(() => {
    if (!chunk) return;
    const t = setTimeout(() => window.location.reload(), 400);
    return () => clearTimeout(t);
  }, [chunk]);

  return (
    <div className="flex items-center justify-center p-6 min-h-[60vh]">
      <Card className="max-w-lg w-full border-border/80">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            {chunk ? <RefreshCw className="h-4 w-4 animate-spin text-info" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
            {chunk ? "Đang tải lại bản mới…" : "Màn hình này gặp lỗi"}
          </CardTitle>
          <CardDescription className="text-xs">
            {chunk
              ? "Web vừa được cập nhật nên tab đang mở phải tải lại một lần."
              : "Bạn thử lại; nếu vẫn lỗi, chụp màn hình kèm mã bên dưới để báo lại."}
          </CardDescription>
        </CardHeader>
        {!chunk && (
          <CardContent className="p-4 pt-0 space-y-3">
            <p className="text-xs text-muted-foreground break-words">{error.message}</p>
            {error.digest && <p className="text-[11px] font-mono text-muted-foreground">digest: {error.digest}</p>}
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-8 text-xs gap-1.5" onClick={reset}>
                <RefreshCw className="h-3.5 w-3.5" /> Thử lại
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => window.location.reload()}>
                Tải lại trang
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
