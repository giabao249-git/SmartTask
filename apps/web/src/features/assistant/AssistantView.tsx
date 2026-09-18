"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Archive, ArchiveRestore, Bot, Layers, MessageSquare, Pencil, Plus, Search, Send, Sparkles, Trash2, User } from "lucide-react";
import type { DraftPatch } from "@smarttask/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { describeError, isApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useSkills, useSprints } from "@/lib/hooks/queries";
import { useCurrentProject } from "@/lib/hooks/use-project";
import type { ChatMessageView, ChatSessionView, ProposalView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ActionCard, parseAction } from "./ActionCard";
import { DraftRail } from "./DraftRail";
import { ACTION_LABEL, fmtDate, makeResolver } from "./codes";
import { aiKeys, useApplyProposal, useAssistantRealtime, useChatTurn, usePatchItem, useQuota, useRejectProposal, useSessionDetail, useSessionMutations, useSessions } from "./hooks";

const QUICK_PROMPTS = [
  "Phân rã yêu cầu: xây dựng chức năng quên mật khẩu qua email (gửi link 15 phút, đặt mật khẩu mới, khoá sau 5 lần sai)",
  "Ai đang quá tải tuần này? Gỡ bớt việc cho người đó",
  "Sprint này có kịp không? Vì sao?",
  "Tạo 3 task kiểm thử E2E cho màn đăng nhập, giao người còn trống giờ",
];

