"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { parseQuickTask, type QuickParseDicts, type QuickParseResult } from "@smarttask/shared";

/** Dán nhầm cả tệp thì không tạo hàng trăm việc — chặn cứng ở đây (docs 02/05 §A2). */
export const MAX_PASTE_LINES = 50;

/**
 * Tách nội dung dán thành danh sách tiêu đề: bỏ dòng trắng, bỏ tiền tố gạch đầu dòng và
 * số thứ tự, cắt 200 ký tự cho khớp MaxLength của CreateTaskDto. Thuần tất định, không AI.
 */
export function splitTitles(raw: string, keepAll = false): string[] {
  const all = raw
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*+•]|\d+[.)])\s+/, "").trim())
    .filter(Boolean)
    .map((l) => l.slice(0, 200));
  return keepAll ? all : all.slice(0, MAX_PASTE_LINES);
}

/**
 * Ô tạo nhanh dùng chung cho cột Kanban và Backlog (docs 02/05 §A1, §A2, §B7) — Enter tạo xong
 * ô vẫn mở cho việc kế tiếp, dán nhiều dòng thì hỏi tách thành nhiều công việc. Không có endpoint
 * mới: vẫn là POST /projects/:id/tasks, chỉ khác là không phải mở hộp thoại cho từng việc.
 * `label` là tên vùng việc (tên cột, "Backlog") chỉ dùng trong placeholder.
 */
export function QuickCreateComposer({
  label,
  dicts,
  onCreate,
  onOpenFull,
  onClose,
}: {
  label: string;
  dicts: QuickParseDicts;
  onCreate: (items: QuickParseResult[]) => Promise<void>;
  /** Hộp thoại tạo đầy đủ — màn không có hộp thoại đó thì bỏ trống, liên kết ẩn đi. */
  onOpenFull?: (title: string) => void;
  onClose: () => void;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);

  // Ô bị `disabled` trong lúc lưu nên mất focus; lấy lại ngay khi lưu xong để gõ tiếp việc kế.
  React.useEffect(() => {
    if (!busy) ref.current?.focus();
  }, [busy]);
  // Ô cao dần theo nội dung, không cần thư viện autosize
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const lines = React.useMemo(() => splitTitles(value), [value]);
  const many = lines.length > 1;
  /** Mỗi dòng parse riêng — dán nhiều dòng thì từng dòng vẫn có @người #nhãn của nó. */
  const parsed = React.useMemo(() => lines.map((l) => parseQuickTask(l, dicts)), [lines, dicts]);
  const one = parsed[0];

  /** Gợi ý khi đang gõ dở `@…` hoặc `#…` ở cuối câu. */
  const suggest = React.useMemo(() => {
    const last = value.split(/\s+/).pop() ?? "";
    if (!/^[@#].*/.test(last) || many) return null;
    const needle = last.slice(1).toLowerCase();
    if (last.startsWith("@"))
      return {
        prefix: "@",
        items: dicts.members
          .filter((m) => !needle || `${m.fullName} ${m.shortName ?? ""}`.toLowerCase().includes(needle))
          .slice(0, 5)
          .map((m) => ({ key: m.id, label: m.shortName ?? m.fullName, insert: (m.shortName ?? m.fullName).replace(/\s+/g, "") })),
      };
    return {
      prefix: "#",
      items: dicts.labels
        .filter((l) => !needle || l.name.toLowerCase().includes(needle))
        .slice(0, 5)
        .map((l) => ({ key: l.id, label: `#${l.name}`, insert: l.name.replace(/\s+/g, "") })),
    };
  }, [value, many, dicts]);

  const applySuggest = (insert: string) => {
    const parts = value.split(/(\s+)/);
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      if (parts[i].trim()) {
        parts[i] = `${parts[i][0]}${insert} `;
        break;
      }
    }
    setValue(parts.join(""));
    ref.current?.focus();
  };

  const submit = async (items: QuickParseResult[]) => {
    if (!items.length || busy || items.some((i) => !i.title)) return;
    setBusy(true);
    setProgress(items.length > 1 ? { done: 0, total: items.length } : null);
    try {
      for (let i = 0; i < items.length; i += 1) {
        await onCreate([items[i]]);
        setProgress((p) => (p ? { ...p, done: i + 1 } : null));
      }
      setValue("");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-2 space-y-2">
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!many) void submit(parsed);
          }
        }}
        placeholder={`Tiêu đề công việc trong "${label}"…`}
        disabled={busy}
        rows={1}
        maxLength={MAX_PASTE_LINES * 210}
        className="text-xs min-h-9 resize-none py-2"
      />

      {many && (
        <Alert className="p-2">
          <AlertDescription className="text-[11px] flex items-center justify-between gap-2 flex-wrap">
            <span>
              Phát hiện <strong>{lines.length}</strong> dòng
              {splitTitles(value, true).length > MAX_PASTE_LINES && ` (đã cắt còn ${MAX_PASTE_LINES})`}
            </span>
            <span className="flex items-center gap-1.5 shrink-0">
              <Button size="sm" className="h-6 text-[11px]" disabled={busy} onClick={() => void submit(parsed)}>
                Tạo {lines.length} công việc
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[11px]"
                disabled={busy}
                onClick={() => void submit([parseQuickTask(lines.join(" ").slice(0, 200), dicts)])}
              >
                Giữ một công việc
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Cho người dùng THẤY hệ thống hiểu gì trước khi Enter — không bao giờ ghi ngầm */}
      {!many && one && (one.chips.length > 0 || one.unknown.length > 0) && (
        <div className="flex flex-wrap items-center gap-1">
          {one.chips.map((c) => (
            <Badge key={c.token + c.kind} variant={c.kind === "priority" ? "warning" : c.kind === "due" ? "outline" : "secondary"} className="text-[10px] px-1.5 py-0 h-4 font-normal">
              {c.text}
            </Badge>
          ))}
          {one.unknown.map((u) => (
            <Badge key={u.token} variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal text-muted-foreground" title={`${u.token}: ${u.reason} — giữ nguyên trong tiêu đề`}>
              {u.token} · {u.reason}
            </Badge>
          ))}
        </div>
      )}

      {suggest && suggest.items.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-muted-foreground">Gợi ý:</span>
          {suggest.items.map((it) => (
            <Button key={it.key} type="button" variant="outline" size="sm" className="h-5 px-1.5 text-[10px]" onClick={() => applySuggest(it.insert)}>
              {it.label}
            </Button>
          ))}
        </div>
      )}

      {progress && <Progress value={(progress.done / progress.total) * 100} className="h-1" />}

      <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span>
          {busy ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {progress ? `Đang tạo ${progress.done}/${progress.total}…` : "Đang tạo…"}
            </span>
          ) : (
            <>
              <kbd className="px-1 rounded border bg-background font-mono">Enter</kbd> tạo ·{" "}
              <kbd className="px-1 rounded border bg-background font-mono">Esc</kbd> đóng · gõ{" "}
              <span className="font-mono text-foreground">@người #nhãn !cao 4h t6 ~react&gt;=3</span>
            </>
          )}
        </span>
        {onOpenFull && (
          <Button
            variant="link"
            size="sm"
            className="h-5 px-0 text-[10px]"
            disabled={busy}
            onClick={() => onOpenFull(one?.title || lines[0] || "")}
          >
            Mở đầy đủ…
          </Button>
        )}
      </div>
    </div>
  );
}
