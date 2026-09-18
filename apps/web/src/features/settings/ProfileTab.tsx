"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, Loader2, Save, UserCircle, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, describeError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { NotificationPrefKey, NotificationPrefs, UserView } from "@/lib/types";
import { toast } from "sonner";

const PREF_ROWS: { key: NotificationPrefKey; label: string }[] = [
  { key: "taskAssigned", label: "Được giao việc" },
  { key: "mentioned", label: "Được nhắc tên" },
  { key: "taskDue", label: "Sắp hạn / quá hạn" },
  { key: "workloadAlert", label: "Cảnh báo tải" },
  { key: "sprint", label: "Sprint bắt đầu / kết thúc" },
];
const CHANNELS = ["inApp", "push"] as const;

/** Tài khoản: PATCH /me (hồ sơ), PATCH /me/password, PUT /me/notification-prefs. */
export function ProfileTab() {
  const auth = useAuth();
  const u = auth.user;
  const [form, setForm] = React.useState({ fullName: u?.fullName ?? "", shortName: u?.shortName ?? "", timezone: u?.timezone ?? "Asia/Ho_Chi_Minh", avatarUrl: u?.avatarUrl ?? "" });
  const [pw, setPw] = React.useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [prefs, setPrefs] = React.useState<NotificationPrefs>(u?.notificationPrefs ?? {});
  React.useEffect(() => {
    if (u) {
      setForm({ fullName: u.fullName, shortName: u.shortName ?? "", timezone: u.timezone, avatarUrl: u.avatarUrl ?? "" });
      setPrefs(u.notificationPrefs ?? {});
    }
  }, [u]);

  const onErr = (e: unknown) => {
    const { code, message } = describeError(e);
    toast.error(code === "VALIDATION_FAILED" ? "Dữ liệu không hợp lệ" : code === "INVALID_CREDENTIALS" ? "Mật khẩu hiện tại sai" : message, { description: code });
  };
  const saveProfile = useMutation({
    mutationFn: () => api.patch<UserView>("/me", { fullName: form.fullName.trim(), shortName: form.shortName.trim() || undefined, timezone: form.timezone.trim(), avatarUrl: form.avatarUrl.trim() || undefined }),
    onSuccess: async () => {
      await auth.refetchMe();
      toast.success("Đã lưu hồ sơ");
    },
    onError: onErr,
  });
  const changePw = useMutation({
    mutationFn: () => api.patch<void>("/me/password", { currentPassword: pw.currentPassword, newPassword: pw.newPassword }),
    onSuccess: () => {
      setPw({ currentPassword: "", newPassword: "", confirm: "" });
      toast.success("Đã đổi mật khẩu — các phiên khác sẽ phải đăng nhập lại");
    },
    onError: onErr,
  });
  const savePrefs = useMutation({
    mutationFn: () => api.put<NotificationPrefs>("/me/notification-prefs", prefs),
    onSuccess: async () => {
      await auth.refetchMe();
      toast.success("Đã lưu tuỳ chọn thông báo");
    },
    onError: onErr,
  });
  const prefOn = (ch: (typeof CHANNELS)[number], k: NotificationPrefKey) => prefs[ch]?.[k] ?? true;
  const setPref = (ch: (typeof CHANNELS)[number], k: NotificationPrefKey, v: boolean) => setPrefs((p) => ({ ...p, [ch]: { ...(p[ch] ?? {}), [k]: v } }));

  if (!u) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveProfile.mutate();
        }}
      >
        <Card className="border-border/80 h-full">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <UserCircle className="h-4 w-4" /> Hồ sơ
            </CardTitle>
            <CardDescription className="text-xs">{u.email} · năng lực {u.weeklyCapacityHours != null ? `${u.weeklyCapacityHours} h/tuần` : "theo mặc định workspace"}</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs">
              <span className="font-medium">Họ tên</span>
              <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="h-8 text-xs" required minLength={2} maxLength={100} />
            </label>
            <label className="space-y-1 text-xs">
              <span className="font-medium">Tên gọi (AI dùng để nhận diện)</span>
              <Input value={form.shortName} onChange={(e) => setForm({ ...form, shortName: e.target.value })} className="h-8 text-xs" maxLength={30} placeholder="Lan" />
            </label>
            <label className="space-y-1 text-xs">
              <span className="font-medium">Múi giờ</span>
              <Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className="h-8 text-xs" placeholder="Asia/Ho_Chi_Minh" />
            </label>
            <label className="space-y-1 text-xs">
              <span className="font-medium">Ảnh đại diện (URL)</span>
              <Input value={form.avatarUrl} onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })} className="h-8 text-xs" type="url" />
            </label>
          </CardContent>
          <CardFooter className="p-4 pt-0 justify-end">
            <Button type="submit" size="sm" className="h-8 text-xs gap-1.5" disabled={saveProfile.isPending}>
              {saveProfile.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Lưu hồ sơ
            </Button>
          </CardFooter>
        </Card>
      </form>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pw.newPassword !== pw.confirm) return toast.error("Mật khẩu nhập lại không khớp");
          changePw.mutate();
        }}
      >
        <Card className="border-border/80 h-full">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> Đổi mật khẩu
            </CardTitle>
            <CardDescription className="text-xs">Tối thiểu 8 ký tự, có chữ và số. Đổi xong, refresh token cũ bị thu hồi.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2 grid gap-3">
            <Input type="password" autoComplete="current-password" placeholder="Mật khẩu hiện tại" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} className="h-8 text-xs" required />
            <Input type="password" autoComplete="new-password" placeholder="Mật khẩu mới" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} className="h-8 text-xs" required minLength={8} />
            <Input type="password" autoComplete="new-password" placeholder="Nhập lại mật khẩu mới" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} className="h-8 text-xs" required minLength={8} />
          </CardContent>
          <CardFooter className="p-4 pt-0 justify-end">
            <Button type="submit" variant="outline" size="sm" className="h-8 text-xs gap-1.5" disabled={changePw.isPending}>
              {changePw.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Đổi mật khẩu
            </Button>
          </CardFooter>
        </Card>
      </form>

      <Card className="border-border/80 lg:col-span-2">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BellRing className="h-4 w-4" /> Nhận thông báo
          </CardTitle>
          <CardDescription className="text-xs">Mặc định bật. Kênh push (web push) chưa triển khai trong phạm vi đồ án — lưu tuỳ chọn để sẵn.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Loại</TableHead>
                <TableHead className="text-xs text-center w-32">Trong ứng dụng</TableHead>
                <TableHead className="text-xs text-center w-32">Push</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PREF_ROWS.map((r) => (
                <TableRow key={r.key} className="text-xs">
                  <TableCell>{r.label}</TableCell>
                  {CHANNELS.map((ch) => (
                    <TableCell key={ch} className="text-center">
                      <Checkbox checked={prefOn(ch, r.key)} onCheckedChange={(c) => setPref(ch, r.key, c === true)} aria-label={`${r.label} ${ch}`} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="p-4 pt-0 justify-end">
          <Button size="sm" className="h-8 text-xs gap-1.5" disabled={savePrefs.isPending} onClick={() => savePrefs.mutate()}>
            {savePrefs.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Lưu tuỳ chọn
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
