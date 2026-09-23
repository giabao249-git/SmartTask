"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Bot,
  Check,
  Code,
  Copy,
  History,
  Keyboard,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { UserAvatar } from "@/components/app/UserAvatar";
import type { DraftPatch } from "@smarttask/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { ShortcutsDialog } from "@/components/app/ShortcutsDialog";
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
import {
  aiKeys,
  useApplyProposal,
  useAssistantRealtime,
  useChatTurn,
  usePatchItem,
  useChatModelLabel,
  useQuota,
  useRejectProposal,
  useSessionDetail,
  useSessionMutations,
  useSessions,
} from "./hooks";

const QUICK_PROMPTS = [
  "Phân rã yêu cầu: xây dựng chức năng quên mật khẩu qua email (gửi link 15 phút, đặt mật khẩu mới, khoá sau 5 lần sai)",
  "Ai đang quá tải tuần này? Gỡ bớt việc cho người đó",
  "Sprint này có kịp không? Vì sao?",
  "Tạo 3 task kiểm thử E2E cho màn đăng nhập, giao người còn trống giờ",
];

const SLASH_COMMANDS = [
  {
    cmd: "/decompose",
    label: "Phân rã yêu cầu",
    description: "Phân rã User Story thành danh sách công việc WBS",
    prompt: "Phân rã yêu cầu: ",
  },
  {
    cmd: "/assign",
    label: "Gợi ý phân công",
    description: "Đề xuất giao việc tối ưu theo kỹ năng và giờ trống",
    prompt: "Gợi ý phân công công việc theo ma trận kỹ năng",
  },
  {
    cmd: "/rebalance",
    label: "Cân bằng tải",
    description: "Đề xuất san sẻ công việc cho thành viên đang quá tải",
    prompt: "Ai đang quá tải? Gỡ bớt việc và san sẻ tải",
  },
  {
    cmd: "/explain",
    label: "Phân tích rủi ro",
    description: "Đánh giá tiến độ sprint và rủi ro trễ hạn",
    prompt: "Sprint này có kịp không? Vì sao?",
  },
];

