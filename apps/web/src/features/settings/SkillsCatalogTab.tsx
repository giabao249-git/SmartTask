"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Merge, Pencil, Plus, Search, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { api, describeError } from "@/lib/api";
import { qk } from "@/lib/hooks/queries";
import type { SkillView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/** Bỏ dấu để tìm "ky nang" ra "Kỹ năng". */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();

/**
 * Danh mục kỹ năng của workspace (UC-06) — thêm, sửa tên/nhóm/alias, ẩn, gộp.
 *
 * Ba endpoint `POST /workspaces/:wsId/skills`, `PATCH /skills/:id`, `POST /skills/:id/merge` có
 * từ Phase 2 nhưng chưa màn nào trên web gọi, nên trước đây workspace bị khoá cứng ở 30 kỹ năng
 * seed sẵn: không thêm được kỹ năng mới thì ô "Kỹ năng yêu cầu" khi tạo/sửa công việc và cả
 * heatmap năng lực đều không phản ánh được đội hình thật.
 *
 * Kỹ năng là danh mục dùng chung cho cả workspace nên chỉ OWNER/ADMIN sửa được; thành viên khác
 * vẫn xem được danh mục (và tự khai mức của mình ở màn Nhân sự › Kỹ năng).
 */
export function SkillsCatalogTab({ workspaceId, canEdit }: { workspaceId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const [q, setQ] = React.useState("");
  const [showHidden, setShowHidden] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [merging, setMerging] = React.useState<SkillView | null>(null);
  const [mergeInto, setMergeInto] = React.useState<string>("");

  const skills = useQuery({
    queryKey: ["workspaces", workspaceId, "skills", "all"] as const,
    queryFn: () => api.get<SkillView[]>(`/workspaces/${workspaceId}/skills`, { includeInactive: "true" }),
    enabled: !!workspaceId,
  });

  /** Danh mục đổi thì ô chọn kỹ năng ở task và heatmap phải thấy ngay. */
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["workspaces", workspaceId, "skills", "all"] });
    void qc.invalidateQueries({ queryKey: qk.skills(workspaceId) });
    void qc.invalidateQueries({ queryKey: ["workspaces", workspaceId, "skill-matrix"] });
  };
  const fail = (e: unknown, what: string) => {
    const { code, message } = describeError(e);
    toast.error(`${what} thất bại`, { description: `${code}: ${message}` });
  };

  const create = useMutation({
    mutationFn: (body: { name: string; category?: string; aliases?: string[] }) =>
      api.post<SkillView>(`/workspaces/${workspaceId}/skills`, body),
    onSuccess: (s) => {
      invalidate();
      toast.success(`Đã thêm kỹ năng "${s.name}"`);
    },
    onError: (e) => fail(e, "Thêm kỹ năng"),
  });
  const update = useMutation({
    mutationFn: (v: { id: string; patch: { name?: string; category?: string; isActive?: boolean; aliases?: string[] } }) =>
      api.patch<SkillView>(`/skills/${v.id}`, v.patch),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
    onError: (e) => fail(e, "Sửa kỹ năng"),
  });
  const merge = useMutation({
    mutationFn: (v: { id: string; intoSkillId: string }) => api.post<SkillView>(`/skills/${v.id}/merge`, { intoSkillId: v.intoSkillId }),
    onSuccess: (s) => {
      invalidate();
      setMerging(null);
      setMergeInto("");
      toast.success(`Đã gộp vào "${s.name}" — mọi khai báo và yêu cầu kỹ năng đã chuyển sang`);
    },
    onError: (e) => fail(e, "Gộp kỹ năng"),
  });

  const all = React.useMemo(() => skills.data ?? [], [skills.data]);
  const categories = React.useMemo(
    () => Array.from(new Set(all.map((s) => s.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, "vi")),
    [all],
  );
  const shown = React.useMemo(() => {
    const needle = fold(q.trim());
    return all
      .filter((s) => showHidden || s.isActive)
      .filter((s) => !needle || fold(s.name).includes(needle) || s.aliases.some((a) => fold(a).includes(needle)));
  }, [all, q, showHidden]);
  const grouped = React.useMemo(() => {
    const m = new Map<string, SkillView[]>();
    for (const s of shown) {
      const k = s.category || "Khác";
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "vi"));
  }, [shown]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Danh mục kỹ năng</CardTitle>
        <CardDescription className="text-xs">
          Dùng chung cho cả workspace: ô &quot;Kỹ năng yêu cầu&quot; khi tạo/sửa công việc, heatmap năng lực và bảng
          năng lực khi giao việc đều lấy từ đây. Ẩn một kỹ năng thì nó không còn hiện ở ô chọn nhưng dữ liệu cũ vẫn giữ.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canEdit ? (
          <CreateSkillForm categories={categories} pending={create.isPending} onCreate={(b) => create.mutate(b)} />
        ) : (
          <Alert>
            <AlertTitle className="text-xs font-semibold">Chế độ xem</AlertTitle>
            <AlertDescription className="text-xs">
              Chỉ OWNER / ADMIN của workspace mới thêm hoặc sửa được danh mục kỹ năng. Bạn vẫn tự khai mức kỹ năng của
              mình ở màn Nhân sự › Kỹ năng.
            </AlertDescription>
          </Alert>
        )}

        <Separator />

        <div className="flex items-center gap-2 flex-wrap text-xs">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm kỹ năng hoặc alias…" className="h-8 w-56 text-xs" />
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Checkbox checked={showHidden} onCheckedChange={(c) => setShowHidden(c === true)} />
            Hiện cả kỹ năng đã ẩn
          </label>
          <span className="ml-auto text-muted-foreground">
            {shown.length}/{all.length} kỹ năng
          </span>
        </div>

        {skills.isPending ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : skills.isError ? (
          <ErrorState code={describeError(skills.error).code} message={describeError(skills.error).message} onRetry={() => skills.refetch()} />
        ) : shown.length === 0 ? (
          <EmptyState
            title={q ? "Không có kỹ năng nào khớp" : "Danh mục kỹ năng trống"}
            description={q ? "Đổi từ khoá, hoặc bật “Hiện cả kỹ năng đã ẩn”." : "Thêm kỹ năng đầu tiên bằng ô bên trên."}
          />
        ) : (
          <div className="space-y-4">
            {grouped.map(([cat, list]) => (
              <div key={cat} className="space-y-1.5">
                <div className="text-[11px] font-semibold text-muted-foreground">
                  {cat} · {list.length}
                </div>
                {list.map((s) =>
                  editingId === s.id ? (
                    <EditSkillRow
                      key={s.id}
                      skill={s}
                      categories={categories}
                      pending={update.isPending}
                      onCancel={() => setEditingId(null)}
                      onSave={(patch) => update.mutate({ id: s.id, patch })}
                    />
                  ) : (
                    <div
                      key={s.id}
                      className={cn(
                        "flex items-center gap-2 rounded-md border border-border/60 px-2 py-1.5 text-xs",
                        !s.isActive && "opacity-60 bg-muted/30",
                      )}
                    >
                      <span className="font-medium">{s.name}</span>
                      {!s.isActive && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          đã ẩn
                        </Badge>
                      )}
                      {s.aliases.map((a) => (
                        <Badge key={a} variant="secondary" className="text-[10px] px-1 py-0 font-normal">
                          {a}
                        </Badge>
                      ))}
                      {canEdit && (
                        <div className="ml-auto flex items-center gap-0.5">
                          <Button variant="ghost" size="icon" className="h-6 w-6" aria-label={`Sửa ${s.name}`} onClick={() => setEditingId(s.id)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            aria-label={s.isActive ? `Ẩn ${s.name}` : `Hiện lại ${s.name}`}
                            title={s.isActive ? "Ẩn khỏi ô chọn (dữ liệu cũ vẫn giữ)" : "Hiện lại"}
                            onClick={() => update.mutate({ id: s.id, patch: { isActive: !s.isActive } })}
                          >
                            {s.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            aria-label={`Gộp ${s.name} vào kỹ năng khác`}
                            title="Gộp vào kỹ năng khác"
                            onClick={() => {
                              setMerging(s);
                              setMergeInto("");
                            }}
                          >
                            <Merge className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ),
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Gộp là hành động không hoàn tác được → AlertDialog theo docs 10 §4 */}
      <AlertDialog open={!!merging} onOpenChange={(o) => !o && setMerging(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Gộp &quot;{merging?.name}&quot; vào kỹ năng khác</AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-2">
              <span className="block">
                Mọi khai báo của thành viên và mọi yêu cầu kỹ năng trên công việc sẽ chuyển sang kỹ năng đích;
                &quot;{merging?.name}&quot; bị xoá và tên của nó trở thành alias của đích. <strong>Không hoàn tác được.</strong>
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1">
            <Select value={mergeInto} onValueChange={setMergeInto}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Chọn kỹ năng đích…" />
              </SelectTrigger>
              <SelectContent>
                {all
                  .filter((s) => s.id !== merging?.id && s.isActive)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      {s.name}
                      {s.category ? ` · ${s.category}` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="text-xs"
              disabled={!mergeInto || merge.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (merging && mergeInto) merge.mutate({ id: merging.id, intoSkillId: mergeInto });
              }}
            >
              Gộp
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function CreateSkillForm({
  categories,
  pending,
  onCreate,
}: {
  categories: string[];
  pending: boolean;
  onCreate: (b: { name: string; category?: string; aliases?: string[] }) => void;
}) {
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [aliases, setAliases] = React.useState("");
  const ref = React.useRef<HTMLInputElement>(null);

  return (
    <form
      className="flex items-end gap-2 flex-wrap"
      onSubmit={(e) => {
        e.preventDefault();
        const n = name.trim();
        if (!n) return;
        onCreate({
          name: n,
          category: category.trim() || undefined,
          // Alias giúp Trợ lý AI nhận ra "ReactJS" là "React" (docs 11 §3.3)
          aliases: aliases
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean)
            .slice(0, 20),
        });
        setName("");
        setAliases("");
        ref.current?.focus();
      }}
    >
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-muted-foreground">Tên kỹ năng</label>
        <Input ref={ref} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: GraphQL" maxLength={60} className="h-8 w-48 text-xs" required />
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-muted-foreground">Nhóm</label>
        <Input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Backend, Frontend…"
          maxLength={40}
          list="st-skill-categories"
          className="h-8 w-40 text-xs"
        />
        <datalist id="st-skill-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-muted-foreground">Alias (cách nhau dấu phẩy)</label>
        <Input value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="GQL, graph-ql" className="h-8 w-48 text-xs" />
      </div>
      <Button type="submit" size="sm" className="h-8 gap-1.5 text-xs" disabled={pending || !name.trim()}>
        <Plus className="h-3.5 w-3.5" /> Thêm kỹ năng
      </Button>
    </form>
  );
}

function EditSkillRow({
  skill,
  categories,
  pending,
  onSave,
  onCancel,
}: {
  skill: SkillView;
  categories: string[];
  pending: boolean;
  onSave: (patch: { name?: string; category?: string; aliases?: string[] }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = React.useState(skill.name);
  const [category, setCategory] = React.useState(skill.category ?? "");
  const [aliases, setAliases] = React.useState(skill.aliases.join(", "));

  return (
    <form
      className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-2 py-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          name: name.trim() || undefined,
          category: category.trim(),
          aliases: aliases
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean)
            .slice(0, 20),
        });
      }}
    >
      <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="h-7 w-44 text-xs" required />
      <Input value={category} onChange={(e) => setCategory(e.target.value)} maxLength={40} list="st-skill-categories" placeholder="Nhóm" className="h-7 w-36 text-xs" />
      <Input value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="Alias, cách nhau dấu phẩy" className="h-7 flex-1 min-w-40 text-xs" />
      <datalist id="st-skill-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <Button type="submit" size="sm" className="h-7 text-xs" disabled={pending}>
        Lưu
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Huỷ sửa" onClick={onCancel}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </form>
  );
}
