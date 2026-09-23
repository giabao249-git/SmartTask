"use client";

import * as React from "react";
import { CalendarRange, Flag, Tag, Trash2, UserPlus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PriorityBadge } from "@/components/app/PriorityBadge";
import { api, describeError } from "@/lib/api";
import { useTaskMutations } from "@/features/board/hooks";
import { useSprints } from "@/lib/hooks/queries";
import type { ProjectDetail, TaskListItem, TaskPriority } from "@/lib/types";
import { toast } from "sonner";
import { MAX_BULK, useWorkSelection } from "./selection";

/** Một thao tác hàng loạt đã chọn xong tham số, chờ người dùng xác nhận. */
interface PendingOp {
  label: string;
  detail: string;
  run: (task: TaskListItem) => Promise<unknown>;
  /** Chạy một lần cho cả lô thay vì từng task (đổi sprint có endpoint riêng). */
  batch?: (ids: string[]) => Promise<unknown>;
  destructive?: boolean;
}

/**
 * Thanh thao tác hàng loạt (docs 02/05 §B1).
 *
 * Ghi ra sao: `PATCH /tasks/:id` yêu cầu `version` của TỪNG task, nên client gửi TUẦN TỰ n lời
 * gọi, mỗi cái mang version riêng đang giữ trong cache. Task nào trả 409 thì KHÔNG dừng cả lô —
 * gom lại, cuối cùng báo "n−k đã đổi · k vừa được người khác sửa". Đây là cách giữ nguyên khoá
 * lạc quan mà không cần endpoint hàng loạt. Giới hạn 50/lần và không chạy song song để khỏi
 * đụng hạn mức 100 req/phút.
 */