/** Trang Trợ lý AI (docs 12 §6): trái phiên · giữa chat · phải rail bản nháp — mọi dữ liệu từ server. */
export function AssistantView() {
  const project = useCurrentProject();
  const auth = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const initialPrompt = searchParams.get("prompt") ?? searchParams.get("initialPrompt");
  const initialSession = searchParams.get("session");

  const [showArchived, setShowArchived] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [activeSessionId, setActiveSessionId] = React.useState<string | null>(initialSession);
  const [input, setInput] = React.useState(initialPrompt ?? "");
  const [sessionsSheet, setSessionsSheet] = React.useState(false);
  const [railSheet, setRailSheet] = React.useState(false);
  const [versionConflict, setVersionConflict] = React.useState(false);
  const [highlightApply, setHighlightApply] = React.useState(false);
  const [highlightedKeys, setHighlightedKeys] = React.useState<Set<string>>(new Set());
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [rename, setRename] = React.useState<{ id: string; title: string } | null>(null);
  const [turnError, setTurnError] = React.useState<{ code: string; message: string } | null>(null);
  const itemRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const endRef = React.useRef<HTMLDivElement>(null);

  const sessionsQuery = useSessions(project.id, showArchived);
  const detail = useSessionDetail(activeSessionId);
  const sprintsQuery = useSprints(project.id);
  const skillsQuery = useSkills(project.workspaceId);
  const quota = useQuota(project.workspaceId);
  const sessionMut = useSessionMutations(project.id);
  const turn = useChatTurn(project.id, project.workspaceId);
  const apply = useApplyProposal(activeSessionId);
  const reject = useRejectProposal(activeSessionId);
  const patchItem = usePatchItem(activeSessionId);
  useAssistantRealtime(project.id, activeSessionId);

  const sessions = React.useMemo(() => (sessionsQuery.data ?? []).filter((s) => !search || (s.title ?? "").toLowerCase().includes(search.toLowerCase())), [sessionsQuery.data, search]);
  const messages = React.useMemo(() => detail.data?.messages ?? [], [detail.data]);
  const proposals = React.useMemo(() => detail.data?.proposals ?? [], [detail.data]);
  const sprints = React.useMemo(() => (sprintsQuery.data ?? []).map((s) => ({ id: s.id, name: s.name })), [sprintsQuery.data]);
  const activeSprintId = project.activeSprint?.id;
  const busy = turn.isPending || apply.isPending || reject.isPending || patchItem.isPending;
  const openDrafts = proposals.reduce((n, p) => n + p.items.filter((i) => i.status === "DRAFT").length, 0);

  // Chưa chọn phiên → chọn phiên gần nhất khi danh sách về
  React.useEffect(() => {
    if (!activeSessionId && sessionsQuery.data?.length) setActiveSessionId(sessionsQuery.data[0].id);
  }, [activeSessionId, sessionsQuery.data]);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, turn.isPending]);

  const reloadProposals = React.useCallback(async () => {
    setVersionConflict(false);
    if (activeSessionId) await qc.invalidateQueries({ queryKey: aiKeys.session(activeSessionId) });
  }, [activeSessionId, qc]);

  const onServerError = (e: unknown, fallback = "Thao tác thất bại") => {
    const { code, message } = describeError(e);
    if (code === "PROPOSAL_VERSION_CONFLICT") {
      setVersionConflict(true);
      return;
    }
    if (code === "AI_TURN_IN_PROGRESS") {
      toast.warning("Phiên này đang có một lượt chưa xong — đợi vài giây rồi gửi lại", { description: "409 AI_TURN_IN_PROGRESS" });
      return;
    }
    if (code === "AI_QUOTA_EXCEEDED") {
      const d = isApiError(e) ? e.detail<{ used: number; limit: number; resetsAt: string }>() : undefined;
      toast.error(`Hết hạn mức AI hôm nay${d ? ` (${d.used}/${d.limit})` : ""}`, { description: d?.resetsAt ? `Mở lại lúc ${fmtDate(d.resetsAt)}` : "429 AI_QUOTA_EXCEEDED" });
      return;
    }
    if (code === "PROPOSAL_VALIDATION_FAILED") {
      toast.error("Bản nháp chưa qua kiểm tra — xem lỗi trên thẻ rồi sửa lại", { description: message });
      void reloadProposals();
      return;
    }
    toast.error(fallback, { description: `${code}: ${message}` });
  };

  const send = (text: string, selectedCode?: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setTurnError(null);
    setInput("");
    turn.mutate(
      { sessionId: activeSessionId ?? undefined, text: t, selectedCode, sprintId: activeSprintId },
      {
        onSuccess: (res) => {
          if (!activeSessionId) setActiveSessionId(res.sessionId);
          // Phiên tạo bằng nút "Phiên mới" chưa có tên → đặt theo tin đầu
          if (!res.session.title) sessionMut.patch.mutate({ id: res.sessionId, title: t.slice(0, 80) });
          const a = res.action;
          if (a.type === "CHAT_RESPONSE" && a.suggestApply) {
            setHighlightApply(true);
            setTimeout(() => setHighlightApply(false), 4000);
          }
          if (a.type === "UPDATE_TASK_DRAFT" && !a.targetTask) {
            const keys = [...(a.targetDraftKey ? [a.targetDraftKey] : []), ...(a.targetDraftKeys ?? [])];
            setHighlightedKeys(new Set(keys));
            setTimeout(() => itemRefs.current[keys[0]]?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
            setTimeout(() => setHighlightedKeys(new Set()), 2500);
          }
          if (res.validation && !res.validation.ok) toast.warning(`Đề xuất có ${res.validation.errors.length} lỗi kiểm tra — xem trên thẻ`, { description: res.validation.errors[0]?.message });
        },
        onError: (e) => {
          const { code, message } = describeError(e);
          setInput(t);
          if (code === "AI_PROVIDER_UNAVAILABLE" || code === "AI_RESPONSE_INVALID" || code === "AI_PURPOSE_DISABLED") {
            setTurnError({ code, message });
            return;
          }
          onServerError(e, "Không gửi được lượt chat");
        },
      },
    );
  };

  const onApply = (proposal: ProposalView, draftKeys?: string[]) =>
    apply.mutate(
      { proposalId: proposal.id, draftKeys, version: proposal.version },
      {
        onSuccess: (res) => {
          setVersionConflict(false);
          const keys = res.createdTasks.map((t) => t.key).join(", ");
          toast.success(res.createdTasks.length ? `Đã tạo/cập nhật ${res.createdTasks.length} công việc: ${keys}` : "Đã duyệt", { description: "Nguồn: AI · thẻ chuyển xanh lá" });
        },
        onError: (e) => onServerError(e, "Không duyệt được"),
      },
    );
  const onReject = (proposal: ProposalView, draftKeys?: string[]) =>
    reject.mutate({ proposalId: proposal.id, draftKeys }, { onSuccess: () => toast.success(draftKeys ? `Đã bỏ ${draftKeys.join(", ")}` : "Đã huỷ đề xuất"), onError: (e) => onServerError(e, "Không huỷ được") });
  const onPatch = (proposal: ProposalView, draftKey: string, patch: DraftPatch) =>
    patchItem.mutate(
      { proposalId: proposal.id, draftKey, patch, version: proposal.version },
      {
        onSuccess: (res) => {
          setVersionConflict(false);
          const v = res.validation;
          if (v && !v.ok) toast.warning(`Đã lưu nhưng còn ${v.errors.length} lỗi kiểm tra`, { description: v.errors[0]?.message });
          else toast.success(`Đã sửa ${draftKey}`);
        },
        onError: (e) => onServerError(e, "Không sửa được"),
      },
    );

  const activeSession = detail.data?.session ?? sessions.find((s) => s.id === activeSessionId) ?? null;
  const skills = React.useMemo(() => (skillsQuery.data ?? []).map((s) => ({ id: s.id, name: s.name })), [skillsQuery.data]);
  const resolver = React.useMemo(() => makeResolver(proposals[proposals.length - 1]?.codeMap, project.members, sprints, skills), [proposals, project.members, sprints, skills]);

  const sidebar = (
    <SessionSidebar
      sessions={sessions}
      loading={sessionsQuery.isPending}
      error={sessionsQuery.isError ? describeError(sessionsQuery.error) : null}
      onRetry={() => sessionsQuery.refetch()}
      activeId={activeSessionId}
      onSelect={(id) => {
        setActiveSessionId(id);
        setVersionConflict(false);
        setSessionsSheet(false);
      }}
      onCreate={() => sessionMut.create.mutate(undefined, { onSuccess: (s) => setActiveSessionId(s.id), onError: (e) => onServerError(e) })}
      onToggleArchive={(s) => sessionMut.patch.mutate({ id: s.id, archived: !s.archivedAt }, { onError: (e) => onServerError(e) })}
      onRename={(s) => setRename({ id: s.id, title: s.title ?? "" })}
      onDelete={(s) => setDeleteId(s.id)}
      search={search}
      onSearch={setSearch}
      showArchived={showArchived}
      onToggleArchived={() => setShowArchived((v) => !v)}
    />
  );

  const rail = (
    <DraftRail
      projectId={project.id}
      proposals={proposals}
      members={project.members}
      sprints={sprints}
      skills={skills}
      busy={busy}
      versionConflict={versionConflict}
      onReload={() => void reloadProposals()}
      onApply={onApply}
      onReject={onReject}
      onPatch={onPatch}
      highlightApply={highlightApply}
      highlightedKeys={highlightedKeys}
      itemRefs={itemRefs}
    />
  );

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] -m-6 p-4 gap-3 max-w-none">
      <div className="flex items-center justify-between gap-4 flex-wrap shrink-0">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-info" />
            <h1 className="text-lg font-semibold tracking-tight">Trợ lý AI · {project.key}</h1>
            {quota.data && (
              <Badge variant={quota.data.remaining > 3 ? "outline" : "warning"} className="text-[10px] px-1.5 py-0 font-mono">
                {quota.data.used}/{quota.data.limit} lượt hôm nay
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">LLM đề xuất · hệ thống kiểm trên dữ liệu sống · bạn duyệt trên panel bên phải mới tạo việc thật.</p>
        </div>
        <Button variant="outline" size="sm" className="lg:hidden h-8 text-xs gap-1.5 border-info/40 text-info" onClick={() => setRailSheet(true)}>
          <Layers className="h-3.5 w-3.5" /> Bản nháp ({openDrafts})
        </Button>
      </div>

      <div className="flex-1 min-h-0 flex gap-3 overflow-hidden">
        <aside className="hidden xl:flex w-72 shrink-0 flex-col rounded-xl border border-border/80 bg-card/60 overflow-hidden">{sidebar}</aside>
        <Sheet open={sessionsSheet} onOpenChange={setSessionsSheet}>
          <SheetContent side="left" className="w-80 p-0 flex flex-col">
            <SheetHeader className="p-4 border-b border-border/60">
              <SheetTitle className="text-sm">Phiên chat</SheetTitle>
              <SheetDescription className="text-xs">Chọn phiên hoặc tạo phiên mới.</SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-hidden">{sidebar}</div>
          </SheetContent>
        </Sheet>

        <main className="flex-1 min-w-0 flex flex-col rounded-xl border border-border/80 bg-card/80 overflow-hidden">
          <div className="p-3 border-b border-border/60 bg-muted/20 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Button variant="outline" size="sm" onClick={() => setSessionsSheet(true)} className="xl:hidden h-7 px-2 text-xs gap-1 text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" /> Phiên
              </Button>
              <div className="truncate">
                <h3 className="text-xs font-semibold truncate">{activeSession?.title ?? (activeSessionId ? "Phiên chưa đặt tên" : "Phiên mới")}</h3>
                <span className="text-[10px] text-muted-foreground">
                  {activeSession?.lastTurnAt ? `Lượt cuối ${fmtDate(activeSession.lastTurnAt)} · ` : ""}
                  {messages.length} tin · {project.activeSprint ? `sprint ${project.activeSprint.name}` : "chưa có sprint chạy"}
                </span>
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1 p-4">
            {detail.isPending && activeSessionId ? (
              <div className="space-y-4 max-w-3xl mx-auto">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className={cn("h-16 w-2/3 rounded-2xl", i % 2 ? "ml-auto" : "")} />
                ))}
              </div>
            ) : detail.isError ? (
              <ErrorState code={describeError(detail.error).code} message={describeError(detail.error).message} onRetry={() => detail.refetch()} />
            ) : messages.length === 0 ? (
              <div className="py-8 space-y-6 max-w-lg mx-auto text-center">
                <EmptyState icon={Sparkles} title="Bắt đầu phiên làm việc với AI" description="Nhập yêu cầu phân rã, giao việc, cân bằng tải hoặc chọn câu mẫu:" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                  {QUICK_PROMPTS.map((q) => (
                    <Button key={q} variant="outline" size="sm" disabled={busy} onClick={() => send(q)} className="h-auto py-2.5 px-3 text-xs justify-start text-left whitespace-normal leading-relaxed text-muted-foreground hover:text-foreground">
                      <Sparkles className="h-3.5 w-3.5 text-info shrink-0 mr-2 mt-0.5" />
                      <span>{q}</span>
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-w-3xl mx-auto">
                {messages.map((m) => (
                  <MessageBubble key={m.id} m={m} me={auth.user?.shortName ?? auth.user?.fullName ?? "Bạn"} resolver={resolver} busy={busy} onSelectOption={(code, label) => send(label, code)} />
                ))}
                {turn.isPending && (
                  <div className="flex flex-col gap-1.5 items-start">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-1">
                      <Sparkles className="h-3 w-3 text-info animate-spin" />
                      <span className="font-semibold text-foreground">AI đang suy luận…</span>
                    </div>
                    <div className="rounded-2xl rounded-tl-xs px-4 py-3 bg-muted/60 border border-border/60 space-y-2 w-72">
                      <Skeleton className="h-3 w-48" />
                      <Skeleton className="h-3 w-36" />
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            )}
          </ScrollArea>

          {turnError && (
            <div className="px-3 pt-2">
              <Alert variant="destructive" className="py-2">
                <AlertTitle className="text-xs flex items-center gap-2">
                  AI không trả lời được{" "}
                  <Badge variant="destructive" className="font-mono text-[10px]">
                    {turnError.code}
                  </Badge>
                </AlertTitle>
                <AlertDescription className="text-[11px]">{turnError.message}</AlertDescription>
              </Alert>
            </div>
          )}

          <div className="p-3 border-t border-border/60 bg-background flex flex-col gap-1 shrink-0">
            <div className="flex items-center gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ví dụ: 'cái thứ hai đổi 6 giờ, giao Lan', 'bỏ cái cuối', 'sprint này có kịp không?'"
                className="text-xs h-9"
                disabled={busy}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
              />
              <Button size="sm" onClick={() => send(input)} disabled={busy || !input.trim()} className="h-9 px-3.5 gap-1.5 shrink-0">
                <Send className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-xs">Gửi</span>
              </Button>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
              <span>Enter để gửi · mỗi lượt = 1 lượt gọi AI</span>
              <span className="font-mono">
                {project.members.length} thành viên · {sprints.length} sprint trong ngữ cảnh
              </span>
            </div>
          </div>
        </main>

        <aside className="hidden lg:flex w-[400px] shrink-0 flex-col rounded-xl border border-border/80 bg-card/70 overflow-hidden">{rail}</aside>
        <Sheet open={railSheet} onOpenChange={setRailSheet}>
          <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
            <SheetHeader className="p-4 border-b border-border/60">
              <SheetTitle className="text-sm">Bản nháp trong phiên ({openDrafts})</SheetTitle>
              <SheetDescription className="text-xs">Duyệt tại đây để tạo công việc thật.</SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-hidden">{rail}</div>
          </SheetContent>
        </Sheet>
      </div>

      <Dialog open={!!rename} onOpenChange={(o) => !o && setRename(null)}>
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!rename?.title.trim()) return;
              sessionMut.patch.mutate({ id: rename.id, title: rename.title.trim() }, { onError: (err) => onServerError(err) });
              setRename(null);
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle className="text-base">Đổi tên phiên</DialogTitle>
              <DialogDescription className="text-xs">Tên ngắn gọn giúp tìm lại phiên trong danh sách.</DialogDescription>
            </DialogHeader>
            <Input value={rename?.title ?? ""} onChange={(e) => setRename((r) => (r ? { ...r, title: e.target.value } : r))} className="text-xs h-9" maxLength={120} autoFocus />
            <DialogFooter>
              <Button type="submit" size="sm">
                Lưu
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá phiên chat?</AlertDialogTitle>
            <AlertDialogDescription>Bản nháp chưa duyệt trong phiên sẽ bị huỷ; công việc đã tạo vẫn giữ nguyên.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Giữ lại</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteId) return;
                sessionMut.remove.mutate(deleteId, {
                  onSuccess: () => {
                    if (activeSessionId === deleteId) setActiveSessionId(null);
                    toast.success("Đã xoá phiên");
                    router.replace(`/projects/${project.id}/assistant`);
                  },
                  onError: (e) => onServerError(e),
                });
                setDeleteId(null);
              }}
            >
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Bong bóng tin ─────────────────────────────────────────────
function MessageBubble({ m, me, resolver, busy, onSelectOption }: { m: ChatMessageView; me: string; resolver: ReturnType<typeof makeResolver>; busy: boolean; onSelectOption: (code: string, label: string) => void }) {
  const isUser = m.role === "USER";
  const action = !isUser ? parseAction(m.structuredData) : null;
  return (
    <div className={cn("flex flex-col gap-1.5 text-xs", isUser ? "items-end" : "items-start")}>
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-1">
        {isUser ? <User className="h-3 w-3" /> : <Sparkles className="h-3 w-3 text-info" />}
        <span className="font-semibold text-foreground">{isUser ? me : "Trợ lý AI"}</span>
        <span>· {fmtDate(m.createdAt)}</span>
        {action && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono" title={action.type}>
            {ACTION_LABEL[action.type] ?? action.type}
          </Badge>
        )}
        {m.parseFailed && (
          <Badge variant="warning" className="text-[9px] px-1 py-0">
            JSON lỗi
          </Badge>
        )}
      </div>
      <div className={cn("rounded-2xl px-4 py-3 max-w-[92%] leading-relaxed shadow-xs text-xs", isUser ? "bg-primary text-primary-foreground rounded-tr-xs" : "bg-muted/70 text-foreground border border-border/60 rounded-tl-xs")}>
        <p className="whitespace-pre-wrap">{m.text || (action ? "(không có văn bản)" : "")}</p>
        {action && <ActionCard action={action} resolver={resolver} onSelectOption={onSelectOption} disabled={busy} />}
      </div>
    </div>
  );
}

