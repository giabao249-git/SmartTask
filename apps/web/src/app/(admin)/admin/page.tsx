"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminConsoleView } from "@/features/admin/AdminConsoleView";

export default function PlatformAdminPage() {
  const { user, status } = useAuth();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Đang xác thực thông tin quyền hạn nền tảng...</span>
        </div>
      </div>
    );
  }

  // Chặn 403 đối với người dùng không phải Super Admin
  if (!user || !user.isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Card className="max-w-md w-full border-destructive/40 shadow-lg">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center text-xl font-bold">
              ⛔
            </div>
            <CardTitle className="text-xl font-bold text-destructive">403 — Từ chối truy cập</CardTitle>
            <CardDescription className="text-sm text-foreground/80">
              Bạn không có quyền quản trị toàn nền tảng (Platform Super Admin).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Khu vực <code className="bg-muted px-1.5 py-0.5 rounded font-mono">/admin</code> được dành riêng cho đội ngũ vận hành hạ tầng SmartTask. Quyền hạn Workspace Owner chỉ có hiệu lực trong phạm vi không gian làm việc của bạn.
            </p>
            <div className="pt-2">
              <Button asChild className="w-full">
                <Link href="/workspaces">Quay lại Không gian làm việc</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <AdminConsoleView />;
}
