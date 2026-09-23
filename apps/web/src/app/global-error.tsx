"use client";

import * as React from "react";

/**
 * Lưới cuối: lỗi render không bắt được ở bất kỳ đâu. Với lỗi tải chunk (web vừa build lại)
 * thì tải lại trang luôn; còn lại hiện thông báo gọn kèm mã lỗi để chụp màn hình báo lại.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const isChunk = /ChunkLoadError|Loading chunk/i.test(`${error.name} ${error.message}`);
  React.useEffect(() => {
    if (isChunk) window.location.reload();
  }, [isChunk]);

  return (
    <html lang="vi">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ maxWidth: 520, border: "1px solid #e5e7eb", borderRadius: 12, padding: 24 }}>
            <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>
              {isChunk ? "Đang tải lại bản mới…" : "Có lỗi ngoài dự kiến"}
            </h1>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px" }}>
              {isChunk
                ? "Web vừa được cập nhật nên tab này đang tải lại."
                : "Thử lại; nếu vẫn lỗi, chụp màn hình kèm mã bên dưới để báo lại."}
            </p>
            {!isChunk && error.digest && (
              <p style={{ fontSize: 12, fontFamily: "monospace", color: "#6b7280" }}>digest: {error.digest}</p>
            )}
            {!isChunk && (
              <button
                onClick={reset}
                style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, border: "1px solid #111827", background: "#111827", color: "#fff", cursor: "pointer" }}
              >
                Thử lại
              </button>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
