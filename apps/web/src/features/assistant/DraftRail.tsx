"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Edit2,
  ExternalLink,
  Gauge,
  GitBranch,
  Layers,
  ListTree,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  Trash2,
  XCircle,
} from "lucide-react";
import type { DraftPatch } from "@smarttask/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PriorityBadge } from "@/components/app/PriorityBadge";
import { TaskTypeBadge } from "@/components/app/TaskTypeBadge";
import { UserAvatar } from "@/components/app/UserAvatar";
import { useSprintSummary } from "@/lib/hooks/analytics";
import { draftItemClasses, percentToWorkload } from "@/lib/status";
import type { ProjectMember, ProposalIssue, ProposalItem, ProposalView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { KIND_LABEL, fmtDate, makeResolver, type CodeResolver } from "./codes";

export interface DraftRailProps {
  projectId: string;
  proposals: ProposalView[];
  members: ProjectMember[];
  sprints: { id: string; name: string }[];
  skills: { id: string; name: string }[];
  /** Để đổi mã việc nội bộ (t4) sang "ST-4 · tiêu đề" cho người đọc */
  tasks: { id: string; number: number; title: string }[];
  projectKey: string;
  busy: boolean;
  versionConflict: boolean;
  onReload: () => void;
  onApply: (proposal: ProposalView, draftKeys?: string[]) => void;
  onReject: (proposal: ProposalView, draftKeys?: string[]) => void;
  onPatch: (proposal: ProposalView, draftKey: string, patch: DraftPatch) => void;
  highlightApply: boolean;
  highlightedKeys: Set<string>;
  itemRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
}

const hrs = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString("vi-VN")} h`;
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const hasError = (i: ProposalItem) => (i.issues ?? []).some((x) => x.severity === "error");

/** Rail "Bản nháp trong phiên" — vẽ TỪ proposals server (docs 12 §6). Duyệt tại đây là nơi duy nhất tạo task thật. */
export function DraftRail(p: DraftRailProps) {
  const openCount = p.proposals.reduce((n, pr) => n + pr.items.filter((i) => i.status === "DRAFT").length, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border/60 bg-muted/20 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-info" />
          <h3 className="text-sm font-semibold text-foreground">Bản nháp trong phiên</h3>
          <Badge variant="info" className="text-[10px] px-1.5 py-0">
            {openCount} chờ duyệt
          </Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={p.onReload} aria-label="Tải lại bản nháp từ server" title="Tải lại từ server">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {p.versionConflict && (
        <div className="p-3 bg-destructive/10 border-b border-destructive/20">
          <Alert variant="destructive" className="py-2 px-3">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="text-xs font-semibold">Bản nháp đã đổi ở tab khác</AlertTitle>
            <AlertDescription className="text-[11px] leading-relaxed mt-0.5">Tải lại để xem phiên bản mới nhất rồi thao tác lại.</AlertDescription>
            <Button variant="outline" size="sm" onClick={p.onReload} className="mt-2 h-6 text-[10px] gap-1 bg-background text-foreground">
              <RefreshCw className="h-3 w-3" /> Tải lại
            </Button>
          </Alert>
        </div>
      )}

      <ScrollArea className="flex-1 p-3 [&>[data-radix-scroll-area-viewport]>div]:!block">
        {p.proposals.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
            <Layers className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <p>Chưa có bản nháp nào trong phiên này.</p>
            <p className="text-[11px] text-muted-foreground/80">Gửi yêu cầu trong khung chat để AI đề xuất; bản nháp xuất hiện ở đây.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {p.proposals.map((proposal) => (
              <ProposalCard key={proposal.id} proposal={proposal} rail={p} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

/**
 * Một đề xuất (docs 02/07 — soi UX 28/09 với Gemini thật): trước đây lỗi đổ thành khối chữ đỏ kèm mã máy ở đầu,
 * sprint đích là chữ xám nhỏ, không có tổng giờ, và nút "Duyệt" sáng dù API chắc chắn trả 422 vì còn lỗi.
 */
function ProposalCard({ proposal, rail: p }: { proposal: ProposalView; rail: DraftRailProps }) {
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});
  const resolver = makeResolver(proposal.codeMap, p.members, p.sprints, p.skills, p.tasks, p.projectKey);
  const draftItems = proposal.items.filter((i) => i.status === "DRAFT");
  const appliedItems = proposal.items.filter((i) => i.status === "APPLIED");
  const otherItems = proposal.items.filter((i) => i.status !== "DRAFT" && i.status !== "APPLIED");
  const selectedKeys = draftItems.filter((i) => selected[i.draftKey]).map((i) => i.draftKey);
  const clean = draftItems.filter((i) => !hasError(i));
  const broken = draftItems.length - clean.length;
  const canApply = proposal.status === "DRAFT" && draftItems.length > 0;
  const creates = proposal.kind === "DECOMPOSE" || proposal.kind === "TASK_DRAFT";
  const totalHours = draftItems.reduce((s, i) => s + (i.estimateHours ?? 0), 0);
  const sprintId = proposal.request.sprintId;
  const sprintName = sprintId ? (p.sprints.find((s) => s.id === sprintId)?.name ?? null) : null;
  const summary = useSprintSummary(creates && canApply ? sprintId : null);
  const appliedKeys = appliedItems.map((i) => proposal.applied?.tasks.find((t) => t.draftKey === i.draftKey)?.key ?? i.draftKey).join(", ");
  const general = proposal.generalIssues ?? [];

  const card = (item: ProposalItem, mode: "draft" | "readonly") => (
    <DraftItemCard
      key={item.draftKey}
      item={item}
      projectId={p.projectId}
      resolver={resolver}
      taskKey={proposal.applied?.tasks.find((t) => t.draftKey === item.draftKey)?.key ?? null}
      members={p.members}
      selected={mode === "draft" && !!selected[item.draftKey]}
      onToggle={() => setSelected((s) => ({ ...s, [item.draftKey]: !s[item.draftKey] }))}
      onDiscard={() => p.onReject(proposal, [item.draftKey])}
      onPatch={(patch) => p.onPatch(proposal, item.draftKey, patch)}
      disabled={mode === "readonly" || p.busy}
      highlight={p.highlightedKeys.has(item.draftKey)}
      refCallback={(el) => {
        p.itemRefs.current[item.draftKey] = el;
      }}
    />
  );

  return (
    <Card className={cn("border-border/80 bg-card overflow-hidden shadow-xs", proposal.status === "APPLIED" && "border-success/40 bg-success/5")}>
      <CardHeader className="p-3 pb-2.5 space-y-2 border-b border-border/40">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold text-foreground truncate">{KIND_LABEL[proposal.kind] ?? proposal.kind}</CardTitle>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {fmtDate(proposal.createdAt)} · v{proposal.version}
          </span>
        </div>
        {creates && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-foreground tabular-nums">
              {draftItems.length} việc · {hrs(totalHours)}
            </span>
            {/* Sprint đích là thông tin quyết định — từng bị giấu thành chữ xám "sprint Sprint 1" */}
            <Badge variant="outline" className="gap-1 text-[11px] font-medium text-foreground">
              <Target className="h-3 w-3" /> Vào {sprintName ?? "Backlog"}
            </Badge>
          </div>
        )}
        {creates && summary.data && (
          <SprintFit
            add={totalHours}
            committed={summary.data.sprint.status === "PLANNED" ? summary.data.committedHours : summary.data.remainingHours}
            capacity={summary.data.capacityHours}
            name={sprintName ?? ""}
          />
        )}
        {canApply && broken > 0 && (
          <p className="flex items-start gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-foreground">
            <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-destructive" />
            <span>
              <strong>{broken}</strong>/{draftItems.length} việc còn lỗi (xem trên từng thẻ) — sửa, đổi người hoặc bỏ việc đó trước khi duyệt.
            </span>
          </p>
        )}
        {general.map((g, i) => (
          <IssueLine key={i} issue={g} />
        ))}
      </CardHeader>

      <CardContent className="p-2 space-y-2">
        {draftItems.map((item) => card(item, "draft"))}

        {appliedItems.length > 0 && (
          <Collapsible defaultOpen={false} className="pt-1">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full h-auto justify-between p-2 rounded-lg bg-success/10 border border-success/30 text-xs font-medium text-foreground hover:bg-success/15">
                <span className="flex items-center gap-1.5 truncate">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                  <span className="truncate">
                    Đã tạo {appliedItems.length} việc · {appliedKeys || "Hoàn thành"}
                  </span>
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">{appliedItems.map((item) => card(item, "readonly"))}</CollapsibleContent>
          </Collapsible>
        )}

        {otherItems.map((item) => card(item, "readonly"))}
      </CardContent>

      {canApply && (
        <CardFooter className="p-2.5 border-t border-border/40 flex items-center justify-between gap-2 bg-muted/5">
          <Button variant="ghost" size="sm" disabled={p.busy} onClick={() => p.onReject(proposal)} className="h-8 text-xs text-muted-foreground hover:text-destructive px-2">
            Bỏ cả đề xuất
          </Button>
          <div className="flex items-center gap-2">
            {selectedKeys.length > 0 && selectedKeys.length < draftItems.length && (
              <Button
                variant="outline"
                size="sm"
                disabled={p.busy || draftItems.filter((i) => selectedKeys.includes(i.draftKey)).some(hasError)}
                onClick={() => p.onApply(proposal, selectedKeys)}
                className="h-8 text-xs gap-1"
              >
                <Check className="h-3 w-3" /> Duyệt {selectedKeys.length} đã chọn
              </Button>
            )}
            {/* API kiểm lại khi duyệt và trả 422 nếu còn lỗi → chỉ cho duyệt các mục không lỗi */}
            <Button
              size="sm"
              disabled={p.busy || clean.length === 0}
              onClick={() => p.onApply(proposal, broken ? clean.map((i) => i.draftKey) : undefined)}
              className={cn("h-8 text-xs gap-1.5", p.highlightApply && "ring-2 ring-primary ring-offset-2")}
              title={clean.length === 0 ? "Mọi việc đều còn lỗi" : undefined}
            >
              {p.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {clean.length === 0 ? "Còn lỗi — chưa duyệt được" : broken ? `Duyệt ${clean.length} việc không lỗi` : `Duyệt ${draftItems.length} việc`}
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}

/** Giờ đề xuất đặt cạnh năng lực sprint đích — số từ GET /sprints/:id/summary (UC-28 "so với năng lực còn lại"). */
function SprintFit({ add, committed, capacity, name }: { add: number; committed: number; capacity: number; name: string }) {
  const after = committed + add;
  const pct = capacity > 0 ? Math.round((after / capacity) * 100) : 0;
  const level = percentToWorkload(pct);
  return (
    <div className="flex items-start gap-1.5 text-xs text-foreground">
      <Gauge className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
      <span className="flex-1 tabular-nums">
        {name}: <span className="whitespace-nowrap">{hrs(committed)}</span> đã có + <span className="whitespace-nowrap">{hrs(add)}</span> này / năng lực{" "}
        <span className="whitespace-nowrap">{hrs(capacity)}</span>
      </span>
      <Badge variant={level.variant} className="text-[10px] px-1.5 py-0 tabular-nums shrink-0">
        {pct}%
      </Badge>
    </div>
  );
}

function IssueLine({ issue }: { issue: ProposalIssue }) {
  const Icon = issue.severity === "error" ? XCircle : AlertTriangle;
  return (
    <p className="flex items-start gap-1.5 text-xs text-foreground leading-snug">
      <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", issue.severity === "error" ? "text-destructive" : "text-warning")} aria-label={issue.severity === "error" ? "Lỗi" : "Cảnh báo"} />
      {issue.message}
    </p>
  );
}

/** Tiêu đề do API dựng từ mã ("giao t4", "sửa t4", "chuyển t4 u1 → u2") → câu việc làm gì. */
function actionLabelOf(rawTitle: string): string {
  if (rawTitle.startsWith("giao ")) return "Giao lại người thực hiện";
  if (rawTitle.startsWith("sửa ")) return "Cập nhật thông tin việc";
  if (rawTitle.startsWith("chuyển ")) return "Chuyển việc sang người khác";
  return rawTitle;
}

const PATCH_LABEL: Record<string, string> = {
  title: "Tiêu đề",
  estimateHours: "Giờ ước",
  suggestedAssignee: "Người làm",
  assignee: "Người làm",
  due: "Hạn",
  start: "Bắt đầu",
  priority: "Ưu tiên",
  difficulty: "Độ khó",
  sprint: "Sprint",
  description: "Mô tả",
};

/** Patch của UPDATE_TASK_DRAFT → "Hạn → 03/10 · Người làm → Minh" (mã u/s đổi sang tên). */
function patchText(patch: Record<string, unknown>, r: CodeResolver): string {
  return Object.entries(patch)
    .map(([k, v]) => {
      const val =
        v === null
          ? "(bỏ trống)"
          : (k === "suggestedAssignee" || k === "assignee") && typeof v === "string"
            ? (r.user(v)?.name ?? v)
            : k === "sprint" && typeof v === "string"
              ? (r.sprint(v) ?? v)
              : (k === "due" || k === "start") && typeof v === "string"
                ? dm(v)
                : String(v);
      return `${PATCH_LABEL[k] ?? k} → ${val}`;
    })
    .join(" · ");
}

interface DraftItemCardProps {
  item: ProposalItem;
  projectId: string;
  resolver: CodeResolver;
  taskKey: string | null;
  members: ProjectMember[];
  selected: boolean;
  onToggle: () => void;
  onDiscard: () => void;
  onPatch: (patch: DraftPatch) => void;
  disabled: boolean;
  highlight: boolean;
  refCallback: (el: HTMLDivElement | null) => void;
}

function DraftItemCard({ item, projectId, resolver, taskKey, members, selected, onToggle, onDiscard, onPatch, disabled, highlight, refCallback }: DraftItemCardProps) {
  const [editOpen, setEditOpen] = React.useState(false);
  const isDraft = item.status === "DRAFT";
  const isApplied = item.status === "APPLIED";
  const isDiscarded = item.status === "DISCARDED";
  const d = item.detail ?? {};
  const issues = item.issues ?? [];
  const errors = issues.filter((x) => x.severity === "error").length;
  const who = resolver.user(item.assignee);
  const member = who ? members.find((m) => m.id === who.id) : undefined;
  const taskRef = resolver.task(item.task);
  const skillName = (code: string) => resolver.skillLabel(code);
  return (
    <div
      ref={refCallback}
      className={cn(
        "p-3 rounded-lg border text-xs transition-all duration-300 space-y-2 bg-card",
        draftItemClasses(item.status),
        errors > 0 && isDraft && "border-destructive/50",
        highlight && "ring-2 ring-info shadow-sm",
      )}
    >
      <div className="flex items-start gap-2">
        {isDraft && <Checkbox checked={selected} onCheckedChange={onToggle} className="mt-0.5" disabled={disabled} aria-label={`Chọn ${item.draftKey}`} />}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className="font-mono text-[10px] px-1 py-0">
              {item.draftKey}
            </Badge>
            {d.taskType && <TaskTypeBadge type={d.taskType} size="icon" />}
            {d.priority && <PriorityBadge priority={d.priority} showIcon={false} />}
            {isApplied && item.taskId && (
              <Button asChild variant="link" size="sm" className="h-5 p-0 text-success font-mono font-semibold text-xs gap-1">
                <Link href={`/projects/${projectId}/work?task=${item.taskId}`}>
                  <CheckCircle2 className="h-3 w-3" /> {taskKey ?? "Đã tạo"} <ExternalLink className="h-2.5 w-2.5" />
                </Link>
              </Button>
            )}
            {isDiscarded && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0">
                Đã bỏ
              </Badge>
            )}
            {item.edited && (
              <Badge variant="outline" className="text-[10px] px-1 py-0">
                đã sửa tay
              </Badge>
            )}
            {isDraft && errors > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                {errors} lỗi
              </Badge>
            )}
          </div>
          {taskRef ? (
            <div className={cn(isDiscarded && "line-through text-muted-foreground")}>
              <p className="text-sm font-medium text-foreground leading-snug">
                <span className="font-mono text-muted-foreground mr-1">{taskRef.key}</span>
                {taskRef.title}
              </p>
              <p className="text-xs text-foreground/80">{actionLabelOf(item.title)}</p>
            </div>
          ) : (
            <p className={cn("text-sm font-medium text-foreground leading-snug", isDiscarded && "line-through text-muted-foreground")}>{item.title}</p>
          )}
          {d.description && <p className="text-xs text-muted-foreground line-clamp-2">{d.description}</p>}
          {d.patch && Object.keys(d.patch).length > 0 && <p className="text-xs text-foreground">Sẽ đổi: {patchText(d.patch, resolver)}</p>}
        </div>
        {isDraft && (
          <div className="flex items-center gap-0.5 shrink-0">
            <Popover open={editOpen} onOpenChange={setEditOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" aria-label={`Sửa ${item.draftKey}`} title="Sửa tay" disabled={disabled}>
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-3 text-xs" align="end">
                <EditForm
                  item={item}
                  members={members}
                  userCodeOf={resolver.userCodeOf}
                  onSubmit={(patch) => {
                    onPatch(patch);
                    setEditOpen(false);
                  }}
                  onCancel={() => setEditOpen(false)}
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDiscard}
              disabled={disabled}
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              aria-label={`Bỏ ${item.draftKey}`}
              title="Bỏ bản nháp"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Người thực hiện + giờ: hai thông tin người duyệt nhìn đầu tiên — chữ thường, không xám nhạt */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-foreground">
        {who ? (
          <span className="flex items-center gap-1.5 min-w-0">
            <UserAvatar name={who.name} avatar={member?.avatarUrl ?? undefined} size="sm" showTooltip={false} />
            <span className="font-medium truncate max-w-[140px]">{who.name}</span>
          </span>
        ) : item.assignee !== undefined || (item.title && !taskRef) ? (
          <span className="flex items-center gap-1 text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-warning" aria-hidden /> Chưa giao
          </span>
        ) : null}
        {item.estimateHours != null && (
          <span className="flex items-center gap-1 tabular-nums">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" /> {hrs(item.estimateHours)}
          </span>
        )}
        {d.difficulty != null && <span className="tabular-nums">Độ khó {d.difficulty}/5</span>}
        {(item.start || item.due) && (
          <span className="tabular-nums">
            {item.start ? `${dm(item.start)} → ` : "hạn "}
            {item.due ? dm(item.due) : "—"}
          </span>
        )}
      </div>

      {(d.skills?.length || item.dependsOn?.length || d.subtasks) && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {(d.skills ?? []).map((s) => (
            <Badge key={s.code} variant="secondary" className="font-normal text-[11px] px-1.5 py-0">
              {skillName(s.code)} · mức ≥ {s.minLevel}
            </Badge>
          ))}
          {item.dependsOn && item.dependsOn.length > 0 && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <GitBranch className="h-3 w-3" /> sau {item.dependsOn.join(", ")}
            </span>
          )}
          {d.subtasks ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              <ListTree className="h-3 w-3" /> {d.subtasks} việc con
            </span>
          ) : null}
        </div>
      )}

      {d.reason && (
        <p className="flex items-start gap-1.5 border-l-2 border-info/50 pl-2 text-xs text-foreground/90">
          <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-info" aria-label="Lý do AI đề xuất" />
          {d.reason}
        </p>
      )}

      {isDraft && issues.length > 0 && (
        <div className="space-y-1 rounded-md bg-muted/50 p-2">
          {issues.map((x, i) => (
            <IssueLine key={i} issue={x} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Sửa tay: tiêu đề / giờ / người / hạn — chỉ gửi trường đã đổi (docs 12 §5 PATCH items/:draftKey). */
function EditForm({
  item,
  members,
  userCodeOf,
  onSubmit,
  onCancel,
}: {
  item: ProposalItem;
  members: ProjectMember[];
  userCodeOf: (id: string) => string | null;
  onSubmit: (p: DraftPatch) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = React.useState(item.title);
  const [hours, setHours] = React.useState(item.estimateHours != null ? String(item.estimateHours) : "");
  const [assignee, setAssignee] = React.useState<string>(item.assignee ?? "__none");
  const [due, setDue] = React.useState(item.due ?? "");
  const options = members.map((m) => ({ code: userCodeOf(m.id), name: m.shortName ?? m.fullName })).filter((o): o is { code: string; name: string } => !!o.code);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const patch: DraftPatch = {};
        if (title.trim() && title.trim() !== item.title) patch.title = title.trim();
        const h = hours === "" ? null : Number(hours);
        if (h !== (item.estimateHours ?? null)) patch.estimateHours = h;
        const a = assignee === "__none" ? null : assignee;
        if (a !== (item.assignee ?? null)) patch.suggestedAssignee = a;
        if (item.due !== undefined && (due || null) !== (item.due ?? null)) patch.due = due || null;
        if (Object.keys(patch).length) onSubmit(patch);
        else onCancel();
      }}
      className="space-y-2.5"
    >
      <h4 className="font-semibold text-foreground text-xs">Sửa bản nháp {item.draftKey}</h4>
      <div className="space-y-1">
        <label className="text-[10px] font-medium text-muted-foreground">Tiêu đề</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-xs h-8" required />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground">Ước lượng (giờ)</label>
          <Input type="number" step="0.5" min={0} max={400} value={hours} onChange={(e) => setHours(e.target.value)} className="text-xs h-8 font-mono" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground">Người phụ trách</label>
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none" className="text-xs">
                — chưa giao —
              </SelectItem>
              {options.map((o) => (
                <SelectItem key={o.code} value={o.code} className="text-xs">
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {item.due !== undefined && (
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground">Hạn (YYYY-MM-DD)</label>
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="text-xs h-8" />
        </div>
      )}
      <div className="flex items-center justify-end gap-1.5 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} className="h-7 text-xs">
          Đóng
        </Button>
        <Button type="submit" size="sm" className="h-7 text-xs">
          Lưu
        </Button>
      </div>
    </form>
  );
}
