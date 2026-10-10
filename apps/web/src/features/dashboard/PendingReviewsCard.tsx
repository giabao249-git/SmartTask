"use client";

import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/app/UserAvatar";
import { usePendingReviews } from "@/lib/hooks/analytics";
import { dm } from "@/features/people/format";

/**
 * Việc đã xong chờ PM đánh giá (UC-36) — là VIỆC CẦN LÀM của PM nên nằm ở Dashboard, không ở màn Nhân sự.
 * Đánh giá là nguồn "feedback" của hồ sơ kỹ năng (docs 02/08). Không có việc chờ thì không chiếm chỗ.
 */
export function PendingReviewsCard({ projectId }: { projectId: string }) {
  const q = usePendingReviews(projectId, true);
  const rows = q.data ?? [];
  if (!rows.length) return null;
  return (
    <Card className="border-border/80">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ClipboardCheck className="h-4 w-4 text-info" /> {rows.length} việc đã xong chờ bạn đánh giá
        </CardTitle>
        <CardDescription className="text-xs">Mở việc → thẻ &quot;Đánh giá khi xong&quot;. Chưa đánh giá thì hồ sơ kỹ năng của người làm chỉ tính nửa phần.</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <ul className="divide-y divide-border/60">
          {rows.slice(0, 5).map((t) => (
            <li key={t.id} className="flex min-w-0 items-center gap-3 py-2 text-xs">
              <Link href={`/projects/${projectId}/tasks/${t.key}`} className="min-w-0 flex-1 truncate hover:underline">
                <span className="mr-1.5 font-mono text-muted-foreground">{t.key}</span>
                {t.title}
              </Link>
              <span className="hidden shrink-0 items-center gap-1 sm:flex">
                {t.assignees.slice(0, 2).map((a) => (
                  <UserAvatar key={a.id} name={a.shortName ?? a.fullName} avatar={a.avatarUrl ?? undefined} size="sm" />
                ))}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">xong {dm(t.completedAt)}</span>
              {t.selfAssigned && (
                <Badge variant="outline" className="shrink-0 text-[10px] font-normal" title="Tự chấm không tính vào hồ sơ kỹ năng">
                  việc của bạn
                </Badge>
              )}
            </li>
          ))}
        </ul>
        {rows.length > 5 && <p className="pt-1 text-[11px] text-muted-foreground">và {rows.length - 5} việc nữa</p>}
      </CardContent>
    </Card>
  );
}
