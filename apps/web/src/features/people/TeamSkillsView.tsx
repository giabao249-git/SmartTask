"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Award, BadgeCheck, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { SkillLevel } from "@/components/app/SkillLevel";
import { UserAvatar } from "@/components/app/UserAvatar";
import { api, describeError } from "@/lib/api";
import { useSkillProfiles } from "@/lib/hooks/analytics";
import { useCurrentProject } from "@/lib/hooks/use-project";
import type { MemberProfileView, SkillEvidenceView } from "@/lib/types";
import { toast } from "sonner";
import { levelText } from "./MemberProfile";

/**
 * Ma trận kỹ năng TỪ BẰNG CHỨNG (docs 02/08). Trước đây ma trận, cảnh báo "bus factor" và nút xác nhận đều chạy trên
 * mức tự khai. Ô chỉ có tự khai hiện mờ để PM biết mà xác nhận (xác nhận = một bằng chứng) hoặc giao việc thử.
 */
export function TeamSkillsView() {
  const project = useCurrentProject();
  const qc = useQueryClient();
  const q = useSkillProfiles(project.id);
  const [minLevel, setMinLevel] = React.useState(3);
  const verify = useMutation({
    mutationFn: (v: { userId: string; skillId: string; level: number }) => api.patch(`/users/${v.userId}/skills/${v.skillId}/verify`, { level: v.level }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["projects", project.id, "skill-profiles"] });
      void qc.invalidateQueries({ queryKey: ["projects", project.id, "capacity-table"] });
      toast.success("Đã xác nhận — tính là một bằng chứng trong hồ sơ kỹ năng");
    },
    onError: (e) => toast.error(describeError(e).message, { description: describeError(e).code }),
  });

  if (q.isPending) return <Skeleton className="h-72 w-full" />;
  if (q.isError) return <ErrorState code={describeError(q.error).code} message={describeError(q.error).message} onRetry={() => q.refetch()} />;

  const members = q.data;
  const cellOf = (m: MemberProfileView, skillId: string) => m.skills.find((s) => s.skillId === skillId);
  const skillMap = new Map<string, string>();
  for (const m of members) for (const s of m.skills) skillMap.set(s.skillId, s.name);
  const holders = (skillId: string) => members.filter((m) => (cellOf(m, skillId)?.level ?? 0) >= minLevel).length;
  const proven = (skillId: string) => members.some((m) => (cellOf(m, skillId)?.confidence ?? "none") !== "none");
  const skills = [...skillMap.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => holders(b.id) - holders(a.id) || Number(proven(b.id)) - Number(proven(a.id)) || a.name.localeCompare(b.name, "vi"));
  const single = skills.filter((s) => holders(s.id) === 1);
  const claimedOnly = skills.filter((s) => !proven(s.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Tính &quot;đạt&quot; từ mức</span>
        <Select value={String(minLevel)} onValueChange={(v) => setMinLevel(Number(v))}>
          <SelectTrigger className="h-8 w-16 text-xs" aria-label="Mức tối thiểu">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5].map((l) => (
              <SelectItem key={l} value={String(l)} className="text-xs">
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {single.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-border/80 px-3 py-2.5 text-xs text-foreground">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
          <p>
            <span className="font-semibold">
              {single.length} kỹ năng chỉ một người có bằng chứng đạt mức {minLevel}
            </span>{" "}
            — người đó nghỉ là nhóm hụt: {single.map((s) => s.name).join(", ")}.
          </p>
        </div>
      )}

      <Card className="border-border/80">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Kỹ năng của nhóm theo việc đã làm</CardTitle>
          <CardDescription className="text-xs">
            Mức tính từ việc đã xong, đánh giá, số lần phải làm lại. Ô mờ = chỉ có tự khai.
            {project.canManage ? " Bấm ô mờ để xác nhận mức nếu bạn đã thấy người đó làm được." : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-4 sm:pt-0">
          {skills.length === 0 ? (
            <EmptyState icon={Award} title="Chưa có dữ liệu kỹ năng" description="Gắn Kỹ năng yêu cầu cho việc; khi việc xong, mức của người làm hiện ở đây." className="py-8" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 bg-card text-xs">Kỹ năng</TableHead>
                    {members.map((m) => (
                      <TableHead key={m.id} className="min-w-24 text-center text-xs">
                        <div className="flex flex-col items-center gap-1 py-1">
                          <UserAvatar name={m.shortName ?? m.fullName} avatar={m.avatarUrl ?? undefined} size="sm" />
                          <span className="whitespace-nowrap">{m.shortName?.replace(/\s*\(.*\)$/, "") ?? m.fullName}</span>
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="text-center text-xs whitespace-nowrap">Đạt ≥ {minLevel}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {skills.map((s) => {
                    const n = holders(s.id);
                    return (
                      <TableRow key={s.id} className="text-xs">
                        <TableCell className="sticky left-0 z-10 bg-card font-medium whitespace-nowrap">{s.name}</TableCell>
                        {members.map((m) => (
                          <TableCell key={m.id} className="text-center">
                            <Cell entry={cellOf(m, s.id)} canVerify={project.canManage} onVerify={(level) => verify.mutate({ userId: m.id, skillId: s.id, level })} who={m.shortName ?? m.fullName} />
                          </TableCell>
                        ))}
                        <TableCell className="text-center">
                          <Badge variant={n === 0 ? "outline" : n === 1 ? "warning" : "success"} className="tabular-nums text-[11px]">
                            {n}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      {claimedOnly.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {claimedOnly.length} kỹ năng mới chỉ có tự khai, chưa ai có việc làm chứng: {claimedOnly.map((s) => s.name).join(", ")}.
        </p>
      )}
    </div>
  );
}

function Cell({ entry: e, canVerify, onVerify, who }: { entry?: SkillEvidenceView; canVerify: boolean; onVerify: (level: number) => void; who: string }) {
  if (!e) return <span className="text-muted-foreground/40">—</span>;
  if (e.confidence !== "none")
    return (
      <div className="inline-flex flex-col items-center gap-0.5" title={`${levelText(e)} · ${e.evidence}`}>
        {e.level > 0 ? <SkillLevel level={e.level} /> : null}
        <span className="text-[11px] text-foreground tabular-nums">
          {e.level > 0 ? e.level : e.failed ? "chưa đạt" : "chưa đủ"}
          {e.verified && <BadgeCheck className="ml-0.5 inline h-3 w-3 text-success" aria-label="PM đã xác nhận" />}
        </span>
        <span className="text-[10px] text-muted-foreground">{e.tasks ? `${e.tasks} việc` : "xác nhận"}</span>
      </div>
    );
  const claim = <span className="text-[11px] text-muted-foreground">tự khai {e.declared}</span>;
  if (!canVerify || !e.declared) return claim;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-auto border border-dashed border-border/80 px-2 py-1 font-normal">
          {claim}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2 text-xs" align="center">
        <p>
          {who} tự khai <strong>{e.name}</strong> mức {e.declared}, chưa có việc nào đã xong làm chứng.
        </p>
        <p className="text-muted-foreground">Xác nhận nếu bạn đã thấy người này làm được ở mức đó — tính là một bằng chứng. Chưa chắc thì giao một việc nhỏ có gắn kỹ năng này.</p>
        <Button size="sm" className="h-7 w-full text-xs" onClick={() => onVerify(e.declared!)}>
          Xác nhận mức {e.declared}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
