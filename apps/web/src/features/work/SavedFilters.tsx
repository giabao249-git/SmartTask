"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bookmark, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

/** Tối đa 10 bộ cho mỗi dự án — đủ dùng, và giữ cho Popover không thành danh sách dài. */
const MAX_SAVED = 10;
const keyOf = (projectId: string) => `st.savedFilters.${projectId}`;

interface SavedFilter {
  name: string;
  /** Chuỗi query đã chuẩn hoá, chỉ gồm các tham số lọc. */
  query: string;
}

/** Chỉ lưu tham số LỌC; `view` và `task` là chuyện của khung nhìn, không thuộc bộ lọc. */
const FILTER_KEYS = ["sprint", "assignee", "type", "q", "quick"] as const;

function read(projectId: string): SavedFilter[] {
  try {
    const raw = localStorage.getItem(keyOf(projectId));
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x): x is SavedFilter => !!x && typeof (x as SavedFilter).name === "string" && typeof (x as SavedFilter).query === "string")
      .slice(0, MAX_SAVED);
  } catch {
    return [];
  }
}

function write(projectId: string, list: SavedFilter[]): void {
  try {
    localStorage.setItem(keyOf(projectId), JSON.stringify(list.slice(0, MAX_SAVED)));
  } catch {
    // Chế độ riêng tư hoặc hết dung lượng: bỏ qua, chỉ mất tiện ích
  }
}

/**
 * Bộ lọc đặt tên lưu lại được (docs 02/05 §B5).
 *
 * Lưu ở `localStorage` theo dự án, KHÔNG có endpoint — cố ý: lưu theo người trên server là thêm
 * bảng, thêm API, thêm đồng bộ, mà giá trị không tương xứng trước feature freeze. Đổi máy là mất,
 * tooltip nói rõ điều đó.
 */
export function SavedFilters({ projectId }: { projectId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = React.useState(false);
  const [list, setList] = React.useState<SavedFilter[]>([]);
  const [name, setName] = React.useState("");

  // localStorage chỉ có ở trình duyệt → đọc sau khi gắn vào cây, tránh lệch hydration
  React.useEffect(() => setList(read(projectId)), [projectId]);

  /** Chuỗi lọc hiện tại, các khoá theo thứ tự cố định để so sánh được. */
  const current = React.useMemo(() => {
    const next = new URLSearchParams();
    for (const k of FILTER_KEYS) {
      const v = params.get(k);
      if (v) next.set(k, v);
    }
    return next.toString();
  }, [params]);

  const apply = (q: string) => {
    const next = new URLSearchParams(params.toString());
    for (const k of FILTER_KEYS) next.delete(k);
    for (const [k, v] of new URLSearchParams(q)) next.set(k, v);
    router.replace(`?${next.toString()}`, { scroll: false });
    setOpen(false);
  };

  const save = () => {
    const n = name.trim();
    if (!n) return;
    if (!current) {
      toast.warning("Chưa đặt bộ lọc nào để lưu");
      return;
    }
    const rest = list.filter((x) => x.name !== n);
    if (rest.length >= MAX_SAVED) {
      toast.warning(`Chỉ lưu được ${MAX_SAVED} bộ lọc — xoá bớt rồi lưu lại`);
      return;
    }
    const next = [...rest, { name: n, query: current }];
    setList(next);
    write(projectId, next);
    setName("");
    toast.success(`Đã lưu bộ lọc "${n}"`);
  };

  const remove = (n: string) => {
    const next = list.filter((x) => x.name !== n);
    setList(next);
    write(projectId, next);
  };

  const activeName = list.find((x) => x.query === current)?.name;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" title="Bộ lọc đã lưu (lưu trên máy này)">
          <Bookmark className={activeName ? "h-3.5 w-3.5 fill-current" : "h-3.5 w-3.5"} />
          {activeName ? <span className="max-w-28 truncate">{activeName}</span> : "Đã lưu"}
          {list.length > 0 && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 font-mono">
              {list.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2 space-y-1">
        {list.length === 0 && (
          <p className="text-[11px] text-muted-foreground px-1 py-2">
            Chưa lưu bộ lọc nào. Đặt bộ lọc như ý rồi đặt tên bên dưới.
          </p>
        )}
        {list.map((x) => (
          <div key={x.name} className="flex items-center gap-1 rounded hover:bg-muted">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 flex-1 justify-start gap-1.5 px-1.5 text-xs font-normal"
              onClick={() => apply(x.query)}
            >
              {x.query === current ? <Check className="h-3.5 w-3.5 text-success" /> : <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />}
              <span className="truncate">{x.name}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              aria-label={`Xoá bộ lọc ${x.name}`}
              onClick={() => remove(x.name)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}

        <Separator className="my-1" />

        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tên bộ lọc hiện tại…"
            maxLength={40}
            className="h-7 text-xs"
          />
          <Button type="submit" size="sm" className="h-7 text-xs" disabled={!name.trim()}>
            Lưu
          </Button>
        </form>
        <p className="text-[10px] text-muted-foreground px-1">
          Lưu trên máy này (không đồng bộ giữa các máy). Tối đa {MAX_SAVED} bộ.
        </p>
      </PopoverContent>
    </Popover>
  );
}
