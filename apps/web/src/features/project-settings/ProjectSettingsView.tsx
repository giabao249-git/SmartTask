"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Columns3, Flag, Info, ShieldAlert, Tags, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/app/PageHeader";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { GeneralTab } from "./GeneralTab";
import { SprintsTab } from "./SprintsTab";
import { ColumnsTab } from "./ColumnsTab";
import { LabelsTab } from "./LabelsTab";
import { ProjectMembersTab } from "./ProjectMembersTab";

/** Cấu hình dự án (UC-08/09/12): thông tin chung, sprint, cột Kanban, nhãn, thành viên dự án. Chỉ PM/quản trị truy cập & sửa. */
export function ProjectSettingsView() {
  const project = useCurrentProject();
  const params = useSearchParams();
  const router = useRouter();

  // Thành viên bình thường không có quyền quản lý dự án sẽ không xem được màn hình cấu hình
  if (!project.canManage) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={`Cấu hình dự án · ${project.key}`}
          description="Khu vực dành riêng cho Quản lý dự án (PM) và Quản trị viên."
          breadcrumbs={[
            { label: "Workspace", href: "/workspaces" },
            { label: project.name, href: `/projects/${project.id}/dashboard` },
            { label: "Cấu hình" },
          ]}
        />
        <Card className="border-border/80 p-8 text-center max-w-xl mx-auto shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h2 className="text-base font-semibold text-foreground">
              Không có quyền truy cập cấu hình dự án
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Bạn đang tham gia dự án <strong>{project.name}</strong> với vai trò Thành viên (Member). Khu vực cấu hình Sprint, cột Kanban, nhãn và nhân sự dự án chỉ khả dụng cho <strong>Trưởng dự án (PM)</strong> hoặc <strong>Quản trị viên Workspace</strong>.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <Button
                size="sm"
                className="text-xs"
                onClick={() => router.push(`/projects/${project.id}/work`)}
              >
                Về Bảng công việc
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => router.push(`/projects/${project.id}/dashboard`)}
              >
                Xem Dashboard
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Cấu hình dự án · ${project.key}`}
        description="Sprint, cột Kanban (WIP, cột hoàn thành), nhãn và nhân sự dự án."
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
