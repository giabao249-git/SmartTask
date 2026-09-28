"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { api, describeError } from "@/lib/api";
import { useSkills } from "@/lib/hooks/queries";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface MySkill {
  id: string;
  name: string;
  category: string;
  level: number;
  verifiedAt: string | null;
}

/**
 * Tự khai mức kỹ năng — CHỈ THAM KHẢO (docs 02/08): không dùng để chia việc; giúp PM biết bạn có thể/ muốn nhận
 * mảng nào, PM có thể xác nhận thành bằng chứng. Ma trận theo tự khai cũ đã thay bằng `features/people/TeamSkillsView`.
 */
export function DeclaredSkillsEditor({ workspaceId, projectId }: { workspaceId: string; projectId: string }) {
  const qc = useQueryClient();
  const skills = useSkills(workspaceId);
  const mine = useQuery({ queryKey: ["workspaces", workspaceId, "me", "skills"], queryFn: () => api.get<MySkill[]>(`/workspaces/${workspaceId}/me/skills`) });
  const [draft, setDraft] = React.useState<Record<string, number> | null>(null);
  const save = useMutation({
    mutationFn: (levels: Record<string, number>) =>
      api.put<MySkill[]>(`/workspaces/${workspaceId}/me/skills`, {
        skills: Object.entries(levels)
          .filter(([, l]) => l > 0)
          .map(([skillId, level]) => ({ skillId, level })),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["workspaces", workspaceId, "me", "skills"] });
      void qc.invalidateQueries({ queryKey: ["projects", projectId, "skill-profiles"] });
      setDraft(null);
      toast.success("Đã lưu mức tự khai", { description: "Mức đổi thì mất xác nhận của PM; chia việc vẫn dựa trên việc đã làm." });
    },
    onError: (e) => toast.error(describeError(e).message),
  });
  const levels = React.useMemo(() => {
    const cur: Record<string, number> = {};
    for (const s of mine.data ?? []) cur[s.id] = s.level;
    return draft ?? cur;
  }, [mine.data, draft]);

  if (skills.isPending || mine.isPending) return <Skeleton className="h-40 w-full" />;
  if (skills.isError || mine.isError)
    return (
      <ErrorState
        code={describeError(skills.error ?? mine.error).code}
        message={describeError(skills.error ?? mine.error).message}
        onRetry={() => void Promise.all([skills.refetch(), mine.refetch()])}
      />
    );
  if (skills.data.length === 0) return <EmptyState title="Workspace chưa có kỹ năng" description="Quản trị viên thêm kỹ năng ở cài đặt workspace." />;
  // Kỹ năng đã khai lên đầu, còn lại theo nhóm
  const sorted = [...skills.data].sort((a, b) => Number((levels[b.id] ?? 0) > 0) - Number((levels[a.id] ?? 0) > 0) || a.category.localeCompare(b.category, "vi") || a.name.localeCompare(b.name, "vi"));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">0 = không khai. Đổi mức làm mất xác nhận của PM.</p>
        <Button size="sm" className="h-8 gap-1.5 text-xs" disabled={!draft || save.isPending} onClick={() => draft && save.mutate(draft)}>
          <Save className="h-3.5 w-3.5" /> Lưu
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {sorted.map((s) => {
          const cur = levels[s.id] ?? 0;
          const verified = mine.data.find((m) => m.id === s.id)?.verifiedAt;
          return (
            <div key={s.id} className={cn("flex items-center gap-2 rounded-md border border-border/60 p-2 text-xs", cur > 0 && "bg-muted/30")}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 truncate font-medium">
                  {s.name}
                  {verified && !draft && <BadgeCheck className="h-3 w-3 text-success" aria-label="PM đã xác nhận" />}
                </div>
                <div className="text-[11px] text-muted-foreground">{s.category}</div>
              </div>
              <div className="flex items-center gap-0.5" role="radiogroup" aria-label={`Mức tự khai ${s.name}`}>
                {[0, 1, 2, 3, 4, 5].map((l) => (
                  <Button
                    key={l}
                    role="radio"
                    aria-checked={cur === l}
                    variant={cur === l ? "default" : "ghost"}
                    size="sm"
                    className="h-6 w-6 p-0 text-[11px] tabular-nums"
                    onClick={() => setDraft({ ...levels, [s.id]: l })}
                  >
                    {l}
                  </Button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
