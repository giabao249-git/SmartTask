"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { Bell, Loader2, Save, Sliders } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, describeError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { NotificationPrefKey, NotificationPrefs } from "@/lib/types";
import { NotificationsPanel } from "@/features/notifications/NotificationsPanel";
import { toast } from "sonner";

const PREF_ROWS: { key: NotificationPrefKey; label: string; desc: string }[] = [
  { key: "taskAssigned", label: "Được giao việc mới", desc: "Khi có người phân công nhiệm vụ cho bạn" },
  { key: "mentioned", label: "Được nhắc tên (@mention)", desc: "Trong bình luận task hoặc trao đổi nhóm" },
  { key: "taskDue", label: "Sắp đến hạn / Quá hạn", desc: "Cảnh báo trước 24h và khi task quá thời hạn" },
  { key: "workloadAlert", label: "Cảnh báo quá tải", desc: "Khi tổng giờ công vượt ngưỡng an toàn tuần" },
  { key: "sprint", label: "Chu kỳ Sprint", desc: "Khi Sprint mới bắt đầu hoặc hoàn tất đóng chu kỳ" },
];

const CHANNELS = [
  { id: "inApp" as const, label: "Trong ứng dụng" },
  { id: "push" as const, label: "Web Push / Thiết bị" },
];

export function NotificationsTab() {
  const auth = useAuth();
  const u = auth.user;
  const [prefs, setPrefs] = React.useState<NotificationPrefs>(u?.notificationPrefs ?? {});

  React.useEffect(() => {
    if (u?.notificationPrefs) {
      setPrefs(u.notificationPrefs);
    }
  }, [u]);

  const savePrefs = useMutation({
    mutationFn: () => api.put<NotificationPrefs>("/me/notification-prefs", prefs),
    onSuccess: async () => {
      await auth.refetchMe();
      toast.success("Đã lưu tùy chọn nhận thông báo");
    },
    onError: (e: unknown) => {
      const { message } = describeError(e);
      toast.error("Không thể lưu tùy chọn: " + message);
    },
  });

  const prefOn = (ch: "inApp" | "push", k: NotificationPrefKey) => prefs[ch]?.[k] ?? true;
  const setPref = (ch: "inApp" | "push", k: NotificationPrefKey, v: boolean) =>
    setPrefs((p) => ({ ...p, [ch]: { ...(p[ch] ?? {}), [k]: v } }));

  return (
    <div className="space-y-6">
      {/* Trung tâm Thông báo trực tiếp */}
      <Card className="border-border/80">
        <CardHeader className="p-5 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Hộp thư Thông báo</CardTitle>
              <CardDescription className="text-xs">
                Xem và quản lý các thông báo thời gian thực về phân công việc, nhắc tên và sự kiện hệ thống.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <div className="min-h-[280px]">
            <NotificationsPanel compact={false} />
          </div>
        </CardContent>
      </Card>

      {/* Tùy chọn Kênh nhận thông báo */}
      <Card className="border-border/80">
        <CardHeader className="p-5 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-muted text-foreground">
                <Sliders className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Tùy chọn Kênh nhận thông báo</CardTitle>
                <CardDescription className="text-xs">
                  Tùy chỉnh sự kiện nào sẽ gửi thông báo trong ứng dụng hoặc đẩy qua Web Push.
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-0">
          <div className="rounded-lg border border-border/70 overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="text-xs font-semibold">Loại sự kiện</TableHead>
                  <TableHead className="text-xs text-center w-36 font-semibold">Trong ứng dụng</TableHead>
                  <TableHead className="text-xs text-center w-36 font-semibold">Web Push</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PREF_ROWS.map((r) => (
                  <TableRow key={r.key} className="text-xs hover:bg-muted/20">
                    <TableCell className="py-3">
                      <span className="font-medium text-foreground block">{r.label}</span>
                      <span className="text-[11px] text-muted-foreground">{r.desc}</span>
                    </TableCell>
                    {CHANNELS.map((ch) => (
                      <TableCell key={ch.id} className="text-center py-3">
                        <Checkbox
                          checked={prefOn(ch.id, r.key)}
                          onCheckedChange={(c) => setPref(ch.id, r.key, c === true)}
                          aria-label={`${r.label} ${ch.label}`}
                          className="data-[state=checked]:bg-primary"
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>

        <CardFooter className="p-5 pt-0 justify-end border-t border-border/60">
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5"
            disabled={savePrefs.isPending}
            onClick={() => savePrefs.mutate()}
          >
            {savePrefs.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Lưu tùy chọn nhận tin
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
