"use client";

import * as React from "react";
import { Layers, Loader2, Inbox, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ScreenState = "data" | "loading" | "empty" | "error";

interface StateToggleProps {
  state: ScreenState;
  onChange: (newState: ScreenState) => void;
  className?: string;
}

export function StateToggle({ state, onChange, className }: StateToggleProps) {
  return (
    <aside
      aria-label="Mockup trạng thái màn hình"
      className={cn(
        "fixed bottom-4 right-4 z-40 flex items-center gap-1 rounded-full border border-border/70 bg-background/95 p-1 shadow-lg backdrop-blur-md",
        className
      )}
    >
      <div className="flex items-center gap-1 px-2 text-[11px] font-medium text-muted-foreground border-r border-border pr-2">
        <Layers className="h-3.5 w-3.5 text-primary" />
        <span className="hidden sm:inline">Trạng thái:</span>
      </div>

      <Button
        variant={state === "data" ? "default" : "ghost"}
        size="sm"
        onClick={() => onChange("data")}
        className={cn(
          "h-7 rounded-full px-2.5 text-xs gap-1 transition-all",
          state === "data" ? "shadow-sm" : "text-muted-foreground"
        )}
      >
        <CheckCircle2 className="h-3 w-3 text-success" />
        <span>Dữ liệu</span>
      </Button>

      <Button
        variant={state === "loading" ? "default" : "ghost"}
        size="sm"
        onClick={() => onChange("loading")}
        className={cn(
          "h-7 rounded-full px-2.5 text-xs gap-1 transition-all",
          state === "loading" ? "shadow-sm" : "text-muted-foreground"
        )}
      >
        <Loader2 className={cn("h-3 w-3", state === "loading" && "animate-spin")} />
        <span>Đang tải</span>
      </Button>

      <Button
        variant={state === "empty" ? "default" : "ghost"}
        size="sm"
        onClick={() => onChange("empty")}
        className={cn(
          "h-7 rounded-full px-2.5 text-xs gap-1 transition-all",
          state === "empty" ? "shadow-sm" : "text-muted-foreground"
        )}
      >
        <Inbox className="h-3 w-3" />
        <span>Rỗng</span>
      </Button>

      <Button
        variant={state === "error" ? "destructive" : "ghost"}
        size="sm"
        onClick={() => onChange("error")}
        className={cn(
          "h-7 rounded-full px-2.5 text-xs gap-1 transition-all",
          state === "error" ? "shadow-sm text-destructive-foreground" : "text-muted-foreground"
        )}
      >
        <AlertTriangle className="h-3 w-3" />
        <span>Lỗi</span>
      </Button>
    </aside>
  );
}
