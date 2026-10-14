"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Save, Clock, Mail, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { api, describeError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { UserView } from "@/lib/types";
import { toast } from "sonner";

/** Hồ sơ cá nhân: PATCH /me (họ tên, tên gọi ngắn cho AI, múi giờ, ảnh đại diện) */
export function ProfileTab() {
  const auth = useAuth();
  const u = auth.user;
  const [form, setForm] = React.useState({
    fullName: u?.fullName ?? "",
    shortName: u?.shortName ?? "",
    timezone: u?.timezone ?? "Asia/Ho_Chi_Minh",
    avatarUrl: u?.avatarUrl ?? "",
  });

  React.useEffect(() => {
    if (u) {
      setForm({
        fullName: u.fullName,
        shortName: u.shortName ?? "",
        timezone: u.timezone,
        avatarUrl: u.avatarUrl ?? "",
      });
    }
  }, [u]);

  const saveProfile = useMutation({
    mutationFn: () =>
      api.patch<UserView>("/me", {
        fullName: form.fullName.trim(),
        shortName: form.shortName.trim() || undefined,
        timezone: form.timezone.trim(),
        avatarUrl: form.avatarUrl.trim() || undefined,
      }),
    onSuccess: async () => {
      await auth.refetchMe();
      toast.success("Đã cập nhật thông tin hồ sơ");
    },
    onError: (e: unknown) => {
      const { code, message } = describeError(e);
      toast.error(code === "VALIDATION_FAILED" ? "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại." : message, {
        description: code,
      });
    },
  });

  if (!u) return null;

  const initials = (u.fullName || "User")
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveProfile.mutate();
        }}
      >
        <Card className="border-border/80">
          <CardHeader className="p-5 pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14 border-2 border-border shadow-xs">
                  <AvatarImage src={form.avatarUrl || u.avatarUrl || undefined} alt={u.fullName} />
                  <AvatarFallback className="text-base font-semibold bg-primary/10 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    {u.fullName}
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {u.platformRole || (u.isSuperAdmin ? "ROOT_ADMIN" : "USER")}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs flex items-center gap-1.5 mt-0.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" /> {u.email}
                  </CardDescription>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button type="submit" size="sm" className="h-8 text-xs gap-1.5" disabled={saveProfile.isPending}>
                  {saveProfile.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Lưu thay đổi
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 pt-2 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Họ và tên đầy đủ</label>
                <Input
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="h-9 text-xs"
                  required
                  minLength={2}
                  maxLength={100}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">
                  Tên gọi ngắn (Trợ lý AI sử dụng khi xưng hô)
                </label>
                <Input
                  value={form.shortName}
                  onChange={(e) => setForm({ ...form, shortName: e.target.value })}
                  className="h-9 text-xs"
                  maxLength={30}
                  placeholder="Lan, Hùng, Alex..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Múi giờ làm việc</label>
                <Input
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  className="h-9 text-xs"
                  placeholder="Asia/Ho_Chi_Minh"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Đường dẫn ảnh đại diện (Avatar URL)</label>
                <Input
                  value={form.avatarUrl}
                  onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
                  className="h-9 text-xs"
                  type="url"
                  placeholder="https://..."
                />
              </div>
            </div>

            {/* Thông số năng lực cá nhân */}
            <div className="rounded-lg border border-border/70 bg-muted/20 p-3.5 grid sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <span className="text-muted-foreground block text-[11px]">Năng lực giờ làm việc:</span>
                  <span className="font-semibold text-foreground">
                    {u.weeklyCapacityHours != null ? `${u.weeklyCapacityHours} giờ/tuần` : "Mặc định theo Workspace (40h/tuần)"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-500 shrink-0" />
                <div>
                  <span className="text-muted-foreground block text-[11px]">Cấp độ tài khoản:</span>
                  <span className="font-semibold text-foreground">
                    {u.isSuperAdmin || u.platformRole === "ROOT_ADMIN"
                      ? "Quản trị viên Nền tảng (Platform Super Admin)"
                      : "Thành viên Tiêu chuẩn (Standard Member)"}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="p-5 pt-0 justify-end border-t border-border/60">
            <Button type="submit" size="sm" className="h-8 text-xs gap-1.5" disabled={saveProfile.isPending}>
              {saveProfile.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Lưu thay đổi hồ sơ
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
