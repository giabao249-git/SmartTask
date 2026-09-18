"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, BadgeCheck, ShieldAlert, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { SkillLevel } from "@/components/app/SkillLevel";
import { UserAvatar } from "@/components/app/UserAvatar";
import { api, describeError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useSkillMatrix } from "@/lib/hooks/analytics";
import { useSkills } from "@/lib/hooks/queries";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface MySkill {
  id: string;
  name: string;
  category: string;
  level: number;
  verifiedAt: string | null;
}

/** Ma trận kỹ năng (UC-22/23): heatmap thành viên × kỹ năng, bus factor, tự khai mức, PM xác nhận. */
export function SkillsMatrixView() {
  const project = useCurrentProject();
  const auth = useAuth();
  const qc = useQueryClient();
  const wsId = project.workspaceId;
  const [minLevel, setMinLevel] = React.useState(3);
  const matrix = useSkillMatrix(wsId, project.id, minLevel);
  const skills = useSkills(wsId);
  const mine = useQuery({ queryKey: ["workspaces", wsId, "me", "skills"], queryFn: () => api.get<MySkill[]>(`/workspaces/${wsId}/me/skills`) });
  const [draft, setDraft] = React.useState<Record<string, number> | null>(null);
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["workspaces", wsId, "skill-matrix"] });
    void qc.invalidateQueries({ queryKey: ["workspaces", wsId, "me", "skills"] });
  };
  const saveMine = useMutation({
    mutationFn: (levels: Record<string, number>) => api.put<MySkill[]>(`/workspaces/${wsId}/me/skills`, { skills: Object.entries(levels).filter(([, l]) => l > 0).map(([skillId, level]) => ({ skillId, level })) }),
    onSuccess: () => {
      invalidate();
      setDraft(null);
      toast.success("Đã lưu kỹ năng của bạn (mức đổi sẽ cần PM xác nhận lại)");
    },
    onError: (e) => toast.error(describeError(e).message),
  });
  const verify = useMutation({
    mutationFn: (v: { userId: string; skillId: string; level: number }) => api.patch(`/users/${v.userId}/skills/${v.skillId}/verify`, { level: v.level }),
    onSuccess: () => {
      invalidate();
      toast.success("Đã xác nhận mức kỹ năng");
    },
    onError: (e) => toast.error(describeError(e).message, { description: describeError(e).code }),
  });

  const memberIds = new Set(project.members.map((m) => m.id));
  const levels = React.useMemo(() => {
    const cur: Record<string, number> = {};
    for (const s of mine.data ?? []) cur[s.id] = s.level;
    return draft ?? cur;
  }, [mine.data, draft]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Ma trận kỹ năng · ${project.key}`}
        description="Mức 1–5 tự khai, PM xác nhận (✓). Bus factor: kỹ năng chỉ ≤ 1 người đạt mức tối thiểu."
        breadcrumbs={[{ label: "Workspace", href: "/workspaces" }, { label: project.name, href: `/projects/${project.id}/dashboard` }, { label: "Ma trận kỹ năng" }]}
      >
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Mức tối thiểu</span>
          <Select value={String(minLevel)} onValueChange={(v) => setMinLevel(Number(v))}>
            <SelectTrigger className="h-8 w-16 text-xs">
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
      </PageHeader>

      <Tabs defaultValue="matrix">
        <TabsList className="h-8">
          <TabsTrigger value="matrix" className="text-xs gap-1">
            <Award className="h-3.5 w-3.5" /> Heatmap
          </TabsTrigger>
          <TabsTrigger value="mine" className="text-xs gap-1">
            <BadgeCheck className="h-3.5 w-3.5" /> Kỹ năng của tôi
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matrix" className="pt-3 space-y-4">
          {matrix.isPending ? (
            <Skeleton className="h-72 w-full" />
          ) : matrix.isError ? (
            <ErrorState code={describeError(matrix.error).code} message={describeError(matrix.error).message} onRetry={() => matrix.refetch()} />
          ) : (
            <>
              {matrix.data.busFactor.length > 0 && (
                <Card className="border-warning/40 bg-warning/5">
                  <CardContent className="p-3 flex items-start gap-2 text-xs">
                    <ShieldAlert className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Bus factor thấp ({matrix.data.busFactor.length} kỹ năng ≤ 1 người đạt mức {matrix.data.minLevel}): </span>
                      {matrix.data.busFactor.slice(0, 10).map((b) => `${b.name} (${b.holders})`).join(", ")}{matrix.data.busFactor.length > 10 ? ` … +${matrix.data.busFactor.length - 10} kỹ năng khác` : ""}
                    </div>
                  </CardContent>
                </Card>
              )}
              <Card className="border-border/80">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm">Thành viên dự án × kỹ năng đã khai</CardTitle>
                  <CardDescription className="text-xs">Chỉ hiện kỹ năng có ít nhất một người khai. {project.canManage ? "PM bấm ô để xác nhận mức." : ""}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 overflow-x-auto">
                  <MatrixTable data={matrix.data} memberIds={memberIds} canVerify={project.canManage} onVerify={(userId, skillId, level) => verify.mutate({ userId, skillId, level })} />
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="mine" className="pt-3">
          {skills.isPending || mine.isPending ? (
            <Skeleton className="h-64 w-full" />
          ) : skills.isError || mine.isError ? (
            <ErrorState code={describeError(skills.error ?? mine.error).code} message={describeError(skills.error ?? mine.error).message} onRetry={() => void Promise.all([skills.refetch(), mine.refetch()])} />
          ) : (
            <Card className="border-border/80">
              <CardHeader className="p-4 pb-2 flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-sm">Tự khai mức kỹ năng — {auth.user?.fullName}</CardTitle>
                  <CardDescription className="text-xs">0 = không có. Đổi mức làm mất xác nhận của PM.</CardDescription>
                </div>
                <Button size="sm" className="h-8 text-xs gap-1.5" disabled={!draft || saveMine.isPending} onClick={() => draft && saveMine.mutate(draft)}>
                  <Save className="h-3.5 w-3.5" /> Lưu
                </Button>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {skills.data.length === 0 ? (
                  <EmptyState title="Workspace chưa có kỹ năng" description="Quản trị viên thêm kỹ năng ở cài đặt workspace." />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                    {skills.data.map((s) => {
                      const cur = levels[s.id] ?? 0;
                      const verified = mine.data.find((m) => m.id === s.id)?.verifiedAt;
                      return (
                        <div key={s.id} className="flex items-center gap-2 p-2 rounded-md border border-border/60 bg-muted/20 text-xs">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate flex items-center gap-1">
                              {s.name}
                              {verified && !draft && <BadgeCheck className="h-3 w-3 text-success" />}
                            </div>
                            <div className="text-[10px] text-muted-foreground">{s.category}</div>
                          </div>
                          <div className="flex items-center gap-0.5">
                            {[0, 1, 2, 3, 4, 5].map((l) => (
                              <Button
                                key={l}
                                variant={cur === l ? "default" : "ghost"}
                                size="sm"
                                className="h-6 w-6 p-0 text-[11px] font-mono"
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
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MatrixTable({ data, memberIds, canVerify, onVerify }: { data: NonNullable<ReturnType<typeof useSkillMatrix>["data"]>; memberIds: Set<string>; canVerify: boolean; onVerify: (userId: string, skillId: string, level: number) => void }) {
  const users = data.users.filter((u) => memberIds.has(u.id));
  const usedSkillIds = new Set(data.cells.filter((c) => memberIds.has(c.userId)).map((c) => c.skillId));
  const skills = data.skills.filter((s) => usedSkillIds.has(s.id));
  const cell = (userId: string, skillId: string) => data.cells.find((c) => c.userId === userId && c.skillId === skillId);
  if (skills.length === 0) return <EmptyState icon={Award} title="Chưa ai khai kỹ năng" description="Mỗi thành viên tự khai ở tab 'Kỹ năng của tôi'." className="py-8" />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs sticky left-0 bg-card">Kỹ năng</TableHead>
          {users.map((u) => (
            <TableHead key={u.id} className="text-xs text-center">
              <div className="flex flex-col items-center gap-1">
                <UserAvatar name={u.fullName} avatar={u.avatarUrl ?? undefined} size="sm" />
                <span>{u.shortName ?? u.fullName}</span>
              </div>
            </TableHead>
          ))}
          <TableHead className="text-xs text-center">Đạt ≥{data.minLevel}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {skills.map((s) => {
          const holders = users.filter((u) => (cell(u.id, s.id)?.level ?? 0) >= data.minLevel).length;
          return (
            <TableRow key={s.id} className="text-xs">
              <TableCell className="sticky left-0 bg-card font-medium">
                {s.name}
                <span className="block text-[10px] text-muted-foreground">{s.category}</span>
              </TableCell>
              {users.map((u) => {
                const c = cell(u.id, s.id);
                return (
                  <TableCell key={u.id} className="text-center">
                    {c ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!canVerify || c.verified}
                            onClick={() => onVerify(u.id, s.id, c.level)}
                            className={cn("h-auto py-1 px-2 flex-col gap-0.5", c.verified && "opacity-100")}
                          >
                            <SkillLevel level={c.level} />
                            <span className="text-[10px] font-mono">
                              {c.level}
                              {c.verified ? " ✓" : ""}
                            </span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">{c.verified ? "PM đã xác nhận" : canVerify ? "Bấm để xác nhận mức này" : "Tự khai, chưa xác nhận"}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </TableCell>
                );
              })}
              <TableCell className="text-center">
                <Badge variant={holders <= 1 ? "warning" : "success"} className="text-[10px] font-mono">
                  {holders}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
