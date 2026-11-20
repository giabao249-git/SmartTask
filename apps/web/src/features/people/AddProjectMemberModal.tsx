"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Search, UserCheck, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SideDetailPanel } from "@/components/app/SideDetailPanel";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/app/UserAvatar";
import { api, describeError } from "@/lib/api";
import { qk, useWorkspaceMembers } from "@/lib/hooks/queries";
import type { ProjectRole } from "@/lib/types";
import { toast } from "sonner";

interface AddProjectMemberModalProps {
  projectId: string;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingMemberIds: string[];
  onSuccess?: () => void;
}

export function AddProjectMemberModal({
  projectId,
  workspaceId,
  open,
  onOpenChange,
  existingMemberIds,
  onSuccess,
}: AddProjectMemberModalProps) {
  const qc = useQueryClient();
  const [q, setQ] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [role, setRole] = React.useState<ProjectRole>("MEMBER");

  const wsMembersQuery = useWorkspaceMembers(workspaceId);

  // Reset selection when modal opens
  React.useEffect(() => {
    if (open) {
      setSelectedIds(new Set());
      setQ("");
      setRole("MEMBER");
    }
  }, [open]);

  // Lọc ra các thành viên workspace chưa tham gia dự án và không phải là VIEWER
  const existingSet = React.useMemo(() => new Set(existingMemberIds), [existingMemberIds]);
  const availableMembers = React.useMemo(() => {
    return (wsMembersQuery.data ?? []).filter(
      (m) => !existingSet.has(m.id) && m.role !== "VIEWER"
    );
  }, [wsMembersQuery.data, existingSet]);

  const filteredMembers = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return availableMembers;
    return availableMembers.filter(
      (m) =>
        m.fullName.toLowerCase().includes(query) ||
        m.email.toLowerCase().includes(query) ||
        (m.department && m.department.toLowerCase().includes(query)) ||
        (m.title && m.title.toLowerCase().includes(query))
    );
  }, [availableMembers, q]);

  const addMutation = useMutation({
    mutationFn: () =>
      api.post(`/projects/${projectId}/members`, {
        userIds: Array.from(selectedIds),
        role,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.project(projectId) });
      void qc.invalidateQueries({ queryKey: ["projects", projectId, "members"] });
      void qc.invalidateQueries({ queryKey: ["projects", projectId, "dashboard"] });
      void qc.invalidateQueries({ queryKey: ["analytics", projectId, "profiles"] });
      void qc.invalidateQueries({ queryKey: qk.members(workspaceId) });
      toast.success(`Đã thêm ${selectedIds.size} thành viên vào dự án!`);
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (err) => {
      const { message, code } = describeError(err);
      toast.error(message, { description: code });
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredMembers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMembers.map((m) => m.id)));
    }
  };

  return (
    <SideDetailPanel
      open={open}
      onClose={() => onOpenChange(false)}
      ariaLabel="Thêm thành viên vào dự án"
      contentClassName="p-5 sm:p-6 flex flex-col gap-4"
    >
        <div className="space-y-1.5 pr-8">
          <h2 className="text-base font-semibold flex items-center gap-2 text-foreground">
            <UserPlus className="h-4 w-4 text-primary" />
            <span>Thêm thành viên vào dự án</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Chọn các nhân sự từ danh bạ Workspace để bổ nhiệm vào đội ngũ dự án.
          </p>
        </div>

        {/* Thanh tìm kiếm & chọn vai trò */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm kiếm theo tên, email, chức danh..."
              className="h-8 pl-8 text-xs"
            />
          </div>

          <div className="w-32 shrink-0">
            <Select value={role} onValueChange={(v) => setRole(v as ProjectRole)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Vai trò" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MEMBER" className="text-xs">
                  Thành viên (MEMBER)
                </SelectItem>
                <SelectItem value="PM" className="text-xs">
                  Trưởng dự án (PM)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Thông báo nếu chọn PM */}
        {role === "PM" && (
          <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-900 dark:text-amber-200">
            Mỗi dự án chỉ có duy nhất 1 PM. Nếu chọn PM mới, PM hiện tại sẽ chuyển thành MEMBER.
          </div>
        )}

        {/* Danh sách thành viên khả dụng */}
        <div className="flex-1 min-h-[220px] max-h-[320px] overflow-y-auto border border-border/70 rounded-lg p-2 space-y-1">
          {wsMembersQuery.isPending ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : availableMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center p-4">
              <UserCheck className="h-8 w-8 text-muted-foreground/60 mb-2" />
              <p className="text-xs font-semibold text-foreground">
                Tất cả thành viên Workspace đã ở trong dự án
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 max-w-xs">
                Mọi nhân sự trong Workspace hiện tại đều đã tham gia dự án này. Để bổ sung người mới, vui lòng mời họ vào Workspace trước.
              </p>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-36 text-center text-xs text-muted-foreground">
              Không tìm thấy nhân sự phù hợp với từ khóa &ldquo;{q}&rdquo;.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-2 py-1 text-[11px] text-muted-foreground border-b border-border/40 mb-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all"
                    checked={
                      filteredMembers.length > 0 && selectedIds.size === filteredMembers.length
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                  <label htmlFor="select-all" className="cursor-pointer font-medium">
                    Chọn tất cả ({filteredMembers.length})
                  </label>
                </div>
                <span>Đã chọn: {selectedIds.size}</span>
              </div>

              {filteredMembers.map((m) => {
                const isSelected = selectedIds.has(m.id);
                return (
                  <div
                    key={m.id}
                    onClick={() => toggleSelect(m.id)}
                    className={`flex items-center justify-between p-2 rounded-md transition-colors cursor-pointer text-xs ${
                      isSelected
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-muted/50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(m.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <UserAvatar
                        name={m.fullName}
                        avatar={m.avatarUrl ?? undefined}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground truncate">
                          {m.fullName}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {[m.department, m.title].filter(Boolean).join(" · ") || m.email}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono">
                        {m.role}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/40">
          <span className="text-[11px] text-muted-foreground">
            {selectedIds.size > 0 ? `Đã chọn ${selectedIds.size} người` : "Chưa chọn nhân sự nào"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs"
            >
              Hủy
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={selectedIds.size === 0 || addMutation.isPending}
              onClick={() => addMutation.mutate()}
              className="h-8 text-xs gap-1.5"
            >
              {addMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              <span>Thêm vào dự án</span>
            </Button>
          </div>
        </div>
    </SideDetailPanel>
  );
}
