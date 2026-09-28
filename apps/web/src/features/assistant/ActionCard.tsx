"use client";

import * as React from "react";
import { AlertTriangle, Brain, HelpCircle, Info, Layers, User } from "lucide-react";
import { structuredActionSchema, type StructuredAction } from "@smarttask/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { riskToVariant } from "@/lib/status";
import type { ValidationResult } from "@smarttask/shared";
import type { CodeResolver } from "./codes";
import { ACTION_LABEL } from "./codes";

/** Parse `structured_data` bằng zod của shared — sai schema thì không vẽ thẻ (chỉ hiện văn bản). */
export function parseAction(raw: unknown): StructuredAction | null {
  const r = structuredActionSchema.safeParse(raw);
  return r.success ? r.data : null;
}

interface ActionCardProps {
  action: StructuredAction;
  resolver: CodeResolver;
  validation?: ValidationResult | null;
  onSelectOption?: (code: string, label: string) => void;
  disabled?: boolean;
}

/** Thẻ dữ liệu trong bong bóng chat theo `action.type` (docs 05 §5) — chỉ đọc; tạo thật luôn ở rail. */
export function ActionCard({ action, resolver, validation, onSelectOption, disabled }: ActionCardProps) {
  switch (action.type) {
    case "ASK_CLARIFICATION":
      return (
        <div className="mt-3 pt-2.5 border-t border-border/40 space-y-2">
          <p className="font-semibold text-[11px] text-foreground flex items-center gap-1.5">
            <HelpCircle className="h-3.5 w-3.5 text-info" /> {action.question}
          </p>
          {action.options.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {action.options.map((opt) => (
                <Button
                  key={opt.code}
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() => onSelectOption?.(opt.code, opt.label)}
                  className="h-8 text-xs bg-background hover:bg-info/10 hover:border-info/50 border-border/80 gap-1.5"
                >
                  <User className="h-3.5 w-3.5 text-info" />
                  <span>{opt.label}</span>
                  <Badge variant="outline" className="font-mono text-[9px] px-1 py-0">
                    {opt.code}
                  </Badge>
                </Button>
              ))}
            </div>
          )}
        </div>
      );
    case "RISK_EXPLANATION":
      return (
        <Card className="mt-3 border-border/60 shadow-xs overflow-hidden">
          <CardHeader className="p-3 pb-2 bg-muted/30 border-b border-border/40">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" /> Phân tích rủi ro tiến độ
              </CardTitle>
              {validation && !validation.ok ? (
                // Mức do AI tự nêu mà lệch số hệ thống thì KHÔNG in như sự thật (docs 05 §4)
                <Badge variant="outline" className="text-[10px]">
                  Mức rủi ro chưa khớp số hệ thống
                </Badge>
              ) : (
                <Badge variant={riskToVariant(action.riskLevel)} className="text-[10px]">
                  Rủi ro: {riskLabel(action.riskLevel)}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-3 text-xs space-y-2">
            {action.causes.length > 0 && (
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Nguyên nhân đo được</span>
                <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                  {action.causes.map((c, i) => (
                    <li key={i} className="text-[11px]">
                      {c.code && <span className="font-mono mr-1">[{c.code}]</span>}
                      {c.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {action.recommendations.length > 0 && (
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Khuyến nghị</span>
                <ul className="list-disc pl-4 space-y-0.5">
                  {action.recommendations.map((r, i) => (
                    <li key={i} className="text-[11px]">
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {validation && !validation.ok && <ValidationNote validation={validation} />}
          </CardContent>
        </Card>
      );
    case "MEMORY_PROPOSAL":
      return (
        <div className="mt-2 p-2 rounded-md bg-info/10 border border-info/30 text-[11px] space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <Brain className="h-3.5 w-3.5 text-info" /> AI đề xuất ghi nhớ
            <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono">
              {action.memory.kind}
            </Badge>
          </div>
          <p>{action.memory.content}</p>
          <p className="text-muted-foreground">Chức năng ghi nhớ (docs 06) mở ở phase sau — hiện chỉ hiển thị.</p>
        </div>
      );
    case "CHAT_RESPONSE":
      return action.suggestApply ? (
        <div className="mt-2 p-2 rounded-md bg-info/10 border border-info/30 flex items-center gap-2 text-info">
          <Info className="h-4 w-4 shrink-0" />
          <span className="text-[11px]">Bấm nút Duyệt trên panel bản nháp để tạo công việc thật.</span>
        </div>
      ) : null;
    case "DECOMPOSE_PROPOSAL":
    case "CREATE_TASK_DRAFT":
    case "UPDATE_TASK_DRAFT":
    case "DISCARD_DRAFT":
    case "ASSIGN_PROPOSAL":
    case "REBALANCE_PROPOSAL":
      return (
        <div className="mt-2 pt-2 border-t border-border/40 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground flex-wrap">
            <Layers className="h-3 w-3 text-info" />
            <span>{ACTION_LABEL[action.type]}</span>
            {summaryOf(action, resolver).map((s) => (
              <Badge key={s} variant="secondary" className="text-[9px] font-mono px-1 py-0">
                {s}
              </Badge>
            ))}
            <span className="text-info font-medium ml-1">(xem panel bản nháp)</span>
          </div>
          {validation && <ValidationNote validation={validation} />}
        </div>
      );
    default:
      return null;
  }
}

function summaryOf(a: StructuredAction, r: CodeResolver): string[] {
  switch (a.type) {
    case "DECOMPOSE_PROPOSAL":
      return a.tasks.map((t) => t.draftKey);
    case "CREATE_TASK_DRAFT":
      return a.drafts.map((t) => t.draftKey);
    case "UPDATE_TASK_DRAFT":
      return a.targetTask ? [`task ${a.targetTask}`] : [...(a.targetDraftKey ? [a.targetDraftKey] : []), ...(a.targetDraftKeys ?? [])];
    case "DISCARD_DRAFT":
      return a.all ? ["tất cả"] : a.targetDraftKeys;
    case "ASSIGN_PROPOSAL":
      return a.assignments.map((x) => `${r.task(x.task)?.key ?? x.task} → ${r.user(x.assignee)?.name ?? x.assignee}`);
    case "REBALANCE_PROPOSAL":
      return a.moves.map((x) => `${r.task(x.task)?.key ?? x.task}: ${r.user(x.from)?.name ?? x.from} → ${r.user(x.to)?.name ?? x.to}`);
    default:
      return [];
  }
}

export function ValidationNote({ validation }: { validation: ValidationResult }) {
  if (validation.ok && validation.warnings.length === 0) return null;
  return (
    <div className="text-[10px] space-y-0.5">
      {validation.errors.map((e, i) => (
        <p key={`e${i}`} className="text-destructive">
          ✖ <span className="font-mono">{e.code}</span> {e.path}: {e.message}
        </p>
      ))}
      {validation.warnings.map((w, i) => (
        <p key={`w${i}`} className="text-warning">
          ⚠ <span className="font-mono">{w.code}</span> {w.message}
        </p>
      ))}
    </div>
  );
}

function riskLabel(level: string): string {
  return { LOW: "Thấp", MEDIUM: "Trung bình", HIGH: "Cao", UNKNOWN: "Chưa xác định" }[level] ?? level;
}
