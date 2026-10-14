"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Award, CalendarRange, UserPlus, Users2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/app/PageHeader";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { useAuth } from "@/lib/auth";
import { WorkloadView } from "@/features/workload/WorkloadView";
import { AddProjectMemberModal } from "./AddProjectMemberModal";
import { TeamSkillsView } from "./TeamSkillsView";
import { TeamView } from "./TeamView";

const TABS = [
  { key: "team", label: "Nhóm", icon: Users2 },
  { key: "load", label: "Tải & giờ trống", icon: CalendarRange },
  { key: "skills", label: "Kỹ năng", icon: Award },
] as const;
/** Link cũ (tab đã gộp, đường /workload, /rebalance, /skills) vẫn tới đúng chỗ */
const ALIAS: Record<string, string> = { workload: "load", balance: "load", mine: "team" };
type TabKey = (typeof TABS)[number]["key"];

/** Màn "Nhân sự": tải theo tuần, bảng năng lực & cân bằng, kỹ năng — cùng một câu hỏi "ai làm được việc gì, còn bao nhiêu giờ". */
export function PeopleView() {
  const project = useCurrentProject();
  const router = useRouter();
  const params = useSearchParams();
  const me = useAuth().user?.id;
  const raw = params.get("tab") ?? "team";
  const tab: TabKey = (TABS.find((t) => t.key === (ALIAS[raw] ?? raw))?.key ?? "team") as TabKey;
  const [addMemberOpen, setAddMemberOpen] = React.useState(false);

  // "?tab=mine" cũ = mở hồ sơ của chính mình
  React.useEffect(() => {
    if (raw !== "mine" || !me) return;
    const next = new URLSearchParams(params.toString());
    next.delete("tab");
    next.set("member", me);
    router.replace(`?${next.toString()}`, { scroll: false });
  }, [raw, me, params, router]);
  const setTab = (v: string) => {
    const next = new URLSearchParams(params.toString());
    next.delete("member");
    if (v === "team") next.delete("tab");
    else next.set("tab", v);
    router.replace(`?${next.toString()}`, { scroll: false });
  };

  const canManage = Boolean(project.canManage && project.status === "ACTIVE");

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Nhân sự · ${project.key}`}
        description="Ai đang làm gì, còn bao nhiêu giờ, làm được gì — kỹ năng tính từ việc đã làm, không từ tự khai."
        breadcrumbs={[
          { label: "Workspace", href: "/workspaces" },
          { label: project.name, href: `/projects/${project.id}/dashboard` },
          { label: TABS.find((t) => t.key === tab)?.label ?? "Nhân sự" },
        ]}
      >
        {canManage && (
          <Button
            size="sm"
            onClick={() => setAddMemberOpen(true)}
            className="h-8 text-xs gap-1.5 shrink-0"
          >
            <UserPlus className="h-3.5 w-3.5" /> Thêm thành viên vào dự án
          </Button>
        )}
      </PageHeader>

      <AddProjectMemberModal
        projectId={project.id}
        workspaceId={project.workspaceId}
        open={addMemberOpen}
        onOpenChange={setAddMemberOpen}
        existingMemberIds={project.members.map((m) => m.id)}
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="h-9 hidden sm:inline-flex">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="text-xs gap-1.5">
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <Select value={tab} onValueChange={setTab}>
          <SelectTrigger className="h-9 text-xs w-56 sm:hidden">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TABS.map((t) => (
              <SelectItem key={t.key} value={t.key} className="text-xs">
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <TabsContent value="team">
          <TeamView />
        </TabsContent>
        <TabsContent value="load">
          <WorkloadView />
        </TabsContent>
        <TabsContent value="skills">
          <TeamSkillsView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
