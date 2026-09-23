"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Award, BadgeCheck, Scale, Users2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/app/PageHeader";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { WorkloadView } from "@/features/workload/WorkloadView";
import { RebalanceView } from "@/features/rebalance/RebalanceView";
import { SkillsMatrixView } from "@/features/skills/SkillsMatrixView";

const TABS = [
  { key: "workload", label: "Tải theo tuần", icon: Users2 },
  { key: "balance", label: "Năng lực & cân bằng", icon: Scale },
  { key: "skills", label: "Ma trận kỹ năng", icon: Award },
  { key: "mine", label: "Kỹ năng của tôi", icon: BadgeCheck },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/** Màn "Nhân sự": tải theo tuần, bảng năng lực & cân bằng, kỹ năng — cùng một câu hỏi "ai làm được việc gì, còn bao nhiêu giờ". */
export function PeopleView() {
  const project = useCurrentProject();
  const router = useRouter();
  const params = useSearchParams();
  const tab: TabKey = (TABS.find((t) => t.key === params.get("tab"))?.key ?? "workload") as TabKey;
  const setTab = (v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v === "workload") next.delete("tab");
    else next.set("tab", v);
    router.replace(`?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Nhân sự · ${project.key}`}
        description="Tải theo tuần, giờ trống và kỹ năng của nhóm — số liệu backend tính, quyết định giao việc vẫn là của bạn."
        breadcrumbs={[
          { label: "Workspace", href: "/workspaces" },
          { label: project.name, href: `/projects/${project.id}/dashboard` },
          { label: TABS.find((t) => t.key === tab)?.label ?? "Nhân sự" },
        ]}
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

        <TabsContent value="workload">
          <WorkloadView />
        </TabsContent>
        <TabsContent value="balance">
          <RebalanceView />
        </TabsContent>
        <TabsContent value="skills">
          <SkillsMatrixView section="matrix" />
        </TabsContent>
        <TabsContent value="mine">
          <SkillsMatrixView section="mine" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
