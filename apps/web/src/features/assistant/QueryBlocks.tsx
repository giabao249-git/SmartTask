"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Clock, ExternalLink, Info, RefreshCw, User, CalendarDays, Flag, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/app/EmptyState";
import { api, describeError } from "@/lib/api";
import type { BadgeVariant } from "@/lib/status";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { BlockBadge, BlockItem, DataQuerySpec, QueryBlock, QueryResult, StatItem } from "@smarttask/shared";

const TONE: Record<NonNullable<BlockBadge["tone"]>, BadgeVariant> = {
  default: "secondary",
  muted: "outline",
  info: "info",
  success: "success",
  warning: "warning",
  danger: "destructive",
};
const ICON = { clock: Clock, user: User, calendar: CalendarDays, flag: Flag, link: Link2 } as const;

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}/${p(d.getMonth() + 1)}`;
};

/**
 * Vẽ kết quả tra cứu (docs 14). Dữ liệu do backend tính; ở đây chỉ hiển thị và cho bấm mở đối tượng.
 * Số trong lịch sử chat là số của lúc hỏi — nên luôn kèm giờ tạo và nút "Làm mới".
 */
export function QueryResultCard({
  result,
  query,
  projectId,
  sessionId,
}: {
  result: QueryResult;
  /** Truy vấn gốc để chạy lại — lưu cùng tin nhắn nên "Làm mới" không cần hỏi LLM. */
  query?: DataQuerySpec;
  projectId: string;
  sessionId?: string | null;
}) {
  const [data, setData] = React.useState(result);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => setData(result), [result]);

  const refresh = async () => {
    setBusy(true);
    try {
      // Chạy lại đúng truy vấn cũ — không gọi LLM, không tốn lượt AI
      const fresh = await api.post<QueryResult>("/ai/query", {
        projectId,
        sessionId: sessionId ?? undefined,
        query,
      });
      setData(fresh);
    } catch (e) {
      const { code, message } = describeError(e);
      toast.error(message, { description: code });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 pt-2 border-t border-border/40 space-y-2">
      {data.blocks.map((b, i) => (
        <BlockView key={i} block={b} projectId={projectId} />
      ))}

      <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground pt-0.5">
        <Info className="h-3 w-3" />
        <span>
          Số liệu lúc {fmtTime(data.generatedAt)} · {data.source.rowCount} bản ghi
          {data.truncated ? ` · hiện ${data.truncated.shown}/${data.truncated.total}` : ""}
        </span>
        {query && (
          <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] gap-1" disabled={busy} onClick={() => void refresh()}>
            <RefreshCw className={cn("h-3 w-3", busy && "animate-spin")} /> Làm mới
          </Button>
        )}
      </div>
    </div>
  );
}

function BlockView({ block, projectId }: { block: QueryBlock; projectId: string }) {
  const router = useRouter();
  const open = (item: BlockItem | { ref?: { type: string; id: string } }) => {
    const ref = item.ref;
    if (!ref) return;
    if (ref.type === "task") router.push(`/projects/${projectId}/work?task=${ref.id}`);
    else if (ref.type === "user") router.push(`/projects/${projectId}/people?tab=workload`);
    else if (ref.type === "sprint") router.push(`/projects/${projectId}/settings?tab=sprints`);
    else if (ref.type === "notification") router.push(`/settings`);
  };

  switch (block.kind) {
    case "stat_row":
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {block.items.map((s, i) => (
            <Stat key={i} stat={s} />
          ))}
        </div>
      );

    case "task_list":
    case "people_list":
    case "activity_list":
      return (
        <div className="space-y-1.5">
          {block.items.map((it, i) => (
            <ItemRow key={i} item={it} onOpen={() => open(it)} />
          ))}
        </div>
      );

    case "agenda":
      return (
        <div className="space-y-2.5">
          {block.groups.map((g, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className={cn("text-[11px] font-semibold", g.tone === "danger" ? "text-destructive" : "text-foreground")}>{g.label}</span>
                <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono">
                  {g.items.length}
                </Badge>
              </div>
              {g.items.map((it, j) => (
                <ItemRow key={j} item={it} onOpen={() => open(it)} />
              ))}
            </div>
          ))}
        </div>
      );

    case "person_card":
      return (
        <Card className="border-border/70 bg-background/60">
          <CardContent className="p-3 space-y-2">
            <ItemRow item={block.item} onOpen={() => open(block.item)} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {block.stats.map((s, i) => (
                <Stat key={i} stat={s} />
              ))}
            </div>
          </CardContent>
        </Card>
      );

    case "table":
      return (
        <div className="overflow-x-auto rounded-md border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                {block.columns.map((c) => (
                  <TableHead key={c.key} className={cn("text-[10px]", c.align === "right" && "text-right", c.align === "center" && "text-center")}>
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {block.rows.map((r, i) => (
                <TableRow key={i} className={cn("text-[11px]", r.ref && "cursor-pointer")} onClick={() => open(r)}>
                  {block.columns.map((c) => (
                    <TableCell key={c.key} className={cn(c.align === "right" && "text-right font-mono", c.align === "center" && "text-center")}>
                      {r.cells[c.key] ?? "—"}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );

    case "heatmap":
      return (
        <div className="overflow-x-auto rounded-md border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px]">Thành viên</TableHead>
                {block.columns.map((c) => (
                  <TableHead key={c} className="text-[10px] text-center">
                    {c}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {block.rows.map((r, i) => (
                <TableRow key={i} className="text-[11px]">
                  <TableCell className="whitespace-nowrap">{r.label}</TableCell>
                  {r.cells.map((cell, j) => (
                    <TableCell key={j} className="text-center">
                      <Badge variant={TONE[cell.tone ?? "muted"]} className="text-[10px] font-mono px-1.5 py-0">
                        {cell.text}
                      </Badge>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );

    case "bar_chart": {
      const config: ChartConfig = { value: { label: block.unit ?? "giá trị", color: "hsl(var(--chart-1))" } };
      return (
        <ChartContainer config={config} className="h-40 w-full">
          <BarChart data={block.series} margin={{ left: -24, right: 4 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} />
            <YAxis allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" fill="var(--color-value)" radius={4} />
          </BarChart>
        </ChartContainer>
      );
    }

    case "line_chart": {
      const config: ChartConfig = {
        value: { label: block.unit ?? "giá trị", color: "hsl(var(--chart-1))" },
        compare: { label: block.compareLabel ?? "so sánh", color: "hsl(var(--chart-2))" },
      };
      return (
        <ChartContainer config={config} className="h-40 w-full">
          <LineChart data={block.points} margin={{ left: -24, right: 4 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} />
            <YAxis fontSize={10} tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            {block.points.some((p) => p.compare != null) && (
              <Line dataKey="compare" stroke="var(--color-compare)" strokeDasharray="4 4" dot={false} connectNulls />
            )}
            <Line dataKey="value" stroke="var(--color-value)" dot={{ r: 2 }} strokeWidth={2} connectNulls />
          </LineChart>
        </ChartContainer>
      );
    }

    case "note":
      return (
        <p className={cn("text-[11px] rounded-md px-2.5 py-1.5", block.tone === "warning" ? "bg-warning/10 text-warning-foreground" : "bg-muted/60 text-muted-foreground")}>
          {block.text}
        </p>
      );

    case "empty":
      return <EmptyState title={block.title} description={block.description ?? ""} />;
  }
}

function Stat({ stat }: { stat: StatItem }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/60 px-2.5 py-1.5">
      <div className="text-[10px] text-muted-foreground truncate">{stat.label}</div>
      <div className={cn("text-sm font-semibold tabular-nums", stat.tone === "danger" && "text-destructive", stat.tone === "warning" && "text-warning")}>
        {stat.value}
        {stat.unit ? <span className="text-[10px] font-normal text-muted-foreground ml-0.5">{stat.unit}</span> : null}
      </div>
      {stat.hint && <div className="text-[9px] text-muted-foreground truncate">{stat.hint}</div>}
    </div>
  );
}

function ItemRow({ item, onOpen }: { item: BlockItem; onOpen: () => void }) {
  const clickable = !!item.ref;
  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onOpen : undefined}
      onKeyDown={clickable ? (e) => e.key === "Enter" && onOpen() : undefined}
      className={cn(
        "rounded-md border border-border/60 bg-background/60 px-2.5 py-1.5 space-y-1",
        clickable && "cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors",
      )}
    >
      <div className="flex items-start gap-1.5 flex-wrap">
        {item.ref?.key && <span className="font-mono text-[10px] text-muted-foreground">{item.ref.key}</span>}
        <span className="text-[11px] font-medium text-foreground flex-1 min-w-0">{item.title}</span>
        {clickable && <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />}
      </div>
      {item.subtitle && <p className="text-[10px] text-muted-foreground line-clamp-2">{item.subtitle}</p>}
      {(item.badges?.length || item.meta?.length) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {item.badges?.map((b, i) => (
            <Badge key={i} variant={TONE[b.tone ?? "muted"]} className="text-[9px] px-1 py-0">
              {b.text}
            </Badge>
          ))}
          {item.meta?.map((m, i) => {
            const Icon = m.icon ? ICON[m.icon] : null;
            return (
              <span key={i} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                {Icon && <Icon className="h-3 w-3" />}
                {m.text}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
