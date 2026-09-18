"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, Check, CheckCircle2, Clock, Edit2, ExternalLink, Layers, RefreshCw, Trash2, Loader2 } from "lucide-react";
import type { DraftPatch } from "@smarttask/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAvatar } from "@/components/app/UserAvatar";
import { draftItemClasses, draftItemToVariant, proposalToVariant } from "@/lib/status";
import type { ProjectMember, ProposalItem, ProposalView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { KIND_LABEL, fmtDate, makeResolver } from "./codes";
import { ValidationNote } from "./ActionCard";

export interface DraftRailProps {
  projectId: string;
  proposals: ProposalView[];
  members: ProjectMember[];
  sprints: { id: string; name: string }[];
  skills: { id: string; name: string }[];
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

/** Rail "Bản nháp trong phiên" — vẽ TỪ proposals server (docs 12 §6). Duyệt tại đây là nơi duy nhất tạo task thật. */
export function DraftRail(p: DraftRailProps) {
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});
  const openCount = p.proposals.reduce((n, pr) => n + pr.items.filter((i) => i.status === "DRAFT").length, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border/60 bg-muted/20 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-info" />
          <h3 className="text-xs font-semibold text-foreground">Bản nháp trong phiên</h3>
          <Badge variant="info" className="text-[10px] px-1.5 py-0 font-mono">
            {openCount} mở
          </Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={p.onReload} title="Tải lại từ server">
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>

      {p.versionConflict && (
        <div className="p-3 bg-destructive/10 border-b border-destructive/20">
          <Alert variant="destructive" className="py-2 px-3">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="text-xs font-semibold">Bản nháp đã đổi ở tab khác</AlertTitle>
            <AlertDescription className="text-[11px] leading-relaxed mt-0.5">
              409 <span className="font-mono">PROPOSAL_VERSION_CONFLICT</span> — tải lại để xem phiên bản mới nhất rồi thao tác lại.
            </AlertDescription>
            <Button variant="outline" size="sm" onClick={p.onReload} className="mt-2 h-6 text-[10px] gap-1 bg-background text-foreground">
              <RefreshCw className="h-3 w-3" /> Tải lại
            </Button>
          </Alert>
        </div>
      )}

      <ScrollArea className="flex-1 p-3">
        {p.proposals.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
            <Layers className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <p>Chưa có bản nháp nào trong phiên này.</p>
            <p className="text-[11px] text-muted-foreground/80">Gửi yêu cầu trong khung chat để AI đề xuất; bản nháp xuất hiện ở đây.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {p.proposals.map((proposal) => {
              const resolver = makeResolver(proposal.codeMap, p.members, p.sprints, p.skills);
              const draftItems = proposal.items.filter((i) => i.status === "DRAFT");
              const selectedKeys = draftItems.filter((i) => selected[`${proposal.id}:${i.draftKey}`]).map((i) => i.draftKey);
              const canApply = proposal.status === "DRAFT" && draftItems.length > 0;
              return (
                <Card
                  key={proposal.id}
                  className={cn("border-border/80 bg-card overflow-hidden shadow-xs", proposal.status === "APPLIED" && "border-success/40 bg-success/5")}
                >
                  <CardHeader className="p-3 pb-2 border-b border-border/40 bg-muted/10">
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 truncate">
                        <Badge variant={proposalToVariant(proposal.status)} className="text-[9px] px-1 py-0 uppercase font-mono">
                          {proposal.kind}
                        </Badge>
                        <CardTitle className="text-xs font-semibold truncate text-foreground">{KIND_LABEL[proposal.kind] ?? proposal.kind}</CardTitle>
                      </div>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono shrink-0">
                        v{proposal.version}
                      </Badge>
                    </div>
                    <CardDescription className="text-[10px] text-muted-foreground">
                      {fmtDate(proposal.createdAt)} · {proposal.items.length} mục · {proposal.status}
                      {proposal.request.sprintId && ` · sprint ${p.sprints.find((s) => s.id === proposal.request.sprintId)?.name ?? ""}`}
                    </CardDescription>
                    {proposal.validation && !proposal.validation.ok && (
                      <div className="pt-1">
                        <ValidationNote validation={proposal.validation} />
                      </div>
                    )}
                  </CardHeader>

                  <CardContent className="p-2 space-y-2">
                    {proposal.items.map((item) => (
                      <DraftItemCard
                        key={item.draftKey}
                        item={item}
                        projectId={p.projectId}
                        assigneeName={resolver.user(item.assignee)?.name ?? item.assignee ?? null}
                        taskKey={proposal.applied?.tasks.find((t) => t.draftKey === item.draftKey)?.key ?? null}
                        skillLabel={resolver.skillLabel}
                        members={p.members}
                        userCodeOf={resolver.userCodeOf}
                        selected={!!selected[`${proposal.id}:${item.draftKey}`]}
                        onToggle={() => setSelected((s) => ({ ...s, [`${proposal.id}:${item.draftKey}`]: !s[`${proposal.id}:${item.draftKey}`] }))}
                        onDiscard={() => p.onReject(proposal, [item.draftKey])}
                        onPatch={(patch) => p.onPatch(proposal, item.draftKey, patch)}
                        disabled={p.busy}
                        highlight={p.highlightedKeys.has(item.draftKey)}
                        refCallback={(el) => {
                          p.itemRefs.current[item.draftKey] = el;
                        }}
                      />
                    ))}
                  </CardContent>

                  {canApply && (
                    <CardFooter className="p-2.5 pt-0 border-t border-border/40 flex items-center justify-between gap-2 bg-muted/5">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={p.busy}
                        onClick={() => p.onReject(proposal)}
                        className="h-7 text-xs text-muted-foreground hover:text-destructive px-2"
                      >
                        Huỷ bỏ
                      </Button>
                      <div className="flex items-center gap-2">
                        {selectedKeys.length > 0 && (
                          <Button variant="outline" size="sm" disabled={p.busy} onClick={() => p.onApply(proposal, selectedKeys)} className="h-7 text-xs gap-1 border-primary/40 text-primary">
                            <Check className="h-3 w-3" /> Duyệt {selectedKeys.length} mục chọn
                          </Button>
                        )}
                        <Button
                          size="sm"
                          disabled={p.busy}
                          onClick={() => p.onApply(proposal)}
                          className={cn("h-7 text-xs gap-1.5 transition-all", p.highlightApply && "ring-2 ring-primary ring-offset-2 animate-bounce font-bold")}
                        >
                          {p.busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          Duyệt {draftItems.length} mục
                        </Button>
                      </div>
                    </CardFooter>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

interface DraftItemCardProps {
  item: ProposalItem;
  projectId: string;
  assigneeName: string | null;
  taskKey: string | null;
  skillLabel: (t: string) => string;
  members: ProjectMember[];
  userCodeOf: (id: string) => string | null;
  selected: boolean;
  onToggle: () => void;
  onDiscard: () => void;
  onPatch: (patch: DraftPatch) => void;
  disabled: boolean;
  highlight: boolean;
  refCallback: (el: HTMLDivElement | null) => void;
}

function DraftItemCard({ item, projectId, assigneeName, taskKey, skillLabel, members, userCodeOf, selected, onToggle, onDiscard, onPatch, disabled, highlight, refCallback }: DraftItemCardProps) {
  const [editOpen, setEditOpen] = React.useState(false);
  const isDraft = item.status === "DRAFT";
  const isApplied = item.status === "APPLIED";
  const isDiscarded = item.status === "DISCARDED";

  return (
    <div ref={refCallback} className={cn("p-2.5 rounded-lg border text-xs transition-all space-y-2", draftItemClasses(item.status), highlight && "ring-2 ring-info")}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {isDraft && <Checkbox checked={selected} onCheckedChange={onToggle} className="mt-0.5" disabled={disabled} />}
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className="font-mono text-[9px] px-1 py-0 shrink-0">
                {item.draftKey}
              </Badge>
              {isApplied && item.taskId && (
                <Button asChild variant="link" size="sm" className="h-5 p-0 text-success font-mono font-bold text-xs gap-1">
                  <Link href={`/projects/${projectId}/board?task=${item.taskId}`}>
                    <CheckCircle2 className="h-3 w-3" /> {taskKey ?? "Đã tạo"} <ExternalLink className="h-2.5 w-2.5" />
                  </Link>
                </Button>
              )}
              {isDraft && (
                <Badge variant={draftItemToVariant(item.status)} className="text-[9px] px-1 py-0">
                  AI · chờ duyệt
                </Badge>
              )}
              {isDiscarded && (
                <Badge variant="secondary" className="text-[9px] px-1 py-0">
                  Đã bỏ
                </Badge>
              )}
              {item.edited && (
                <Badge variant="outline" className="text-[9px] px-1 py-0">
                  sửa tay
                </Badge>
              )}
            </div>
            <p className={cn("text-xs leading-relaxed font-medium text-foreground", isDiscarded && "line-through text-muted-foreground")}>{item.title}</p>
            {item.extra && <p className="text-[10px] text-muted-foreground font-mono break-all">{item.extra}</p>}
          </div>
        </div>

        {isDraft && (
          <div className="flex items-center gap-0.5 shrink-0">
            <Popover open={editOpen} onOpenChange={setEditOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" title="Sửa tay" disabled={disabled}>
                  <Edit2 className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-3 text-xs" align="end">
                <EditForm
                  item={item}
                  members={members}
                  userCodeOf={userCodeOf}
                  onSubmit={(patch) => {
                    onPatch(patch);
                    setEditOpen(false);
                  }}
                  onCancel={() => setEditOpen(false)}
                />
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" onClick={onDiscard} disabled={disabled} className="h-6 w-6 text-muted-foreground hover:text-destructive" title="Bỏ bản nháp">
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {item.estimateHours != null && (
            <span className="flex items-center gap-1 font-mono font-medium text-foreground">
              <Clock className="h-3 w-3 text-muted-foreground" /> {item.estimateHours}h
            </span>
          )}
          {assigneeName ? (
            <div className="flex items-center gap-1 min-w-0">
              <UserAvatar name={assigneeName} size="sm" showTooltip={false} />
              <span className="truncate max-w-[90px]">{assigneeName}</span>
            </div>
          ) : (
            <span className="italic">chưa giao</span>
          )}
          {item.due && <span>hạn {item.due}</span>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {item.dependsOn && item.dependsOn.length > 0 && <span className="text-[10px]">sau {item.dependsOn.join(", ")}</span>}
          {item.skills && item.skills.length > 0 && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono">
              {skillLabel(item.skills[0])}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

/** Sửa tay: tiêu đề / giờ / người / hạn — chỉ gửi trường đã đổi (docs 12 §5 PATCH items/:draftKey). */
function EditForm({ item, members, userCodeOf, onSubmit, onCancel }: { item: ProposalItem; members: ProjectMember[]; userCodeOf: (id: string) => string | null; onSubmit: (p: DraftPatch) => void; onCancel: () => void }) {
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
                  {o.name} ({o.code})
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