/** Trang Trợ lý AI (docs 12 §6): bảng lịch sử panel trượt · giữa chat chiếm trọn · phải rail bản nháp */
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
  const [historySheet, setHistorySheet] = React.useState(false);
  const [railSheet, setRailSheet] = React.useState(false);
  const [versionConflict, setVersionConflict] = React.useState(false);
  const [highlightApply, setHighlightApply] = React.useState(false);
  const [highlightedKeys, setHighlightedKeys] = React.useState<Set<string>>(new Set());
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [rename, setRename] = React.useState<{ id: string; title: string } | null>(null);
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [editTitleText, setEditTitleText] = React.useState("");
  const [turnError, setTurnError] = React.useState<{ code: string; message: string } | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  const [selectedSlashIndex, setSelectedSlashIndex] = React.useState(0);
  const [slashDismissed, setSlashDismissed] = React.useState(false);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const itemRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const endRef = React.useRef<HTMLDivElement>(null);

  const sessionsQuery = useSessions(project.id, showArchived);
  const detail = useSessionDetail(activeSessionId);
  const sprintsQuery = useSprints(project.id);
  const skillsQuery = useSkills(project.workspaceId);
  const quota = useQuota(project.workspaceId);
  // Nhãn model hiển thị = model của lượt gần nhất (server quyết định theo cấu hình AI của workspace/.env)
  const [lastModel, setLastModel] = React.useState<string | null>(null);
  const configuredModel = useChatModelLabel(project.workspaceId);
  const sessionMut = useSessionMutations(project.id);
  const turn = useChatTurn(project.id, project.workspaceId);
  const apply = useApplyProposal(activeSessionId);
  const reject = useRejectProposal(activeSessionId);
  const patchItem = usePatchItem(activeSessionId);
  useAssistantRealtime(project.id, activeSessionId);

  const sessions = React.useMemo(
    () => (sessionsQuery.data ?? []).filter((s) => !search || (s.title ?? "").toLowerCase().includes(search.toLowerCase())),
    [sessionsQuery.data, search]
  );
  const messages = React.useMemo(() => detail.data?.messages ?? [], [detail.data]);
  const proposals = React.useMemo(() => detail.data?.proposals ?? [], [detail.data]);
  const sprints = React.useMemo(() => (sprintsQuery.data ?? []).map((s) => ({ id: s.id, name: s.name })), [sprintsQuery.data]);
  const activeSprintId = project.activeSprint?.id;
  const busy = turn.isPending || apply.isPending || reject.isPending || patchItem.isPending;
  const openDrafts = proposals.reduce((n, p) => n + p.items.filter((i) => i.status === "DRAFT").length, 0);

  // Keyboard shortcut ⌘H to toggle History panel, and ? to toggle Shortcuts modal
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "h" || e.key === "H")) {
        e.preventDefault();
        setHistorySheet((v) => !v);
      }
      const tag = (e.target as HTMLElement | null)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement | null)?.isContentEditable;
      if (!isInput && e.key === "?") {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    if (!val.startsWith("/")) {
      setSlashDismissed(false);
    }
    setSelectedSlashIndex(0);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const nextH = Math.min(Math.max(textareaRef.current.scrollHeight, 40), 144);
      textareaRef.current.style.height = `${nextH}px`;
    }
  };

  const send = (text: string, selectedCode?: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setTurnError(null);
    setInput("");
    setSlashDismissed(false);
    setSelectedSlashIndex(0);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    turn.mutate(
      { sessionId: activeSessionId ?? undefined, text: t, selectedCode, sprintId: activeSprintId },
      {
        onSuccess: (res) => {
          if (res.usage?.model) setLastModel(`${res.usage.provider} · ${res.usage.model}`);
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
            // Nhấp sáng 1 lần rồi tắt sau 1.2s
            setTimeout(() => setHighlightedKeys(new Set()), 1200);
          }
          if (res.validation && !res.validation.ok) {
            toast.warning(`Đề xuất có ${res.validation.errors.length} lỗi kiểm tra — xem trên thẻ`, { description: res.validation.errors[0]?.message });
          }
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

  const handleStartRename = () => {
    if (activeSession) {
      setEditTitleText(activeSession.title ?? "");
      setIsEditingTitle(true);
    }
  };

  const handleSaveRename = () => {
    if (editTitleText.trim() && activeSession && editTitleText.trim() !== activeSession.title) {
      sessionMut.patch.mutate({ id: activeSession.id, title: editTitleText.trim() });
    }
    setIsEditingTitle(false);
  };

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
        setHistorySheet(false);
      }}
      onCreate={() =>
        sessionMut.create.mutate(undefined, {
          onSuccess: (s) => {
            setActiveSessionId(s.id);
            setHistorySheet(false);
          },
          onError: (e) => onServerError(e),
        })
      }
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

  const showSlashSuggestions = input.startsWith("/") && !slashDismissed && !input.includes("\n");
  const filteredCommands = SLASH_COMMANDS.filter((c) =>
    c.cmd.toLowerCase().startsWith(input.toLowerCase().split(" ")[0])
  );

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)] gap-3 w-full max-w-full overflow-x-hidden">
      {/* Top action/info bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap shrink-0">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-info" />
            <h1 className="text-lg font-semibold tracking-tight">Trợ lý AI · {project.key}</h1>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono gap-1 text-muted-foreground border-border/70">
              <Sparkles className="h-2.5 w-2.5 text-info" />
              <span>{lastModel ?? configuredModel ?? "model theo cấu hình"}</span>
            </Badge>
            <Badge variant={quota.data && quota.data.remaining <= 3 ? "warning" : "secondary"} className="text-[10px] px-1.5 py-0 font-mono">
              {quota.data ? `${quota.data.used}/${quota.data.limit}` : "7/20"} lượt hôm nay
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Hội thoại đa lượt · hệ thống tự giải tham chiếu và đồng bộ bản nháp bên phải · duyệt để tạo công việc thật.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 border-info/30 text-info hover:bg-info/10"
            onClick={() => router.push(`/settings?tab=ai&ws=${project.workspaceId}`)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cấu hình AI</span>
          </Button>

          {/* Nút nổi hoặc mở bản nháp trên mobile */}
          <Button variant="outline" size="sm" className="lg:hidden h-8 text-xs gap-1.5 border-info/40 text-info" onClick={() => setRailSheet(true)}>
            <Layers className="h-3.5 w-3.5" /> Bản nháp ({openDrafts})
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex gap-3 overflow-hidden w-full max-w-full">
        {/* Sheet Lịch sử phiên chat (trượt từ trái rộng 320px đè lên) */}
        <Sheet open={historySheet} onOpenChange={setHistorySheet}>
          <SheetContent side="left" className="w-[320px] p-0 flex flex-col">
            <SheetHeader className="p-3.5 border-b border-border/60">
              <SheetTitle className="text-xs font-semibold flex items-center gap-1.5">
                <History className="h-4 w-4 text-info" /> Lịch sử phiên chat ({sessions.length})
              </SheetTitle>
              <SheetDescription className="sr-only">Danh sách các phiên chat trong dự án này</SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-hidden">{sidebar}</div>
          </SheetContent>
        </Sheet>

        {/* Khung chat: Chiếm toàn bộ bề rộng còn lại */}
        <main className="flex-1 min-w-0 flex flex-col rounded-xl border border-border/80 bg-card/80 overflow-hidden shadow-xs">
          {/* Header khung chat */}
          <div className="p-3 border-b border-border/60 bg-muted/20 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {/* Nút Lịch sử phiên chat */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHistorySheet(true)}
                className="h-7 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground shrink-0 border-border/80"
                title="Lịch sử phiên chat (⌘H)"
              >
                <History className="h-3.5 w-3.5 text-info" />
                <span>Lịch sử ({sessions.length})</span>
                <kbd className="hidden sm:inline text-[9px] bg-background border px-1 rounded font-mono">⌘H</kbd>
              </Button>

              {/* Tiêu đề phiên có thể đổi tên inline */}
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                {isEditingTitle ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSaveRename();
                    }}
                    className="flex items-center gap-1 min-w-0"
                  >
                    <Input
                      value={editTitleText}
                      onChange={(e) => setEditTitleText(e.target.value)}
                      onBlur={handleSaveRename}
                      className="h-7 text-xs w-48 sm:w-64 bg-background"
                      autoFocus
                    />
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartRename}
                    className="group flex items-center gap-1.5 hover:bg-muted/60 px-1.5 py-0.5 rounded cursor-pointer text-left min-w-0 max-w-[240px] sm:max-w-[400px]"
                    title="Bấm để đổi tên phiên"
                  >
                    <h3 className="text-xs font-semibold truncate text-foreground">
                      {activeSession?.title ?? (activeSessionId ? "Phiên chưa đặt tên" : "Phiên mới")}
                    </h3>
                    <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
                )}
              </div>
            </div>

            {/* Thông tin sprint & tin + Nút Bảng phím tắt */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="text-[10px] text-muted-foreground hidden md:block">
                {messages.length} tin · {project.activeSprint ? `sprint ${project.activeSprint.name}` : "chưa có sprint"}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShortcutsOpen(true)}
                className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground border-border/80 bg-background/50 shrink-0"
                title="Bảng tra cứu phím tắt (?)"
              >
                <Keyboard className="h-3.5 w-3.5 text-info" />
                <span className="hidden sm:inline">Phím tắt</span>
                <kbd className="text-[9px] bg-muted border px-1 rounded font-mono">?</kbd>
              </Button>
            </div>
          </div>

          {/* Vùng tin nhắn chat cuộn */}
          <ScrollArea className="flex-1 p-4">
            {detail.isPending && activeSessionId ? (
              <div className="space-y-4 w-full px-1 sm:px-2 py-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex gap-3 max-w-[85%] text-xs",
                      i % 2 === 1 ? "ml-auto items-end flex-row-reverse" : "mr-auto items-start flex-row"
                    )}
                  >
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    <Skeleton className={cn("h-16 w-64 rounded-2xl", i % 2 === 1 ? "rounded-tr-xs" : "rounded-tl-xs")} />
                  </div>
                ))}
              </div>
            ) : detail.isError ? (
              <ErrorState code={describeError(detail.error).code} message={describeError(detail.error).message} onRetry={() => detail.refetch()} />
            ) : messages.length === 0 ? (
              <div className="py-8 space-y-6 max-w-lg mx-auto text-center">
                <EmptyState icon={Sparkles} title="Bắt đầu phiên làm việc với AI" description="Nhập yêu cầu phân rã, giao việc, cân bằng tải hoặc chọn câu mẫu:" />

                {/* Banner mẹo phím tắt trực quan */}
                <div className="p-2.5 rounded-lg border border-border/70 bg-muted/40 text-[11px] text-muted-foreground flex items-center justify-center gap-2 text-left">
                  <span className="text-primary font-medium flex items-center gap-1 shrink-0">
                    <Keyboard className="h-3.5 w-3.5" /> Mẹo phím:
                  </span>
                  <span>
                    Gõ <kbd className="font-mono bg-background border px-1 py-0.5 rounded text-[10px] text-foreground font-semibold">/</kbd> để chọn lệnh AI, dùng <kbd className="font-mono bg-background border px-1 py-0.5 rounded text-[10px] text-foreground font-semibold">↑↓</kbd> để duyệt, hoặc nhấn <kbd className="font-mono bg-background border px-1 py-0.5 rounded text-[10px] text-foreground font-semibold">?</kbd> xem danh sách phím tắt.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                  {QUICK_PROMPTS.map((q) => (
                    <Button
                      key={q}
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => send(q)}
                      className="h-auto py-2.5 px-3 text-xs justify-start text-left whitespace-normal leading-relaxed text-muted-foreground hover:text-foreground"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-info shrink-0 mr-2 mt-0.5" />
                      <span>{q}</span>
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4 w-full px-1 sm:px-2 py-2">
                {messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    m={m}
                    me={auth.user?.shortName ?? auth.user?.fullName ?? "Bạn"}
                    myAvatar={auth.user?.avatarUrl ?? undefined}
                    resolver={resolver}
                    busy={busy}
                    onSelectOption={(code, label) => send(label, code)}
                  />
                ))}
                {turn.isPending && (
                  <div className="flex gap-3 max-w-[85%] mr-auto items-start flex-row text-xs">
                    <div className="h-8 w-8 rounded-full bg-info/10 text-info border border-info/25 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                      <Bot className="h-4 w-4 text-info" />
                    </div>
                    <div className="flex flex-col gap-1 items-start min-w-0">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-1">
                        <Sparkles className="h-3 w-3 text-info animate-spin" />
                        <span className="font-semibold text-foreground">Trợ lý AI đang suy luận…</span>
                      </div>
                      <div className="rounded-2xl rounded-tl-xs px-4 py-3 bg-muted/60 text-foreground border border-border/60 space-y-2 w-72 shadow-xs">
                        <Skeleton className="h-3 w-48" />
                        <Skeleton className="h-3 w-36" />
                      </div>
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

          {/* Ô nhập chat: Textarea tự co giãn + nút gửi trong ô + gợi ý lệnh / */}
          <div className="p-3 border-t border-border/60 bg-background flex flex-col gap-1.5 shrink-0">
            {/* Gợi ý lệnh khi gõ / */}
            {showSlashSuggestions && filteredCommands.length > 0 && (
              <div className="p-1 mb-1 rounded-lg border border-border/70 bg-popover shadow-md space-y-0.5 animate-in fade-in-50 slide-in-from-bottom-1 text-xs">
                <div className="flex items-center justify-between px-2 py-1 text-[10px] text-muted-foreground border-b border-border/40 mb-1">
                  <span className="font-semibold uppercase tracking-wider text-[9px] text-foreground/80">
                    Gợi ý lệnh AI (chọn để điền)
                  </span>
                  <div className="flex items-center gap-1 font-mono text-[9px]">
                    <kbd className="px-1 py-0.5 bg-background rounded border border-border/80 text-[9px] font-semibold text-foreground">↑↓</kbd>
                    <span>chuyển</span>
                    <span className="opacity-40">·</span>
                    <kbd className="px-1 py-0.5 bg-background rounded border border-border/80 text-[9px] font-semibold text-foreground">Tab</kbd>
                    <span>hoặc</span>
                    <kbd className="px-1 py-0.5 bg-background rounded border border-border/80 text-[9px] font-semibold text-foreground">↵</kbd>
                    <span>chọn</span>
                    <span className="opacity-40">·</span>
                    <kbd className="px-1 py-0.5 bg-background rounded border border-border/80 text-[9px] font-semibold text-foreground">Esc</kbd>
                    <span>đóng</span>
                  </div>
                </div>
                {filteredCommands.map((c, idx) => {
                  const isSelected = idx === selectedSlashIndex;
                  return (
                    <button
                      key={c.cmd}
                      type="button"
                      onMouseEnter={() => setSelectedSlashIndex(idx)}
                      onClick={() => {
                        setInput(c.prompt);
                        setSlashDismissed(true);
                        if (textareaRef.current) {
                          textareaRef.current.focus();
                        }
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left text-xs cursor-pointer transition-colors group",
                        isSelected
                          ? "bg-accent text-accent-foreground font-medium"
                          : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={isSelected ? "default" : "outline"}
                          className="font-mono text-[10px] px-1 py-0"
                        >
                          {c.cmd}
                        </Badge>
                        <span className={cn("font-medium", isSelected ? "text-foreground" : "")}>{c.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground truncate max-w-[200px] sm:max-w-[260px]">
                          {c.description}
                        </span>
                        {isSelected && (
                          <kbd className="hidden sm:inline text-[9px] px-1.5 py-0.5 bg-background/80 rounded border border-border/80 font-mono text-foreground font-semibold">
                            ↵ Chọn
                          </kbd>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="relative flex items-center">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                placeholder="Ví dụ: 'cái thứ hai đổi 6 giờ, giao Lan', 'bỏ cái cuối', 'sprint này có kịp không?' hoặc gõ / để xem lệnh..."
                className="text-xs min-h-[42px] max-h-[144px] pr-12 pb-2 resize-none rounded-xl"
                disabled={busy}
                onKeyDown={(e) => {
                  if (showSlashSuggestions && filteredCommands.length > 0) {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setSelectedSlashIndex((prev) => (prev + 1) % filteredCommands.length);
                      return;
                    }
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setSelectedSlashIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
                      return;
                    }
                    if (e.key === "Enter" || e.key === "Tab") {
                      e.preventDefault();
                      const chosen = filteredCommands[selectedSlashIndex] ?? filteredCommands[0];
                      if (chosen) {
                        setInput(chosen.prompt);
                        setSlashDismissed(true);
                        if (textareaRef.current) {
                          textareaRef.current.focus();
                        }
                      }
                      return;
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setSlashDismissed(true);
                      return;
                    }
                  }

                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    send(input);
                  } else if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
              />
              <Button
                size="icon"
                onClick={() => send(input)}
                disabled={busy || !input.trim()}
                className="absolute right-2 bottom-2 h-7 w-7 rounded-lg shrink-0"
                title="Gửi (Enter hoặc ⌘Enter)"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1 pt-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-muted/80 rounded border border-border/80 text-foreground font-semibold">↵</kbd>
                  <span>gửi</span>
                </span>
                <span className="opacity-30">·</span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-muted/80 rounded border border-border/80 text-foreground font-semibold">Shift+↵</kbd>
                  <span>dòng mới</span>
                </span>
                <span className="opacity-30">·</span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-muted/80 rounded border border-border/80 text-foreground font-semibold">/</kbd>
                  <span>lệnh AI</span>
                </span>
                <span className="opacity-30">·</span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-muted/80 rounded border border-border/80 text-foreground font-semibold">⌘H</kbd>
                  <span>lịch sử</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShortcutsOpen(true)}
                  className="h-5 px-1.5 text-[10px] gap-1 text-muted-foreground hover:text-foreground h-auto py-0.5 font-normal"
                  title="Xem toàn bộ phím tắt (hoặc bấm ?)"
                >
                  <Keyboard className="h-3 w-3 text-info" />
                  <span>Phím tắt</span>
                  <kbd className="text-[9px] bg-background border px-1 rounded font-mono">?</kbd>
                </Button>
                <span className="font-mono hidden md:inline text-[9px] opacity-70">
                  {project.members.length} thành viên · {sprints.length} sprint
                </span>
              </div>
            </div>
          </div>
        </main>

        {/* Rail "Bản nháp trong phiên": Rộng 380px ở ≥1280px, 320px ở 1024-1279px, ẩn dưới 1024px */}
        <aside className="hidden lg:flex w-[320px] xl:w-[380px] shrink-0 flex-col rounded-xl border border-border/80 bg-card/70 overflow-hidden shadow-xs">
          {rail}
        </aside>

        {/* Sheet Bản nháp trên màn hình < 1024px */}
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

      {/* Dialog đổi tên từ menu */}
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

      {/* Alert dialog xoá phiên */}
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

      {/* Bảng tra cứu phím tắt toàn năng */}
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}

// ── Bong bóng tin nhắn ─────────────────────────────────────────
function MessageBubble({
  m,
  me,
  myAvatar,
  resolver,
  busy,
  onSelectOption,
}: {
  m: ChatMessageView;
  me: string;
  myAvatar?: string;
  resolver: ReturnType<typeof makeResolver>;
  busy: boolean;
  onSelectOption: (code: string, label: string) => void;
}) {
  const isUser = m.role === "USER";
  const action = !isUser ? parseAction(m.structuredData) : null;
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    const textToCopy = m.text || (action ? JSON.stringify(action, null, 2) : "");
    if (textToCopy) {
      void navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast.success("Đã sao chép nội dung");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className={cn(
        "flex gap-3 max-w-[85%] text-xs",
        isUser
          ? "ml-auto items-end flex-row-reverse"
          : "mr-auto items-start flex-row"
      )}
    >
      {/* Avatar rõ ràng 2 bên */}
      {isUser ? (
        <UserAvatar
          name={me}
          avatar={myAvatar}
          size="default"
          className="shrink-0 mb-1 ring-1 ring-border/50 shadow-xs"
          showTooltip={false}
        />
      ) : (
        <div className="h-8 w-8 rounded-full bg-info/10 text-info border border-info/25 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
          <Bot className="h-4 w-4" />
        </div>
      )}

      {/* Khung nội dung */}
      <div className={cn("flex flex-col gap-1 min-w-0 flex-1", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "flex items-center gap-1.5 text-[10px] text-muted-foreground px-1 flex-wrap",
            isUser ? "flex-row-reverse" : ""
          )}
        >
          <span className="font-semibold text-foreground">{isUser ? me : "Trợ lý AI"}</span>
          <span>·</span>
          <span>{fmtDate(m.createdAt)}</span>
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

        <div
          className={cn(
            "rounded-2xl px-4 py-3 shadow-xs text-xs leading-relaxed space-y-2 break-words max-w-full",
            isUser
              ? "rounded-tr-xs bg-primary text-primary-foreground text-left"
              : "rounded-tl-xs bg-muted/60 text-foreground border border-border/60"
          )}
        >
          <p className="whitespace-pre-wrap">{m.text || (action ? "(không có văn bản)" : "")}</p>
          {action && <ActionCard action={action} resolver={resolver} onSelectOption={onSelectOption} disabled={busy} />}

          {!isUser && (
            <div className="flex items-center gap-2 pt-1 border-t border-border/40 text-[11px]">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
              >
                {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? "Đã chép" : "Sao chép"}</span>
              </Button>

              {Boolean(m.structuredData) && (
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <Code className="h-3 w-3" />
                      <span>Xem JSON</span>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <pre className="text-[10px] font-mono bg-background/90 text-foreground p-2 rounded border border-border/60 max-h-48 overflow-auto select-all leading-normal whitespace-pre-wrap">
                      {JSON.stringify(m.structuredData, null, 2)}
                    </pre>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Cột danh sách phiên (Sidebar / Sheet panel) ────────────────
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
                  className={cn(
                    "p-2.5 rounded-lg text-xs transition-colors cursor-pointer group flex flex-col gap-1 border border-transparent",
                    active ? "bg-primary/10 border-primary/20" : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <span className={cn("line-clamp-2 text-xs flex-1", active ? "font-semibold text-foreground" : "text-foreground/90")}>
                      {s.title ?? "Phiên chưa đặt tên"}
                    </span>
                    <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground opacity-70 group-hover:opacity-100"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36 text-xs">
                          <DropdownMenuItem onClick={() => p.onRename(s)}>
                            <Pencil className="mr-2 h-3.5 w-3.5" /> Đổi tên
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => p.onToggleArchive(s)}>
                            {s.archivedAt ? <ArchiveRestore className="mr-2 h-3.5 w-3.5" /> : <Archive className="mr-2 h-3.5 w-3.5" />}
                            {s.archivedAt ? "Bỏ lưu trữ" : "Lưu trữ"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => p.onDelete(s)} className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Xoá phiên
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