export function BulkActionBar({ project, tasks }: { project: ProjectDetail; tasks: TaskListItem[] }) {
  const sel = useWorkSelection();
  const mut = useTaskMutations(project.id);
  const sprints = useSprints(project.id);
  const [pending, setPending] = React.useState<PendingOp | null>(null);
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);

  const chosen = React.useMemo(
    () => sel.selected.map((id) => tasks.find((t) => t.id === id)).filter((t): t is TaskListItem => !!t),
    [sel.selected, tasks],
  );

  if (!sel.active || !project.canEdit) return null;

  const execute = async (op: PendingOp) => {
    setPending(null);
    if (op.batch) {
      try {
        await op.batch(chosen.map((t) => t.id));
        toast.success(`${op.label} — ${chosen.length} công việc`);
      } catch (e) {
        toast.error(`${op.label} thất bại`, { description: describeError(e).code });
      }
      sel.clear();
      return;
    }

    setProgress({ done: 0, total: chosen.length });
    const conflicts: string[] = [];
    const failures: string[] = [];
    for (let i = 0; i < chosen.length; i += 1) {
      const t = chosen[i];
      const key = t.key ?? `${project.key}-${t.number}`;
      try {
        await op.run(t);
      } catch (e) {
        const { code } = describeError(e);
        if (code === "TASK_VERSION_CONFLICT") conflicts.push(key);
        else failures.push(`${key} (${code})`);
      }
      setProgress({ done: i + 1, total: chosen.length });
    }
    setProgress(null);

    const ok = chosen.length - conflicts.length - failures.length;
    if (conflicts.length === 0 && failures.length === 0) {
      toast.success(`${op.label} — ${ok} công việc`);
    } else {
      toast.warning(`${op.label}: ${ok}/${chosen.length} công việc`, {
        description: [
          conflicts.length ? `${conflicts.length} vừa được người khác sửa: ${conflicts.slice(0, 5).join(", ")}` : "",
          failures.length ? `${failures.length} lỗi khác: ${failures.slice(0, 3).join(", ")}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
        duration: 10_000,
      });
    }
    sel.clear();
  };

  const ask = (op: PendingOp) => setPending(op);
  const n = chosen.length;

  return (
    <>
      <Card className="sticky bottom-4 z-30 mt-4 flex flex-wrap items-center gap-2 p-2.5 shadow-lg">
        <Badge variant="secondary" className="font-mono text-xs">
          Đã chọn {n}
          {n >= MAX_BULK ? ` (tối đa ${MAX_BULK})` : ""}
        </Badge>

        {progress ? (
          <div className="flex flex-1 items-center gap-2 min-w-40">
            <Progress value={(progress.done / progress.total) * 100} className="h-1.5 flex-1" />
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {progress.done}/{progress.total}
            </span>
          </div>
        ) : (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                  <UserPlus className="h-3.5 w-3.5" /> Giao cho
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="text-xs">
                {project.members.map((m) => (
                  <DropdownMenuItem
                    key={m.id}
                    onClick={() =>
                      ask({
                        label: "Đã giao việc",
                        detail: `Người thực hiện → ${m.fullName}`,
                        run: (t) => mut.assignees.mutateAsync({ id: t.id, version: t.version, userIds: [m.id] }),
                      })
                    }
                  >
                    {m.fullName}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    ask({
                      label: "Đã bỏ giao",
                      detail: "Người thực hiện → chưa giao",
                      run: (t) => mut.assignees.mutateAsync({ id: t.id, version: t.version, userIds: [] }),
                    })
                  }
                >
                  Bỏ giao
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                  Chuyển cột
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="text-xs">
                {project.columns.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    onClick={() =>
                      ask({
                        label: "Đã chuyển cột",
                        detail: `Cột → ${c.name}`,
                        run: (t) => mut.move.mutateAsync({ id: t.id, version: t.version, columnId: c.id }),
                      })
                    }
                  >
                    {c.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                  <Flag className="h-3.5 w-3.5" /> Ưu tiên
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="text-xs">
                {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((p) => (
                  <DropdownMenuItem
                    key={p}
                    onClick={() =>
                      ask({
                        label: "Đã đổi ưu tiên",
                        detail: `Ưu tiên → ${p}`,
                        run: (t) => mut.update.mutateAsync({ id: t.id, version: t.version, patch: { priority: p as TaskPriority } }),
                      })
                    }
                  >
                    <PriorityBadge priority={p} showIcon={false} />
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                  <CalendarRange className="h-3.5 w-3.5" /> Sprint
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="text-xs">
                <DropdownMenuLabel className="text-[10px] font-normal text-muted-foreground">
                  Đưa vào sprint
                </DropdownMenuLabel>
                {(sprints.data ?? [])
                  .filter((s) => s.status !== "CLOSED")
                  .map((s) => (
                    <DropdownMenuItem
                      key={s.id}
                      onClick={() =>
                        ask({
                          label: "Đã đưa vào sprint",
                          detail: `Sprint → ${s.name}`,
                          // Endpoint riêng cho cả lô: 1 request thay vì n (docs 11 §3.5)
                          batch: (ids) => api.post(`/sprints/${s.id}/tasks`, { taskIds: ids }),
                          run: (t) => mut.update.mutateAsync({ id: t.id, version: t.version, patch: { sprintId: s.id } }),
                        })
                      }
                    >
                      {s.name} · {s.status}
                    </DropdownMenuItem>
                  ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    ask({
                      label: "Đã đưa về backlog",
                      detail: "Sprint → Backlog",
                      run: (t) => mut.update.mutateAsync({ id: t.id, version: t.version, patch: { sprintId: null } }),
                    })
                  }
                >
                  Đưa về backlog
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" disabled={project.labels.length === 0}>
                  <Tag className="h-3.5 w-3.5" /> Nhãn
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="text-xs">
                <DropdownMenuLabel className="text-[10px] font-normal text-muted-foreground">
                  Thêm nhãn (giữ nhãn cũ)
                </DropdownMenuLabel>
                {project.labels.map((l) => (
                  <DropdownMenuItem
                    key={l.id}
                    onClick={() =>
                      ask({
                        label: "Đã gắn nhãn",
                        detail: `Thêm nhãn #${l.name}`,
                        run: (t) =>
                          mut.labels.mutateAsync({
                            id: t.id,
                            version: t.version,
                            // PUT thay toàn bộ, nên phải gộp với nhãn sẵn có để không xoá mất
                            labelIds: Array.from(new Set([...t.labels.map((x) => x.id), l.id])),
                          }),
                      })
                    }
                  >
                    #{l.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive"
              onClick={() =>
                ask({
                  label: "Đã xoá",
                  detail: "Xoá công việc (kèm mọi việc con)",
                  destructive: true,
                  run: (t) => mut.remove.mutateAsync(t.id),
                })
              }
            >
              <Trash2 className="h-3.5 w-3.5" /> Xoá
            </Button>

            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs ml-auto" onClick={sel.clear}>
              <X className="h-3.5 w-3.5" /> Bỏ chọn
            </Button>
          </>
        )}
      </Card>

      {/* Xem trước trước khi ghi, theo cách Jira làm với bulk change */}
      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">
              {pending?.label.replace("Đã ", "")} cho {n} công việc?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-2">
              <span className="block">{pending?.detail}</span>
              <span className="block text-muted-foreground">
                {chosen
                  .slice(0, 8)
                  .map((t) => t.key ?? `${project.key}-${t.number}`)
                  .join(", ")}
                {n > 8 ? ` … và ${n - 8} việc nữa` : ""}
              </span>
              {!pending?.batch && (
                <span className="block text-muted-foreground">
                  Ghi lần lượt từng việc, mỗi việc mang version riêng. Việc nào vừa được người khác sửa sẽ được
                  báo lại chứ không bị ghi đè.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className={pending?.destructive ? "text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90" : "text-xs"}
              onClick={() => pending && void execute(pending)}
            >
              Thực hiện
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
