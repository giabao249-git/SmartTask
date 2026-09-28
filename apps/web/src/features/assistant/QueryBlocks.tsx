"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { AlertTriangle, ChevronDown, Clock, ExternalLink, Inbox, Info, RefreshCw, User, CalendarDays, Flag, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

/** "2026-09-15" → "15/09" cho nhãn trục biểu đồ; nhãn khác giữ nguyên */
const axisDate = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v.slice(8, 10)}/${v.slice(5, 7)}` : String(v));
/** Số trong ô bảng theo kiểu Việt: 397111 → "397.111", 5.4 → "5,4" */
const cellText = (v: unknown) => (typeof v === "number" ? v.toLocaleString("vi-VN", { maximumFractionDigits: 2 }) : v == null || v === "" ? "—" : String(v));
/** Bảng dài (BUS_FACTOR 22 dòng) đẩy câu trả lời khỏi màn hình — hiện trước chừng này dòng */
const TABLE_PREVIEW = 8;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  messageId,
}: {
  result: QueryResult;
  /** Truy vấn gốc để chạy lại — lưu cùng tin nhắn nên "Làm mới" không cần hỏi LLM. */
  query?: DataQuerySpec;
  projectId: string;
  sessionId?: string | null;
  /** Tin nhắn chứa truy vấn — backend dùng bảng mã của đúng lượt đó để giải s2/u4 */
  messageId?: string;
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
        // Tin tạm (chưa có id thật từ server) thì không gửi — backend tự lấy bảng mã mới nhất của phiên
        messageId: messageId && UUID.test(messageId) ? messageId : undefined,
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
        <div key={i} className="space-y-1.5">
          {/* Một kết quả có nhiều danh sách (báo cáo sprint) thì mỗi khối cần tiêu đề */}
          {(b.kind === "task_list" || b.kind === "table") && b.title && <p className="text-xs font-semibold text-foreground">{b.title}</p>}
          <BlockView block={b} projectId={projectId} />
        </div>
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
    else if (ref.type === "user") router.push(`/projects/${projectId}/people?member=${ref.id}`);
    else if (ref.type === "sprint") router.push(`/projects/${projectId}/sprints?sprint=${ref.id}`);
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
                <span className={cn("text-xs font-semibold", g.tone === "danger" ? "text-destructive" : "text-foreground")}>{g.label}</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 tabular-nums">
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
      return <TableBlock block={block} onOpen={open} />;

    case "heatmap":
      return (
        <div className="overflow-x-auto rounded-md border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[11px]">Thành viên</TableHead>
                {block.columns.map((c) => (
                  <TableHead key={c} className="text-[11px] text-center">
                    {c}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {block.rows.map((r, i) => (
                <TableRow key={i} className="text-xs">
                  <TableCell className="whitespace-nowrap">{r.label}</TableCell>
                  {r.cells.map((cell, j) => (
                    <TableCell key={j} className="text-center">
                      <Badge variant={TONE[cell.tone ?? "muted"]} className="text-[11px] tabular-nums px-1.5 py-0">
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
      const config: ChartConfig = {
        value: { label: block.unit ?? "giá trị", color: "hsl(var(--chart-1))" },
        compare: { label: block.compareLabel ?? "so sánh", color: "hsl(var(--chart-2))" },
      };
      const paired = block.series.some((p) => p.compare != null);
      return (
        <div className="space-y-1">
          <ChartContainer config={config} className="h-40 w-full">
            <BarChart data={block.series} margin={{ left: -24, right: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} tickFormatter={axisDate} />
              <YAxis allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              {paired && <Bar dataKey="compare" fill="var(--color-compare)" radius={4} />}
              <Bar dataKey="value" fill="var(--color-value)" radius={4} />
            </BarChart>
          </ChartContainer>
          {paired && (
            <div className="flex justify-center gap-4 text-[10px] text-muted-foreground">
              {(["compare", "value"] as const).map((k) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm" style={{ background: config[k].color }} />
                  {config[k].label}
                </span>
              ))}
            </div>
          )}
        </div>
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
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} tickFormatter={axisDate} minTickGap={16} />
            <YAxis fontSize={10} tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={axisDate} />} />
            {block.points.some((p) => p.compare != null) && <Line dataKey="compare" stroke="var(--color-compare)" strokeDasharray="4 4" dot={false} connectNulls />}
            <Line dataKey="value" stroke="var(--color-value)" dot={{ r: 2 }} strokeWidth={2} connectNulls />
          </LineChart>
        </ChartContainer>
      );
    }

    case "note":
      return <p className={cn("text-xs rounded-md px-2.5 py-1.5", block.tone === "warning" ? "bg-warning/10 text-warning-foreground" : "bg-muted/60 text-muted-foreground")}>{block.text}</p>;

    case "empty":
      // Trước: EmptyState cao 360px viền đứt — một câu "không có gì" chiếm cả màn chat
      return (
        <div className="flex items-start gap-2.5 rounded-md border border-dashed border-border/80 bg-background/60 px-3 py-2.5">
          <Inbox className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-foreground">{block.title}</p>
            {block.description && <p className="text-[11px] text-muted-foreground">{block.description}</p>}
          </div>
        </div>
      );
  }
}

function Stat({ stat }: { stat: StatItem }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/60 px-2.5 py-1.5">
      {/* Cảnh báo = icon vàng cạnh nhãn; chữ vàng trên nền sáng không đạt tương phản AA (docs 10 §6) */}
      <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
        {stat.tone === "warning" && <AlertTriangle className="h-3 w-3 shrink-0 text-warning" aria-hidden />}
        {stat.label}
      </div>
      <div className={cn("text-sm font-semibold tabular-nums", stat.tone === "danger" && "text-destructive")}>
        {cellText(stat.value)}
        {stat.unit ? <span className="text-[10px] font-normal text-muted-foreground ml-0.5">{stat.unit}</span> : null}
      </div>
      {stat.hint && <div className="text-[10px] text-muted-foreground truncate">{stat.hint}</div>}
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
      className={cn("rounded-md border border-border/60 bg-background/60 px-2.5 py-1.5 space-y-1", clickable && "cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors")}
    >
      <div className="flex items-start gap-1.5 flex-wrap">
        {item.ref?.key && <span className="font-mono text-[11px] text-muted-foreground">{item.ref.key}</span>}
        <span className="text-xs font-medium text-foreground flex-1 min-w-0">{item.title}</span>
        {clickable && <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />}
      </div>
      {item.subtitle && <p className="text-[11px] text-muted-foreground line-clamp-2">{item.subtitle}</p>}
      {(item.badges?.length || item.meta?.length) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {item.badges?.map((b, i) => (
            <Badge key={i} variant={TONE[b.tone ?? "muted"]} className="text-[10px] px-1.5 py-0">
              {b.text}
            </Badge>
          ))}
          {item.meta?.map((m, i) => {
            const Icon = m.icon ? ICON[m.icon] : null;
            return (
              <span key={i} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
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

type TableQueryBlock = Extract<QueryBlock, { kind: "table" }>;

function TableBlock({ block, onOpen }: { block: TableQueryBlock; onOpen: (r: TableQueryBlock["rows"][number]) => void }) {
  const [all, setAll] = React.useState(false);
  const rows = all ? block.rows : block.rows.slice(0, TABLE_PREVIEW);
  const hidden = block.rows.length - rows.length;
  return (
    <div className="space-y-1">
      <div className="overflow-x-auto rounded-md border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              {block.columns.map((c) => (
                <TableHead key={c.key} className={cn("text-[11px] h-8", c.align === "right" && "text-right", c.align === "center" && "text-center")}>
                  {c.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i} className={cn("text-xs", r.ref && "cursor-pointer")} onClick={() => onOpen(r)}>
                {block.columns.map((c) => (
                  // Số căn phải bằng tabular-nums (không dùng font mono: lệch kiểu chữ với phần còn lại của bảng)
                  <TableCell key={c.key} className={cn("py-1.5", c.align === "right" && "text-right tabular-nums whitespace-nowrap", c.align === "center" && "text-center")}>
                    {cellText(r.cells[c.key])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {block.rows.length > TABLE_PREVIEW && (
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] gap-1 text-muted-foreground" onClick={() => setAll((v) => !v)}>
          <ChevronDown className={cn("h-3 w-3 transition-transform", all && "rotate-180")} />
          {all ? "Thu gọn" : `Xem thêm ${hidden} dòng`}
        </Button>
      )}
    </div>
  );
}
