"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import {
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  ShieldCheck,
  Smartphone,
  Laptop,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api, describeError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

function parseUserAgent(ua: string): { device: string; browser: string; isMobile: boolean } {
  let browser = "Trình duyệt Web";
  if (ua.includes("Firefox/")) browser = "Mozilla Firefox";
  else if (ua.includes("Edg/")) browser = "Microsoft Edge";
  else if (ua.includes("Chrome/")) browser = "Google Chrome";
  else if (ua.includes("Safari/")) browser = "Apple Safari";

  let os = "Không xác định";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Macintosh") || ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  return { device: `${browser} trên ${os}`, browser, isMobile };
}

export function SecurityTab() {
  const auth = useAuth();
  const u = auth.user;
  const [pw, setPw] = React.useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [sessionInfo, setSessionInfo] = React.useState<{ device: string; isMobile: boolean }>({
    device: "Trình duyệt hiện tại",
    isMobile: false,
  });

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const parsed = parseUserAgent(navigator.userAgent);
      setSessionInfo({ device: parsed.device, isMobile: parsed.isMobile });
    }
  }, []);

  const changePw = useMutation({
    mutationFn: () =>
      api.patch<void>("/me/password", {
        currentPassword: pw.currentPassword,
        newPassword: pw.newPassword,
      }),
    onSuccess: () => {
      setPw({ currentPassword: "", newPassword: "", confirm: "" });
      toast.success("Đã đổi mật khẩu thành công!", {
        description: "Toàn bộ phiên đăng nhập trên các thiết bị khác đã được tự động thu hồi an toàn.",
      });
    },
    onError: (e: unknown) => {
      const { code, message } = describeError(e);
      toast.error(
        code === "VALIDATION_FAILED"
          ? "Mật khẩu mới phải có tối thiểu 8 ký tự, bao gồm cả chữ và số."
          : code === "INVALID_CREDENTIALS"
          ? "Mật khẩu hiện tại không chính xác."
          : message,
        { description: code }
      );
    },
  });

  const handleLogoutCurrent = async () => {
    try {
      await auth.logout();
    } catch {
      toast.error("Không thể đăng xuất. Vui lòng thử lại.");
    }
  };

  if (!u) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Form Đổi Mật Khẩu */}
        <Card className="border-border/80">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <KeyRound className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Đổi mật khẩu</CardTitle>
                <CardDescription className="text-xs">
                  Cập nhật mật khẩu định kỳ để bảo vệ tài khoản và dữ liệu dự án.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (pw.newPassword.length < 8) {
                return toast.error("Mật khẩu mới phải có tối thiểu 8 ký tự.");
              }
              if (pw.newPassword !== pw.confirm) {
                return toast.error("Mật khẩu xác nhận không khớp.");
              }
              changePw.mutate();
            }}
          >
            <CardContent className="p-5 pt-2 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Mật khẩu hiện tại</label>
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Nhập mật khẩu hiện tại"
                  value={pw.currentPassword}
                  onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })}
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Mật khẩu mới</label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Tối thiểu 8 ký tự, bao gồm chữ & số"
                  value={pw.newPassword}
                  onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
                  className="h-9 text-xs"
                  required
                  minLength={8}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Xác nhận mật khẩu mới</label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Nhập lại mật khẩu mới"
                  value={pw.confirm}
                  onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                  className="h-9 text-xs"
                  required
                  minLength={8}
                />
              </div>

              <div className="rounded-lg bg-muted/40 p-3 text-[11px] text-muted-foreground space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  Quy tắc bảo mật phiên:
                </div>
                <p>
                  Khi đổi mật khẩu thành công, toàn bộ Refresh Token trên các thiết bị hoặc trình duyệt khác sẽ lập tức
                  bị vô hiệu hóa để phòng ngừa rò rỉ thông tin.
                </p>
              </div>
            </CardContent>

            <CardFooter className="p-5 pt-0 flex justify-end">
              <Button type="submit" size="sm" className="gap-1.5 text-xs font-medium" disabled={changePw.isPending}>
                {changePw.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                Lưu mật khẩu mới
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Danh sách Phiên làm việc & Trạng thái bảo mật */}
        <div className="space-y-6">
          <Card className="border-border/80">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">Phiên làm việc hiện tại</CardTitle>
                    <CardDescription className="text-xs">
                      Thiết bị và phiên xác thực đang truy cập hệ thống.
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 bg-emerald-500/5 text-[10px]">
                  Hoạt động
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5 pt-2 space-y-4">
              <div className="flex items-start justify-between p-3.5 rounded-lg border border-border/80 bg-muted/20">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 p-2 rounded-md bg-background border border-border text-foreground">
                    {sessionInfo.isMobile ? (
                      <Smartphone className="h-4 w-4" />
                    ) : (
                      <Laptop className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">{sessionInfo.device}</span>
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Đang kết nối qua HttpOnly Cookie & Access Token an toàn.
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-2">
                      <span>Email: <strong className="text-foreground">{u.email}</strong></span>
                      <span>•</span>
                      <span>Quyền hạn: <strong className="text-foreground font-mono">{u.platformRole || (u.isSuperAdmin ? "ROOT_ADMIN" : "USER")}</strong></span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-muted-foreground">Đăng xuất khỏi phiên này</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleLogoutCurrent}
                  className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 border-rose-200 dark:border-rose-900 gap-1.5"
                >
                  <LogOut className="h-3.5 w-3.5" /> Đăng xuất thiết bị này
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tiêu chuẩn bảo mật */}
          <Card className="border-border/80 bg-muted/10">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Cơ chế bảo mật SmartTask Enterprise
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1 space-y-2 text-[11px] text-muted-foreground">
              <div className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <span>
                  <strong>Quản lý Token xoay vòng (Token Rotation):</strong> Refresh Token chỉ được lưu trữ trong Cookie an toàn `HttpOnly; SameSite=Lax`, ngăn chặn triệt để tấn công XSS.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <span>
                  <strong>Mã hóa Khóa AI (BYOK):</strong> Tất cả khóa API của bên thứ ba được mã hóa bằng thuật toán quân sự AES-256-GCM trước khi lưu trữ hoặc truyền tải.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <span>
                  <strong>Giới hạn tốc độ (Rate Limiting):</strong> Bảo vệ Endpoint đăng nhập và kiểm tra mật khẩu bằng thuật toán bộ đếm Throttle 10 req/phút/IP.
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
