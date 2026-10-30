"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Columns3, Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import type { BoardColumn, ProjectDetail } from "@/lib/types";
import { toast } from "sonner";
import { toastApiError, useInvalidateProject } from "./shared";

type Row = { id?: string; name: string; statusKey: string; wipLimit: string; isDone: boolean };
const toRows = (cols: BoardColumn[]): Row[] => [...cols].sort((a, b) => a.position - b.position).map((c) => ({ id: c.id, name: c.name, statusKey: c.statusKey, wipLimit: c.wipLimit ? String(c.wipLimit) : "", isDone: c.isDone }));

/** Cột Kanban (UC-12): PUT /projects/:id/columns thay toàn bộ — thứ tự mảng, WIP, đúng một cột hoàn thành; cột bỏ phải trống task. */
export function ColumnsTab({ project }: { project: ProjectDetail }) {
  const invalidate = useInvalidateProject(project.id);
  const [rows, setRows] = React.useState<Row[]>(() => toRows(project.columns));
  React.useEffect(() => setRows(toRows(project.columns)), [project.columns]);
  const can = project.canManage && project.status === "ACTIVE";
  const doneCount = rows.filter((r) => r.isDone).length;

  const save = useMutation({
    mutationFn: () => api.put<BoardColumn[]>(`/projects/${project.id}/columns`, { columns: rows.map((r) => ({ id: r.id, name: r.name.trim(), statusKey: r.statusKey.trim().toUpperCase(), wipLimit: r.wipLimit ? Number(r.wipLimit) : null, isDone: r.isDone })) }),
    onSuccess: () => {
      invalidate();
      toast.success("Đã lưu cột Kanban");
    },
    onError: toastApiError,
  });
  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: -1 | 1) =>
    setRows((rs) => {
      const j = i + d;
      if (j < 0 || j >= rs.length) return rs;
      const copy = [...rs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  return (
    <Card className="border-border/80">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Columns3 className="h-4 w-4" /> Cột Kanban ({rows.length})
        </CardTitle>
        <CardDescription className="text-xs">2–12 cột. Mã trạng thái viết hoa (VD IN_PROGRESS) — Trợ lý AI và báo cáo dùng mã này. Kéo vào cột hoàn thành = xong việc.</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3 overflow-x-auto">
        {doneCount !== 1 && (
          <Alert variant="destructive" className="py-2">
            <AlertTitle className="text-xs">Phải có đúng một cột hoàn thành</AlertTitle>
            <AlertDescription className="text-xs">Hiện có {doneCount}.</AlertDescription>
          </Alert>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs w-20">Thứ tự</TableHead>
              <TableHead className="text-xs">Tên</TableHead>
              <TableHead className="text-xs">Mã trạng thái</TableHead>
              <TableHead className="text-xs w-24">WIP</TableHead>
              <TableHead className="text-xs w-24 text-center">Hoàn thành</TableHead>
              <TableHead className="text-xs w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={r.id ?? `new-${i}`} className="text-xs">
                <TableCell>
                  <div className="flex gap-0.5">
                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={!can || i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={!can || i === rows.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  <Input value={r.name} onChange={(e) => update(i, { name: e.target.value })} className="h-7 text-xs" maxLength={40} disabled={!can} />
                </TableCell>
                <TableCell>
                  <Input value={r.statusKey} onChange={(e) => update(i, { statusKey: e.target.value.toUpperCase() })} className="h-7 text-xs font-mono" maxLength={30} disabled={!can} pattern="[A-Z][A-Z0-9_]{1,29}" />
                </TableCell>
                <TableCell>
                  <Input type="number" min={1} max={999} value={r.wipLimit} onChange={(e) => update(i, { wipLimit: e.target.value })} className="h-7 text-xs" placeholder="—" disabled={!can} />
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox checked={r.isDone} disabled={!can} onCheckedChange={(c) => setRows((rs) => rs.map((x, j) => ({ ...x, isDone: j === i ? c === true : c === true ? false : x.isDone })))} />
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" disabled={!can || rows.length <= 2} title="Bỏ cột (phải trống task)" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={!can || rows.length >= 12} onClick={() => setRows((rs) => [...rs, { name: "", statusKey: "", wipLimit: "", isDone: false }])}>
          <Plus className="h-3 w-3" /> Thêm cột
        </Button>
      </CardContent>
      <CardFooter className="p-4 pt-0 justify-between">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5 border-border hover:bg-muted text-foreground font-medium shadow-2xs"
          disabled={!can}
          onClick={() => setRows(toRows(project.columns))}
        >
          <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
          Hoàn nguyên thay đổi
        </Button>
        <Button size="sm" className="h-8 text-xs gap-1.5" disabled={!can || save.isPending || doneCount !== 1 || rows.some((r) => !r.name.trim() || !r.statusKey.trim())} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Lưu cột
        </Button>
      </CardFooter>
    </Card>
  );
}
