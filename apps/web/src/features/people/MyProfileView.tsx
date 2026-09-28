"use client";

import * as React from "react";
import { ChevronDown, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/app/ErrorState";
import { DeclaredSkillsEditor } from "@/features/skills/SkillsMatrixView";
import { describeError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useSkillProfiles } from "@/lib/hooks/analytics";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { cn } from "@/lib/utils";
import { MemberProfile } from "./MemberProfile";

/**
 * "Hồ sơ của tôi": trước đây là lưới 30 kỹ năng × 0–5 để TỰ KHAI — và chính con số đó được đem đi chia việc.
 * Giờ phần chính là hồ sơ tính từ việc đã làm; tự khai thu gọn thành phần tham khảo.
 */
export function MyProfileView() {
  const project = useCurrentProject();
  const me = useAuth().user;
  const q = useSkillProfiles(project.id);
  const [editOpen, setEditOpen] = React.useState(false);
  if (q.isPending) return <Skeleton className="h-72 w-full" />;
  if (q.isError) return <ErrorState code={describeError(q.error).code} message={describeError(q.error).message} onRetry={() => q.refetch()} />;
  const mine = q.data.find((m) => m.id === me?.id);
  return (
    <div className="space-y-4">
      {mine ? (
        <Card className="border-border/80">
          <CardContent className="p-4">
            <MemberProfile projectId={project.id} member={mine} self />
          </CardContent>
        </Card>
      ) : (
        <p className="rounded-md border border-dashed border-border/80 px-3 py-2.5 text-xs text-muted-foreground">Bạn không phải thành viên dự án này nên chưa có hồ sơ ở đây.</p>
      )}

      <Card className="border-border/80">
        <Collapsible open={editOpen} onOpenChange={setEditOpen}>
          <CardHeader className="p-4">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="-mx-2 h-auto w-[calc(100%+1rem)] items-start justify-between gap-2 whitespace-normal px-2 py-1 font-normal">
                <span className="text-left">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <PencilLine className="h-4 w-4 text-muted-foreground" /> Kỹ năng tự khai (tham khảo)
                  </CardTitle>
                  <CardDescription className="mt-1 text-xs">Không dùng để chia việc. Cho PM biết bạn làm được hoặc muốn nhận mảng nào — PM có thể xác nhận thành bằng chứng.</CardDescription>
                </span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", editOpen && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="p-4 pt-0">{editOpen && <DeclaredSkillsEditor workspaceId={project.workspaceId} projectId={project.id} />}</CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}
