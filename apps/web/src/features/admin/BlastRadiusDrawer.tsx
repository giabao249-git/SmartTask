"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { HoldToConfirmButton } from "./HoldToConfirmButton";
import type { AdminWorkspaceItem, WorkspaceLifecycleStatus } from "@/lib/types";

interface BlastRadiusDrawerProps {
  workspace: AdminWorkspaceItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmStatusChange: (
    workspaceId: string,
    newStatus: WorkspaceLifecycleStatus,
    reason: string,
    ticketReference?: string,
  ) => Promise<void>;
}

export function BlastRadiusDrawer({
  workspace,
  open,
  onOpenChange,
  onConfirmStatusChange,
}: BlastRadiusDrawerProps) {
  const [targetStatus, setTargetStatus] = React.useState<WorkspaceLifecycleStatus>("SOFT_SUSPENDED");
  const [reason, setReason] = React.useState("");
  const [ticketRef, setTicketRef] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (workspace) {
      if (workspace.status === "ACTIVE") {
        setTargetStatus("SOFT_SUSPENDED");
      } else {
        setTargetStatus("ACTIVE");
      }
      setReason("");
      setTicketRef("");
    }
  }, [workspace]);

  if (!workspace) return null;

  const handleConfirm = async () => {
    if (!reason.trim()) {
      alert("Vui lòng nhập lý do điều chỉnh trạng thái");
      return;
    }
    try {
      setIsSubmitting(true);
      await onConfirmStatusChange(workspace.id, targetStatus, reason.trim(), ticketRef.trim() || undefined);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDestructive =
    targetStatus === "SOFT_SUSPENDED" ||
    targetStatus === "READ_ONLY_ENFORCED" ||
    targetStatus === "PURGED";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>Điều Phối Vòng Đời Tổ Chức (Tenant State)</DialogTitle>
            <Badge variant="outline" className="font-mono text-xs">
              {workspace.slug}
            </Badge>
          </div>
          <DialogDescription>
            Tổ chức: <strong className="text-foreground">{workspace.name}</strong> (Chủ sở hữu:{" "}
            {workspace.owner?.fullName || workspace.owner?.email})
          </DialogDescription>
        </DialogHeader>

        {/* Real-time Blast Radius Assessment */}
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Định lượng tác động thời gian thực (Blast Radius Preview)
            </span>
            <span className="text-xs text-muted-foreground">SOC 2 Compliant</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded border border-border/70 bg-card p-2.5">
              <div className="text-lg font-bold text-foreground">{workspace.membersCount}</div>
              <div className="text-[11px] text-muted-foreground">Thành viên bị ảnh hưởng</div>
            </div>
            <div className="rounded border border-border/70 bg-card p-2.5">
              <div className="text-lg font-bold text-foreground">{workspace.projectsCount}</div>
              <div className="text-[11px] text-muted-foreground">Dự án đang vận hành</div>
            </div>
            <div className="rounded border border-border/70 bg-card p-2.5">
              <div className="text-lg font-bold text-foreground">{workspace.aiCallsCount}</div>
              <div className="text-[11px] text-muted-foreground">Lượt gọi AI tích lũy</div>
            </div>
          </div>
        </div>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label htmlFor="statusSelect" className="text-sm font-medium leading-none text-foreground block">
              Chọn trạng thái tiếp theo
            </label>
            <select
              id="statusSelect"
              value={targetStatus}
              onChange={(e) => setTargetStatus(e.target.value as WorkspaceLifecycleStatus)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="ACTIVE">ACTIVE — Hoạt động bình thường</option>
              <option value="WARNING_GRACE">WARNING_GRACE — Ân hạn cảnh báo (7 ngày)</option>
              <option value="READ_ONLY_ENFORCED">READ_ONLY_ENFORCED — Khóa ghi, chỉ cho xem/backup (3 ngày)</option>
              <option value="SOFT_SUSPENDED">SOFT_SUSPENDED — Tạm đình chỉ dịch vụ</option>
              <option value="COLD_STORAGE_ARCHIVED">COLD_STORAGE_ARCHIVED — Lưu trữ lạnh (30 ngày)</option>
              <option value="PURGED">PURGED — Xóa vĩnh viễn (Crypto-shredded)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ticketRef" className="text-sm font-medium leading-none text-foreground block">
              Mã Ticket hỗ trợ / Sự cố (Tuỳ chọn)
            </label>
            <Input
              id="ticketRef"
              placeholder="Ví dụ: TIK-892, SEC-P0-04"
              value={ticketRef}
              onChange={(e) => setTicketRef(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reason" className="text-sm font-medium leading-none text-foreground block">
              Lý do thay đổi <span className="text-destructive">*</span> (Ghi nhận bắt buộc vào Audit Log)
            </label>
            <Textarea
              id="reason"
              placeholder="Ghi rõ căn cứ pháp lý, vi phạm điều khoản hoặc khiếu nại đối soát..."
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Hủy bỏ
          </Button>

          {isDestructive ? (
            <HoldToConfirmButton
              label={`Giữ 2.5s để ${targetStatus === "SOFT_SUSPENDED" ? "Đình chỉ" : "Áp dụng"}`}
              holdingLabel="Đang xác thực bảo vệ..."
              variant="destructive"
              disabled={isSubmitting || !reason.trim()}
              onConfirm={handleConfirm}
            />
          ) : (
            <Button
              variant="default"
              disabled={isSubmitting || !reason.trim()}
              onClick={handleConfirm}
            >
              Khôi phục hoạt động
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
