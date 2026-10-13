"use client";

import Link from "next/link";
import { ArrowRight, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProjectDetail } from "@/lib/types";

/**
 * Sprint đã có trang riêng /projects/:id/sprints (docs 02/07 C1): lập kế hoạch, bắt đầu/kết thúc và xem lại.
 * Tab này giữ lại để link cũ `settings?tab=sprints` (thông báo đã gửi) vẫn dẫn tới nơi đúng.
 */
export function SprintsTab({ project }: { project: ProjectDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Flag className="h-4 w-4" /> Sprint đã chuyển sang trang riêng
        </CardTitle>
        <CardDescription>Tạo sprint, đưa việc từ backlog vào, xem năng lực nhóm, bắt đầu và kết thúc sprint — tất cả trên một màn.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild className="gap-1.5">
          <Link href={`/projects/${project.id}/dashboard`}>
            Mở Dashboard & Báo cáo Sprint <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
