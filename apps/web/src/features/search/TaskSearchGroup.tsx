"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { CommandGroup, CommandItem } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

/** Hình trả về của `GET /workspaces/:wsId/tasks/search` (TasksService.search). */
interface TaskSearchHit {
  id: string;
  number: number;
  title: string;
  key: string;
  completedAt: string | null;
  project: { id: string; key: string; name: string };
}

/**
 * Nhóm kết quả công việc trong bảng lệnh (Ctrl/Super + K).
 *
 * Dùng `GET /workspaces/:wsId/tasks/search?q=&limit=` — endpoint xuyên dự án đã có từ Phase 3
 * nhưng trước đây web chưa gọi tới, nên bảng lệnh chỉ điều hướng được chứ không tìm ra việc nào.
 * Tìm cả các dự án khác trong workspace, không chỉ dự án đang mở.
 */
export function TaskSearchGroup({
  workspaceId,
  currentProjectId,
  query,
  onPick,
}: {
  workspaceId: string | undefined;
  currentProjectId?: string | null;
  query: string;
  onPick?: () => void;
}) {
  const router = useRouter();
  const [debounced, setDebounced] = React.useState(query);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const q = useQuery({
    queryKey: ["workspaces", workspaceId, "tasks", "search", debounced] as const,
    queryFn: () => api.get<TaskSearchHit[]>(`/workspaces/${workspaceId}/tasks/search`, { q: debounced, limit: 8 }),
    enabled: !!workspaceId && debounced.length >= 2,
    staleTime: 30_000,
  });

  if (!workspaceId || debounced.length < 2) return null;

  const items = q.data ?? [];
  return (
    <CommandGroup heading={q.isFetching ? "Công việc · đang tìm…" : `Công việc (${items.length})`}>
      {q.isPending && (
        <CommandItem disabled>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tìm
        </CommandItem>
      )}
      {!q.isPending && items.length === 0 && (
        <CommandItem disabled className="text-xs text-muted-foreground">
          Không có công việc nào khớp “{debounced}”
        </CommandItem>
      )}
      {items.map((t) => (
        <CommandItem
          key={t.id}
          value={`${t.key} ${t.title} ${t.project.name}`}
          className="cursor-pointer gap-2"
          onSelect={() => {
            onPick?.();
            router.push(`/projects/${t.project.id}/work?task=${t.id}`);
          }}
        >
          <span className="font-mono text-xs text-muted-foreground">{t.key}</span>
          <span className={t.completedAt ? "truncate line-through text-muted-foreground" : "truncate"}>{t.title}</span>
          {t.project.id !== currentProjectId && (
            <Badge variant="outline" className="ml-auto text-[9px] px-1 py-0 font-normal">
              {t.project.name}
            </Badge>
          )}
        </CommandItem>
      ))}
    </CommandGroup>
  );
}