// ── Cột phiên ─────────────────────────────────────────────────
interface SessionSidebarProps {
  sessions: ChatSessionView[];
  loading: boolean;
  error: { code: string; message: string } | null;
  onRetry: () => void;
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onToggleArchive: (s: ChatSessionView) => void;
  onRename: (s: ChatSessionView) => void;
  onDelete: (s: ChatSessionView) => void;
  search: string;
  onSearch: (q: string) => void;
  showArchived: boolean;
  onToggleArchived: () => void;
}

function SessionSidebar(p: SessionSidebarProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border/60 space-y-2">
        <Button onClick={p.onCreate} size="sm" className="w-full justify-center gap-1.5 text-xs h-8">
          <Plus className="h-3.5 w-3.5" /> Phiên mới
        </Button>
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input value={p.search} onChange={(e) => p.onSearch(e.target.value)} placeholder="Tìm phiên..." className="text-xs h-8 pl-8 bg-background" />
        </div>
      </div>
      <ScrollArea className="flex-1 p-2">
        {p.loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : p.error ? (
          <ErrorState code={p.error.code} message={p.error.message} onRetry={p.onRetry} />
        ) : p.sessions.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">Chưa có phiên nào — gửi tin đầu tiên, phiên sẽ tự tạo.</div>
        ) : (
          <div className="space-y-1">
            {p.sessions.map((s) => {
              const active = s.id === p.activeId;
              return (
                <div
                  key={s.id}
                  onClick={() => p.onSelect(s.id)}
                  className={cn("p-2.5 rounded-lg text-xs transition-colors cursor-pointer group flex flex-col gap-1 border border-transparent", active ? "bg-primary/10 border-primary/20" : "hover:bg-muted/50 text-muted-foreground hover:text-foreground")}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <span className={cn("line-clamp-2 text-xs flex-1", active ? "font-semibold text-foreground" : "text-foreground/90")}>{s.title ?? "Phiên chưa đặt tên"}</span>
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        title="Đổi tên"
                        onClick={(e) => {
                          e.stopPropagation();
                          p.onRename(s);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        title={s.archivedAt ? "Mở lại" : "Lưu trữ"}
                        onClick={(e) => {
                          e.stopPropagation();
                          p.onToggleArchive(s);
                        }}
                      >
                        {s.archivedAt ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 hover:text-destructive"
                        title="Xoá"
                        onClick={(e) => {
                          e.stopPropagation();
                          p.onDelete(s);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                    <span>{s.lastTurnAt ? fmtDate(s.lastTurnAt) : fmtDate(s.createdAt)}</span>
                    <div className="flex items-center gap-1">
                      {(s.openKinds ?? []).slice(0, 2).map((k) => (
                        <Badge key={k} variant="outline" className="text-[9px] px-1 py-0 font-mono">
                          {k}
                        </Badge>
                      ))}
                      {(s.openDrafts ?? 0) > 0 && (
                        <Badge variant="info" className="text-[9px] px-1 py-0 font-mono h-3.5">
                          {s.openDrafts} nháp
                        </Badge>
                      )}
                      {s.archivedAt && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0">
                          lưu trữ
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
      <div className="p-2 border-t border-border/60 bg-muted/20">
        <Button variant="ghost" size="sm" onClick={p.onToggleArchived} className="w-full text-xs text-muted-foreground hover:text-foreground justify-start h-7 gap-1.5">
          <Archive className="h-3 w-3" /> {p.showArchived ? "Ẩn phiên đã lưu trữ" : "Hiện phiên đã lưu trữ"}
        </Button>
      </div>
    </div>
  );
}
