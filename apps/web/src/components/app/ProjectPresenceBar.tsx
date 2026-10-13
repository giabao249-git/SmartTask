"use client";

import * as React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/app/UserAvatar";
import { useProjectPresence } from "@/features/board/hooks";
import { useProject } from "@/lib/hooks/queries";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const VIEW_LABEL: Record<string, string> = {
  board: "Bảng Kanban",
  list: "Danh sách",
  timeline: "Timeline Gantt",
  eisenhower: "Ma trận Eisenhower",
  workload: "Tải công việc",
  dashboard: "Dashboard",
  assistant: "Trợ lý AI",
  settings: "Cài đặt dự án",
};

export interface ProjectPresenceBarProps {
  projectId?: string | null;
  currentView?: string;
  className?: string;
}

export function ProjectPresenceBar({ projectId, currentView = "board", className }: ProjectPresenceBarProps) {
  const auth = useAuth();
  const presence = useProjectPresence(projectId, currentView);
  const project = useProject(projectId ?? undefined).data;

  const activeMembers = React.useMemo(() => {
    if (!project || presence.length === 0) return [];
    const membersMap = new Map(project.members.map((m) => [m.id, m]));
    return presence
      .map((entry) => {
        const member = membersMap.get(entry.userId);
        return {
          ...entry,
          member: member ?? {
            id: entry.userId,
            fullName: entry.userId === auth.user?.id ? (auth.user?.fullName ?? "Bạn") : "Thành viên",
            avatarUrl: entry.userId === auth.user?.id ? auth.user?.avatarUrl : null,
            role: "MEMBER" as const,
          },
          isSelf: entry.userId === auth.user?.id,
        };
      })
      .filter((m) => Boolean(m.member));
  }, [project, presence, auth.user]);

  if (!projectId || activeMembers.length === 0) return null;

  return (
    <TooltipProvider delayDuration={150}>
      <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/40 border border-border/50 text-xs", className)}>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="text-[11px] font-medium text-muted-foreground mr-0.5 hidden xl:inline">
          {activeMembers.length} đang xem
        </span>

        <div className="flex items-center -space-x-1.5 overflow-hidden">
          {activeMembers.slice(0, 4).map((item) => (
            <Tooltip key={item.userId}>
              <TooltipTrigger asChild>
                <div className="relative inline-block ring-2 ring-background rounded-full transition-transform hover:scale-110 hover:z-10 cursor-pointer">
                  <UserAvatar
                    name={item.member.fullName}
                    avatar={item.member.avatarUrl ?? undefined}
                    size="sm"
                    showTooltip={false}
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-1 ring-background" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <div className="font-semibold flex items-center gap-1">
                  <span>{item.member.fullName}</span>
                  {item.isSelf && <span className="text-muted-foreground text-[10px] font-normal">(Bạn)</span>}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Đang xem: {VIEW_LABEL[item.view] ?? item.view}
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
          {activeMembers.length > 4 && (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground ring-2 ring-background">
              +{activeMembers.length - 4}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
