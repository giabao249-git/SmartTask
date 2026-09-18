"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { CommandGroup, CommandItem } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { priorityToVariant } from "@/lib/status";
import type { TaskListResponse } from "@/lib/types";

/**
 * Nhóm kết quả task cho ⌘K: GET /projects/:id/tasks?q= (backend chưa có endpoint tìm kiếm toàn cục — docs web-tich-hop §4).
 * Nhúng vào CommandDialog của AppShell: `<TaskSearchGroup projectId={…} projectKey={…} query={q} onPick={() => setOpen(false)} />`.
 */
export function TaskSearchGroup({ projectId, projectKey, query, onPick }: { projectId: string | null; projectKey: string; query: string; onPick?: () => void }) {
  const router = useRouter();
  const [debounced, setDebounced] = React.useState(query);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);
  const q = useQuery({
    queryKey: ["projects", projectId, "tasks", "search", debounced],
    queryFn: () => api.get<TaskListResponse>(`/projects/${projectId}/tasks`, { q: debounced }),
    enabled: !!projectId && debounced.length >= 2,
    select: (r) => r.items.slice(0, 8),
  });
  if (!projectId || debounced.length < 2) return null;
  return (
    <CommandGroup heading={q.isFetching ? "Công việc · đang tìm…" : `Công việc (${q.data?.length ?? 0})`}>
      {q.isPending && (
        <CommandItem disabled>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tìm
        </CommandItem>
      )}
      {(q.data ?? []).map((t) => (
        <CommandItem
          key={t.id}
          value={`${projectKey}-${t.number} ${t.title}`}
          className="cursor-pointer gap-2"
          onSelect={() => {
            onPick?.();
            router.push(`/projects/${projectId}/board?task=${t.id}`);
          }}
        >
          <span className="font-mono text-xs text-muted-foreground">
            {projectKey}-{t.number}
          </span>
          <span className="truncate">{t.title}</span>
          <Badge variant={priorityToVariant(t.priority)} className="ml-auto text-[9px] px-1 py-0">
            {t.priority}
          </Badge>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}
