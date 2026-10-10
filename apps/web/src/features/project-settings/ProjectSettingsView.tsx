"use client";

import { useSearchParams } from "next/navigation";
import { Columns3, Flag, Info, Tags, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/app/PageHeader";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { GeneralTab } from "./GeneralTab";
import { SprintsTab } from "./SprintsTab";
import { ColumnsTab } from "./ColumnsTab";
import { LabelsTab } from "./LabelsTab";
import { ProjectMembersTab } from "./ProjectMembersTab";

/** Cấu hình dự án (UC-08/09/12): thông tin chung, sprint, cột Kanban, nhãn, thành viên dự án. Chỉ PM/quản trị sửa. */
export function ProjectSettingsView() {
  const project = useCurrentProject();
  const params = useSearchParams();
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Cấu hình dự án · ${project.key}`}
        description={project.canManage ? "Sprint, cột Kanban (WIP, cột hoàn thành), nhãn và thành viên dự án." : "Bạn chỉ xem — cần vai PM hoặc quản trị workspace để sửa."}
        breadcrumbs={[{ label: "Workspace", href: "/workspaces" }, { label: project.name, href: `/projects/${project.id}/dashboard` }, { label: "Cấu hình" }]}
      />
      {project.status === "ARCHIVED" && (
        <Alert>
          <AlertTitle className="text-xs">Dự án đã lưu trữ</AlertTitle>
          <AlertDescription className="text-[11px]">Chỉ đọc; mở lại ở tab Chung.</AlertDescription>
        </Alert>
      )}
      <Tabs defaultValue={params.get("tab") ?? "columns"} className="space-y-4">
        <TabsList className="grid w-full lg:w-[720px] grid-cols-5">
          <TabsTrigger value="sprints" className="text-xs gap-1.5">
            <Flag className="h-3.5 w-3.5" /> Sprint
          </TabsTrigger>
          <TabsTrigger value="columns" className="text-xs gap-1.5">
            <Columns3 className="h-3.5 w-3.5" /> Cột
          </TabsTrigger>
          <TabsTrigger value="labels" className="text-xs gap-1.5">
            <Tags className="h-3.5 w-3.5" /> Nhãn
          </TabsTrigger>
          <TabsTrigger value="members" className="text-xs gap-1.5">
            <Users className="h-3.5 w-3.5" /> Thành viên
          </TabsTrigger>
          <TabsTrigger value="general" className="text-xs gap-1.5">
            <Info className="h-3.5 w-3.5" /> Chung
          </TabsTrigger>
        </TabsList>
        <TabsContent value="sprints">
          <SprintsTab project={project} />
        </TabsContent>
        <TabsContent value="columns">
          <ColumnsTab project={project} />
        </TabsContent>
        <TabsContent value="labels">
          <LabelsTab project={project} />
        </TabsContent>
        <TabsContent value="members">
          <ProjectMembersTab project={project} />
        </TabsContent>
        <TabsContent value="general">
          <GeneralTab project={project} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
