"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  Bot,
  Sparkles,
  Send,
  Plus,
  Archive,
  ArchiveRestore,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  Edit2,
  Trash2,
  Layers,
  RefreshCw,
  Search,
  Check,
  AlertCircle,
  Info,
  ExternalLink,
  MessageSquare,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/app/UserAvatar";
import { EmptyState } from "@/components/app/EmptyState";
import { TaskDetailSheet } from "@/components/app/TaskDetailSheet";
import { MEMBERS } from "@/mocks/members";
import { TASKS, type TaskItem } from "@/mocks/tasks";
import {
  INITIAL_SESSIONS,
  INITIAL_PROPOSALS,
  INITIAL_MESSAGES,
  CLARIFICATION_BAO,
  type ChatSession,
  type AIProposal,
  type AssistantMessage,
  type DraftItem,
  type RiskExplanationData,
} from "@/mocks/assistant";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const QUICK_PROMPTS = [
  "Phân rã yêu cầu SSO Doanh nghiệp (Google & Azure AD)",
  "Gỡ bớt cho Huy trong tuần này, Huy đang quá tải 118%",
  "Sprint này có kịp không?",
  "Tạo 3 task kiểm thử bảo mật & E2E Playwright",
];

const SLASH_COMMANDS = [
  { cmd: "/decompose", desc: "Phân rã User Story / Epic thành danh sách công việc WBS" },
  { cmd: "/assign", desc: "Gợi ý phân bổ công việc theo ma trận kỹ năng và giờ trống" },
  { cmd: "/rebalance", desc: "Đề xuất chuyển giao task để giảm quá tải và cân bằng tải" },
  { cmd: "/explain", desc: "Giải thích các yếu tố rủi ro tiến độ hoặc nguy cơ Burnout" },
];

export function AssistantView() {
  const searchParams = useSearchParams();
  const urlInitialPrompt = searchParams.get("initialPrompt") || searchParams.get("prompt");

  // State: Sessions, Proposals by Session, Messages by Session
  const [sessions, setSessions] = React.useState<ChatSession[]>(INITIAL_SESSIONS);
  const [activeSessionId, setActiveSessionId] = React.useState<string>("session-sso");
  const [proposalsMap, setProposalsMap] = React.useState<Record<string, AIProposal[]>>(INITIAL_PROPOSALS);
  const [messagesMap, setMessagesMap] = React.useState<Record<string, AssistantMessage[]>>(INITIAL_MESSAGES);

  // UI state
  const [inputValue, setInputValue] = React.useState("");
  const [isAiLoading, setIsAiLoading] = React.useState(false);
  const [selectedDraftKeys, setSelectedDraftKeys] = React.useState<Record<string, boolean>>({});
  const [showArchived, setShowArchived] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [versionConflictAlert, setVersionConflictAlert] = React.useState(false);
  const [highlightedApplyBtn, setHighlightedApplyBtn] = React.useState(false);

  // Responsive Sheets state
  const [sessionsSheetOpen, setSessionsSheetOpen] = React.useState(false);
  const [draftRailSheetOpen, setDraftRailSheetOpen] = React.useState(false);

  // Task detail sheet modal
  const [selectedTask, setSelectedTask] = React.useState<TaskItem | null>(null);
  const [taskDetailOpen, setTaskDetailOpen] = React.useState(false);

  // Scroll ref for chat messages & items
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const draftItemRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  // Active session and data getters
  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const activeProposals = proposalsMap[activeSessionId] || [];
  const activeMessages = React.useMemo(() => messagesMap[activeSessionId] ?? [], [messagesMap, activeSessionId]);

  // Count open drafts in active session
  const totalOpenDrafts = activeProposals.reduce(
    (acc, prop) => acc + prop.items.filter((i) => i.status === "DRAFT").length,
    0
  );

  // Handle URL initial prompt if present
  React.useEffect(() => {
    if (urlInitialPrompt) {
      if (urlInitialPrompt.toLowerCase().includes("huy") || urlInitialPrompt.toLowerCase().includes("cân bằng")) {
        setActiveSessionId("session-rebalance");
      }
      setInputValue(urlInitialPrompt);
    }
  }, [urlInitialPrompt]);

  // Auto scroll chat to bottom when messages change
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages, isAiLoading]);

  // Handle Send Chat
  const handleSendMessage = (textToSend?: string, clarificationCode?: string) => {
    const rawText = (textToSend || inputValue).trim();
    if (!rawText && !clarificationCode) return;

    const userMessageText = clarificationCode
      ? `Đã chọn: ${CLARIFICATION_BAO.find((c) => c.code === clarificationCode)?.label || clarificationCode}`
      : rawText;

    const userMsg: AssistantMessage = {
      id: `msg-user-${Date.now()}`,
      sender: "user",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      text: userMessageText,
    };

    const updatedMessages = [...activeMessages, userMsg];
    setMessagesMap((prev) => ({
      ...prev,
      [activeSessionId]: updatedMessages,
    }));
    setInputValue("");
    setIsAiLoading(true);

    // Simulate AI thinking and structured reply
    setTimeout(() => {
      processAiIntent(rawText, clarificationCode, updatedMessages);
      setIsAiLoading(false);
    }, 650);
  };

  // AI Intent Parser Simulation
  const processAiIntent = (
    text: string,
    clarificationCode: string | undefined,
    currentHistory: AssistantMessage[]
  ) => {
    const lower = text.toLowerCase();
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // 1. "cái thứ hai đổi 6 giờ, giao Lan" (UPDATE_TASK_DRAFT)
    if (lower.includes("thứ hai") || lower.includes("d2") || (lower.includes("6 giờ") && lower.includes("lan"))) {
      // Patch item d2 in proposal
      setProposalsMap((prev) => {
        const list = prev[activeSessionId] || [];
        const nextList = list.map((p) => ({
          ...p,
          items: p.items.map((item) => {
            if (item.draftKey === "d2") {
              return {
                ...item,
                estimateHours: 6,
                assigneeId: "user-lan",
                assigneeName: "Lan",
                assigneeRole: "PM / Tech",
                highlight: true,
              };
            }
            return item;
          }),
        }));
        return { ...prev, [activeSessionId]: nextList };
      });

      const aiMsg: AssistantMessage = {
        id: `msg-ai-${Date.now()}`,
        sender: "ai",
        timestamp: timeStr,
        text: "Đã cập nhật bản nháp d2 theo yêu cầu: Thời lượng điều chỉnh thành 6 giờ, người thực hiện chuyển sang Lan (PM / Tech). Bản nháp trên panel bên phải đã được vá trực tiếp.",
        actionCode: "UPDATE_TASK_DRAFT",
        referencedDraftKeys: ["d2"],
      };

      setMessagesMap((prev) => ({
        ...prev,
        [activeSessionId]: [...currentHistory, aiMsg],
      }));

      // Scroll to d2 on rail and highlight
      setTimeout(() => {
        const el = draftItemRefs.current["d2"];
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);

      toast.success("Bản nháp d2 vừa được AI cập nhật: 6h · Lan");
      return;
    }

    // 2. "bỏ cái thứ năm" / "loại bỏ d5" (DISCARD_DRAFT)
    if (lower.includes("thứ năm") || lower.includes("bỏ") || lower.includes("d5")) {
      setProposalsMap((prev) => {
        const list = prev[activeSessionId] || [];
        const nextList = list.map((p) => ({
          ...p,
          items: p.items.map((item) => {
            if (item.draftKey === "d5") {
              return { ...item, status: "DISCARDED" as const };
            }
            return item;
          }),
        }));
        return { ...prev, [activeSessionId]: nextList };
      });

      const aiMsg: AssistantMessage = {
        id: `msg-ai-${Date.now()}`,
        sender: "ai",
        timestamp: timeStr,
        text: "Đã đánh dấu loại bỏ (DISCARDED) bản nháp d5 ('Component nút đăng nhập SSO 1-chạm'). Mục này sẽ không được tạo thành task thật khi duyệt.",
        actionCode: "DISCARD_DRAFT",
        referencedDraftKeys: ["d5"],
      };

      setMessagesMap((prev) => ({
        ...prev,
        [activeSessionId]: [...currentHistory, aiMsg],
      }));

      toast.info("Đã loại bỏ bản nháp d5");
      return;
    }

    // 3. "giao cho Bảo" (ASK_CLARIFICATION)
    if (lower.includes("bảo") && !clarificationCode) {
      const aiMsg: AssistantMessage = {
        id: `msg-ai-${Date.now()}`,
        sender: "ai",
        timestamp: timeStr,
        text: "Trong workspace hiện có 2 thành viên tên Bảo thuộc các phòng ban khác nhau. Theo chính sách định danh, vui lòng chọn người bạn muốn giao việc:",
        actionCode: "ASK_CLARIFICATION",
        clarification: {
          question: "Bạn muốn chỉ định thành viên nào?",
          options: CLARIFICATION_BAO,
        },
      };

      setMessagesMap((prev) => ({
        ...prev,
        [activeSessionId]: [...currentHistory, aiMsg],
      }));
      return;
    }

    // Handle Clarification selection response
    if (clarificationCode) {
      const chosen = CLARIFICATION_BAO.find((c) => c.code === clarificationCode);
      const aiMsg: AssistantMessage = {
        id: `msg-ai-${Date.now()}`,
        sender: "ai",
        timestamp: timeStr,
        text: `Đã xác nhận gán công việc cho ${chosen?.label} (${chosen?.department}). Bản nháp công việc liên quan đã được liên kết chính xác.`,
        actionCode: "UPDATE_TASK_DRAFT",
      };

      setMessagesMap((prev) => ({
        ...prev,
        [activeSessionId]: [...currentHistory, aiMsg],
      }));
      toast.success(`Đã chọn: ${chosen?.label}`);
      return;
    }

    // 4. "Sprint này có kịp không?" (RISK_EXPLANATION)
    if (lower.includes("kịp không") || lower.includes("tiến độ") || lower.includes("rủi ro") || lower.includes("/explain")) {
      const riskData: RiskExplanationData = {
        velocityHoursPerDay: 12.4,
        totalScopeHours: 120,
        remainingHours: 58,
        etaDate: "31/10/2026",
        delayDays: 2,
        riskLevel: "MEDIUM",
        causes: [
          "Huy (Frontend) đang quá tải 118% dẫn đến nghẽn công việc UI",
          "Tổng khối lượng còn 58 giờ trong khi thời gian Sprint chỉ còn 3 ngày làm việc (khoảng 40 giờ)",
          "Năng lực dự phòng của An chưa được tận dụng (An chỉ đạt 30% tải)",
        ],
      };

      const aiMsg: AssistantMessage = {
        id: `msg-ai-${Date.now()}`,
        sender: "ai",
        timestamp: timeStr,
        text: "Tôi đã đối chiếu vận tốc burn-down thực tế của nhóm (12.4 giờ/ngày) với 58 giờ công việc còn lại trong Sprint 3. Dự báo tiến độ như sau:",
        actionCode: "RISK_EXPLANATION",
        riskData,
      };

      setMessagesMap((prev) => ({
        ...prev,
        [activeSessionId]: [...currentHistory, aiMsg],
      }));
      return;
    }

    // 5. "Duyệt đi" / "ok tạo hết" (CHAT_RESPONSE with suggestApply)
    if (lower.includes("duyệt đi") || lower.includes("tạo hết") || lower.includes("áp dụng") || lower.includes("ok tạo")) {
      const aiMsg: AssistantMessage = {
        id: `msg-ai-${Date.now()}`,
        sender: "ai",
        timestamp: timeStr,
        text: "Theo quy ước bảo vệ dữ liệu dự án của SmartTask, AI không tự ý tạo task thật qua câu lệnh chat text. Vui lòng bấm trực tiếp nút 'Duyệt các mục' trên thanh Bản nháp bên phải để chính thức ghi vào Sprint 3.",
        actionCode: "CHAT_RESPONSE",
        suggestApply: true,
      };

      setMessagesMap((prev) => ({
        ...prev,
        [activeSessionId]: [...currentHistory, aiMsg],
      }));

      // Highlight the apply button on rail
      setHighlightedApplyBtn(true);
      setTimeout(() => setHighlightedApplyBtn(false), 2400);
      return;
    }

    // Default General AI response
    const defaultAiMsg: AssistantMessage = {
      id: `msg-ai-${Date.now()}`,
      sender: "ai",
      timestamp: timeStr,
      text: `Tôi đã ghi nhận: "${text}". Bạn có thể yêu cầu tôi chỉnh sửa bất kỳ bản nháp nào trên panel bên phải (ví dụ: "đổi d1 thành 4 giờ", "giao cho Lan", "bỏ d3"), hoặc bấm nút 'Duyệt' để tạo task thật.`,
      actionCode: "CHAT_RESPONSE",
    };

    setMessagesMap((prev) => ({
      ...prev,
      [activeSessionId]: [...currentHistory, defaultAiMsg],
    }));
  };

  // Approval Action: Apply Draft Items -> Real Tasks
  const handleApplyProposal = (proposalId: string, specificKeys?: string[]) => {
    let appliedCount = 0;
    const taskCodeStart = 33;

    setProposalsMap((prev) => {
      const list = prev[activeSessionId] || [];
      const nextList = list.map((prop) => {
        if (prop.id !== proposalId) return prop;

        const updatedItems = prop.items.map((item, idx) => {
          const shouldApply =
            (!specificKeys || specificKeys.includes(item.draftKey)) &&
            item.status === "DRAFT";

          if (shouldApply) {
            appliedCount++;
            const newTaskId = `ST-${taskCodeStart + idx}`;
            return {
              ...item,
              status: "APPLIED" as const,
              appliedTaskId: newTaskId,
              highlight: false,
            };
          }
          return item;
        });

        // If all items are applied or discarded, mark proposal as APPLIED
        const hasRemainingDraft = updatedItems.some((i) => i.status === "DRAFT");
        return {
          ...prop,
          status: hasRemainingDraft ? prop.status : ("APPLIED" as const),
          items: updatedItems,
        };
      });

      return { ...prev, [activeSessionId]: nextList };
    });

    // Update Session draft count
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? { ...s, openDraftCount: Math.max(0, s.openDraftCount - appliedCount) }
          : s
      )
    );

    // Clear draft keys selection
    setSelectedDraftKeys({});

    toast.success(`Đã duyệt và khởi tạo ${appliedCount} công việc chính thức vào Sprint 3!`);
  };

  // Discard Single Item
  const handleDiscardItem = (proposalId: string, draftKey: string) => {
    setProposalsMap((prev) => {
      const list = prev[activeSessionId] || [];
      const nextList = list.map((prop) => {
        if (prop.id !== proposalId) return prop;
        return {
          ...prop,
          items: prop.items.map((item) =>
            item.draftKey === draftKey ? { ...item, status: "DISCARDED" as const } : item
          ),
        };
      });
      return { ...prev, [activeSessionId]: nextList };
    });
    toast.info(`Đã loại bỏ bản nháp ${draftKey}`);
  };

  // Manual Edit Single Item in Proposal
  const handleUpdateItemManual = (
    proposalId: string,
    draftKey: string,
    patch: { title: string; estimateHours: number; assigneeId: string }
  ) => {
    const assignee = MEMBERS.find((m) => m.id === patch.assigneeId);
    setProposalsMap((prev) => {
      const list = prev[activeSessionId] || [];
      const nextList = list.map((prop) => {
        if (prop.id !== proposalId) return prop;
        return {
          ...prop,
          items: prop.items.map((item) => {
            if (item.draftKey === draftKey) {
              return {
                ...item,
                title: patch.title,
                estimateHours: patch.estimateHours,
                assigneeId: patch.assigneeId,
                assigneeName: assignee ? assignee.name : item.assigneeName,
                assigneeRole: assignee ? assignee.role : item.assigneeRole,
              };
            }
            return item;
          }),
        };
      });
      return { ...prev, [activeSessionId]: nextList };
    });
    toast.success(`Đã lưu thay đổi cho bản nháp ${draftKey}`);
  };

  // Open Task Detail Sheet for Applied Task
  const handleOpenAppliedTask = (taskCode: string, draftItem?: DraftItem) => {
    const existing = TASKS.find((t) => t.code === taskCode);
    if (existing) {
      setSelectedTask(existing);
      setTaskDetailOpen(true);
      return;
    }

    // Construct mock task item if not in static TASKS
    const fallbackMember = MEMBERS.find((m) => m.id === draftItem?.assigneeId) || MEMBERS[0];
    const fallbackTask: TaskItem = {
      id: `task-${taskCode.toLowerCase()}`,
      code: taskCode,
      title: draftItem?.title || `Công việc ${taskCode}`,
      description: `Task tạo tự động từ phiên trợ lý AI SmartTask.\nBản nháp nguồn: ${draftItem?.draftKey || ""}`,
      status: "TODO",
      priority: "HIGH",
      assigneeId: fallbackMember.id,
      assignee: fallbackMember,
      estimateHours: draftItem?.estimateHours || 6,
      actualHours: 0,
      remainingHours: draftItem?.estimateHours || 6,
      dueDate: draftItem?.dueDate || "2026-10-28",
      startDate: "2026-10-24",
      labels: ["AI-Generated", "SSO"],
      subtasks: [],
      requiredSkills: [{ name: "Next.js", level: 3 }],
      dependencies: [],
      comments: [],
      activities: [],
      sprint: "Sprint 3 · 23/10–29/10",
      isAiGenerated: true,
    };
    setSelectedTask(fallbackTask);
    setTaskDetailOpen(true);
  };

  // New Session Creation
  const handleCreateNewSession = () => {
    const newId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newId,
      title: "Phiên làm việc mới",
      createdAt: "Vừa xong",
      lastTurnAt: "Vừa xong",
      archived: false,
      kind: "DECOMPOSE",
      openDraftCount: 0,
    };
    setSessions((prev) => [newSession, ...prev]);
    setProposalsMap((prev) => ({ ...prev, [newId]: [] }));
    setMessagesMap((prev) => ({ ...prev, [newId]: [] }));
    setActiveSessionId(newId);
    setSessionsSheetOpen(false);
    toast.success("Đã tạo phiên làm việc mới");
  };

  // Archive / Unarchive Session
  const handleToggleArchiveSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, archived: !s.archived } : s))
    );
    toast.info("Đã cập nhật trạng thái lưu trữ phiên");
  };

  // Filtered Sessions
  const displayedSessions = sessions
    .filter((s) => (showArchived ? true : !s.archived))
    .filter((s) => s.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)] space-y-3">
      {/* Top Header & Simulation Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0 pb-1 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-info" />
            <h1 className="text-lg font-semibold text-foreground tracking-tight">
              Trợ lý AI & Bản nháp Đa lượt
            </h1>
            <Badge variant="info" className="text-[10px] px-1.5 py-0 font-normal">
              Gemini 1.5 Pro
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Trò chuyện với AI để phân rã WBS, giao việc và cân bằng tải. Thẻ bên phải là nguồn duy nhất để duyệt vào Sprint 3.
          </p>
        </div>

        {/* Dev / Test Controls Bar */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.warning("409 AI_TURN_IN_PROGRESS: Đang có lượt khác trong phiên này")}
            className="h-7 text-[11px] px-2 text-warning hover:bg-warning/10 border-warning/30 gap-1"
            title="Mô phỏng phản hồi 409 khi 2 tab cùng gửi lượt chat"
          >
            <AlertCircle className="h-3 w-3" />
            <span>Mô phỏng 409 Lượt bận</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setVersionConflictAlert(!versionConflictAlert)}
            className="h-7 text-[11px] px-2 text-destructive hover:bg-destructive/10 border-destructive/30 gap-1"
            title="Mô phỏng xung đột phiên bản (Optimistic Locking)"
          >
            <ShieldAlert className="h-3 w-3" />
            <span>{versionConflictAlert ? "Ẩn cảnh báo lệch version" : "Mô phỏng Xung đột Version"}</span>
          </Button>
        </div>
      </div>

      {/* 3-Column Main Assistant Grid */}
      <div className="flex-1 min-h-0 flex gap-4 overflow-hidden">
        {/* ================= COLUMN 1: SESSIONS LIST (>= 1280px or Sheet on < 1280px) ================= */}
        <aside className="hidden xl:flex w-72 shrink-0 flex-col rounded-xl border border-border/80 bg-card/60 overflow-hidden shadow-xs">
          <SessionSidebarContent
            sessions={displayedSessions}
            activeSessionId={activeSessionId}
            onSelectSession={setActiveSessionId}
            onCreateSession={handleCreateNewSession}
            onToggleArchive={handleToggleArchiveSession}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            showArchived={showArchived}
            onToggleShowArchived={() => setShowArchived(!showArchived)}
          />
        </aside>

        {/* Sheet Trigger for Sessions list on Tablet (< 1280px) */}
        <Sheet open={sessionsSheetOpen} onOpenChange={setSessionsSheetOpen}>
          <SheetContent side="left" className="w-80 p-0 flex flex-col">
            <SheetHeader className="p-4 border-b border-border/60">
              <SheetTitle className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <span>Danh sách phiên chat</span>
              </SheetTitle>
              <SheetDescription className="text-xs">
                Chọn phiên làm việc hoặc tạo phiên phân rã mới.
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-hidden">
              <SessionSidebarContent
                sessions={displayedSessions}
                activeSessionId={activeSessionId}
                onSelectSession={(id) => {
                  setActiveSessionId(id);
                  setSessionsSheetOpen(false);
                }}
                onCreateSession={handleCreateNewSession}
                onToggleArchive={handleToggleArchiveSession}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                showArchived={showArchived}
                onToggleShowArchived={() => setShowArchived(!showArchived)}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* ================= COLUMN 2: MIDDLE CHAT CONVERSATION ================= */}
        <main className="flex-1 flex flex-col rounded-xl border border-border/80 bg-card/80 overflow-hidden shadow-xs">
          {/* Chat Header */}
          <div className="p-3 border-b border-border/60 bg-muted/20 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {/* Tablet/Mobile Button to Open Sessions */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSessionsSheetOpen(true)}
                className="xl:hidden h-7 px-2 text-xs gap-1 text-muted-foreground"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Phiên</span>
              </Button>

              <div className="truncate">
                <div className="flex items-center gap-1.5 truncate">
                  <h3 className="text-xs font-semibold text-foreground truncate">
                    {activeSession.title}
                  </h3>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 uppercase">
                    {activeSession.kind}
                  </Badge>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  Lần sửa cuối: {activeSession.lastTurnAt} · {activeMessages.length} tin nhắn
                </span>
              </div>
            </div>

            {/* Tablet/Mobile Button to Open Draft Rail */}
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDraftRailSheetOpen(true)}
                className="lg:hidden h-7 px-2.5 text-xs gap-1.5 border-info/40 text-info bg-info/5"
              >
                <Layers className="h-3.5 w-3.5 text-info" />
                <span>Bản nháp ({totalOpenDrafts})</span>
              </Button>
            </div>
          </div>

          {/* Chat Messages Body */}
          <ScrollArea className="flex-1 p-4">
            {activeMessages.length === 0 ? (
              <div className="py-8 space-y-6 max-w-lg mx-auto text-center">
                <EmptyState
                  title="Bắt đầu phiên làm việc với AI"
                  description="Nhập yêu cầu phân rã WBS, giao việc cho nhóm hoặc bấm chọn câu lệnh mẫu gợi ý bên dưới:"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                  {QUICK_PROMPTS.map((prompt, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      onClick={() => handleSendMessage(prompt)}
                      className="h-auto py-2.5 px-3 text-xs justify-start text-left border-border/80 hover:border-info/50 hover:bg-info/5 text-muted-foreground hover:text-foreground whitespace-normal leading-relaxed"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-info shrink-0 mr-2 mt-0.5" />
                      <span>{prompt}</span>
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-w-3xl mx-auto">
                {activeMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col gap-1.5 text-xs",
                      msg.sender === "user" ? "items-end" : "items-start"
                    )}
                  >
                    {/* Message Sender Header */}
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-1">
                      {msg.sender === "ai" ? (
                        <>
                          <Sparkles className="h-3 w-3 text-info" />
                          <span className="font-semibold text-foreground">AI Assistant</span>
                        </>
                      ) : (
                        <>
                          <User className="h-3 w-3" />
                          <span className="font-semibold text-foreground">Bạn (PM Lan)</span>
                        </>
                      )}
                      <span>· {msg.timestamp}</span>
                      {msg.actionCode && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono">
                          {msg.actionCode}
                        </Badge>
                      )}
                    </div>

                    {/* Chat Bubble Body */}
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-3 max-w-[90%] sm:max-w-[85%] leading-relaxed shadow-xs text-xs",
                        msg.sender === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-xs"
                          : "bg-muted/70 text-foreground border border-border/60 rounded-tl-xs"
                      )}
                    >
                      <p>{msg.text}</p>

                      {/* Mention of draft keys */}
                      {msg.referencedDraftKeys && msg.referencedDraftKeys.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/40 flex items-center gap-1 flex-wrap">
                          <span className="text-[10px] text-muted-foreground">Bản nháp liên quan:</span>
                          {msg.referencedDraftKeys.map((key) => (
                            <Badge
                              key={key}
                              variant="secondary"
                              className="text-[9px] font-mono px-1 py-0"
                            >
                              {key}
                            </Badge>
                          ))}
                          <span className="text-[10px] text-info ml-1 font-medium">
                            (Xem thẻ bên phải)
                          </span>
                        </div>
                      )}

                      {/* Clarification Options Chips (e.g. 2 Baos) */}
                      {msg.clarification && (
                        <div className="mt-3 pt-2.5 border-t border-border/40 space-y-2">
                          <p className="font-semibold text-[11px] text-foreground">
                            {msg.clarification.question}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            {msg.clarification.options.map((opt) => (
                              <Button
                                key={opt.code}
                                variant="outline"
                                size="sm"
                                onClick={() => handleSendMessage(undefined, opt.code)}
                                className="h-8 text-xs bg-background hover:bg-info/10 hover:border-info/50 border-border/80 gap-1.5"
                              >
                                <User className="h-3.5 w-3.5 text-info" />
                                <span>{opt.label}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  ({opt.department})
                                </span>
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Risk Explanation Structured Card */}
                      {msg.riskData && (
                        <Card className="mt-3 border-warning/40 bg-warning/5 shadow-xs overflow-hidden">
                          <CardHeader className="p-3 pb-2 bg-warning/10 border-b border-warning/20">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                                <span>Phân tích rủi ro tiến độ Sprint 3</span>
                              </CardTitle>
                              <Badge variant="warning" className="text-[10px] px-1.5 py-0">
                                Rủi ro: Trung bình
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="p-3 text-xs space-y-2.5">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                              <div className="p-2 rounded bg-background/60 border border-border/40">
                                <span className="text-[10px] text-muted-foreground block">Vận tốc</span>
                                <span className="font-semibold font-mono text-foreground">
                                  {msg.riskData.velocityHoursPerDay}h / ngày
                                </span>
                              </div>
                              <div className="p-2 rounded bg-background/60 border border-border/40">
                                <span className="text-[10px] text-muted-foreground block">Còn lại</span>
                                <span className="font-semibold font-mono text-foreground">
                                  {msg.riskData.remainingHours}h / {msg.riskData.totalScopeHours}h
                                </span>
                              </div>
                              <div className="p-2 rounded bg-background/60 border border-border/40">
                                <span className="text-[10px] text-muted-foreground block">Dự kiến ETA</span>
                                <span className="font-semibold font-mono text-foreground">
                                  {msg.riskData.etaDate}
                                </span>
                              </div>
                              <div className="p-2 rounded bg-background/60 border border-border/40">
                                <span className="text-[10px] text-muted-foreground block">Chênh lệch</span>
                                <span className="font-semibold font-mono text-destructive">
                                  Trễ {msg.riskData.delayDays} ngày
                                </span>
                              </div>
                            </div>

                            <div className="space-y-1 pt-1">
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                Nguyên nhân cốt lõi:
                              </span>
                              <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                                {msg.riskData.causes.map((c, i) => (
                                  <li key={i} className="text-[11px] leading-relaxed">
                                    {c}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Readonly hint if user said "Duyệt đi" */}
                      {msg.suggestApply && (
                        <div className="mt-2 p-2 rounded-md bg-info/10 border border-info/30 flex items-center gap-2 text-info">
                          <Info className="h-4 w-4 shrink-0" />
                          <span className="text-[11px]">
                            Nhấp nháy nút Duyệt trên panel bên phải. Bấm nút đó để hoàn tất!
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* AI Loading Skeleton Bubble */}
                {isAiLoading && (
                  <div className="flex flex-col gap-1.5 items-start">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-1">
                      <Sparkles className="h-3 w-3 text-info animate-spin" />
                      <span className="font-semibold text-foreground">AI Assistant đang suy luận...</span>
                    </div>
                    <div className="rounded-2xl rounded-tl-xs px-4 py-3 bg-muted/60 border border-border/60 space-y-2 w-72">
                      <Skeleton className="h-3 w-48" />
                      <Skeleton className="h-3 w-36" />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Quick Command Suggestions Chips */}
          <div className="p-2 border-t border-border/40 bg-muted/10 flex items-center gap-1.5 overflow-x-auto shrink-0">
            {SLASH_COMMANDS.map((cmd) => (
              <Button
                key={cmd.cmd}
                variant="outline"
                size="sm"
                onClick={() => setInputValue(cmd.cmd + " ")}
                className="h-6 rounded-full px-2 text-[11px] font-mono text-muted-foreground hover:text-foreground shrink-0 border-border/60 hover:bg-background"
                title={cmd.desc}
              >
                {cmd.cmd}
              </Button>
            ))}
          </div>

          {/* Chat Input Bar */}
          <div className="p-3 border-t border-border/60 bg-background flex flex-col gap-1 shrink-0">
            <div className="flex items-center gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Nhập yêu cầu, ví dụ: 'cái thứ hai đổi 6 giờ, giao Lan', 'bỏ cái thứ năm'..."
                className="text-xs h-9 bg-background focus-visible:ring-primary/40"
                disabled={isAiLoading}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <Button
                size="sm"
                onClick={() => handleSendMessage()}
                disabled={isAiLoading || !inputValue.trim()}
                className="h-9 px-3.5 gap-1.5 shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-xs">Gửi</span>
              </Button>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
              <span>Nhấn <b>Enter</b> hoặc <b>⌘Enter</b> để gửi tin</span>
              <span className="font-mono">Tự động đối chiếu DANH TÍNH & Chính sách</span>
            </div>
          </div>
        </main>

        {/* ================= COLUMN 3: DRAFT RAIL (>= 1024px, Sheet on < 1024px) ================= */}
        <aside className="hidden lg:flex w-[420px] shrink-0 flex-col rounded-xl border border-border/80 bg-card/70 overflow-hidden shadow-xs">
          <DraftRailContent
            proposals={activeProposals}
            totalOpenDrafts={totalOpenDrafts}
            onApplyProposal={handleApplyProposal}
            onDiscardItem={handleDiscardItem}
            onUpdateItemManual={handleUpdateItemManual}
            onOpenAppliedTask={handleOpenAppliedTask}
            selectedDraftKeys={selectedDraftKeys}
            onToggleSelectDraftKey={(key) =>
              setSelectedDraftKeys((prev) => ({ ...prev, [key]: !prev[key] }))
            }
            versionConflictAlert={versionConflictAlert}
            onReloadProposals={() => {
              setVersionConflictAlert(false);
              toast.success("Đã đồng bộ lại phiên bản bản nháp mới nhất từ server");
            }}
            highlightedApplyBtn={highlightedApplyBtn}
            draftItemRefs={draftItemRefs}
          />
        </aside>

        {/* Sheet for Draft Rail on Mobile/Tablet (< 1024px) */}
        <Sheet open={draftRailSheetOpen} onOpenChange={setDraftRailSheetOpen}>
          <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
            <SheetHeader className="p-4 border-b border-border/60">
              <SheetTitle className="text-sm font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4 text-info" />
                <span>Bản nháp trong phiên ({totalOpenDrafts})</span>
              </SheetTitle>
              <SheetDescription className="text-xs">
                Nguồn sự thật duy nhất. Duyệt tại đây để khởi tạo công việc chính thức.
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-hidden">
              <DraftRailContent
                proposals={activeProposals}
                totalOpenDrafts={totalOpenDrafts}
                onApplyProposal={handleApplyProposal}
                onDiscardItem={handleDiscardItem}
                onUpdateItemManual={handleUpdateItemManual}
                onOpenAppliedTask={handleOpenAppliedTask}
                selectedDraftKeys={selectedDraftKeys}
                onToggleSelectDraftKey={(key) =>
                  setSelectedDraftKeys((prev) => ({ ...prev, [key]: !prev[key] }))
                }
                versionConflictAlert={versionConflictAlert}
                onReloadProposals={() => {
                  setVersionConflictAlert(false);
                  toast.success("Đã đồng bộ lại phiên bản mới nhất từ server");
                }}
                highlightedApplyBtn={highlightedApplyBtn}
                draftItemRefs={draftItemRefs}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Floating Action Button for Draft Rail on Mobile (< 1024px) */}
      <div className="lg:hidden fixed bottom-4 right-4 z-40">
        <Button
          onClick={() => setDraftRailSheetOpen(true)}
          className="rounded-full shadow-lg h-11 px-4 gap-2 bg-primary text-primary-foreground border border-primary/20"
        >
          <Layers className="h-4 w-4" />
          <span className="text-xs font-semibold">Bản nháp</span>
          <Badge variant="secondary" className="ml-0.5 text-[10px] px-1.5 py-0">
            {totalOpenDrafts}
          </Badge>
        </Button>
      </div>

      {/* Modal Task Detail Sheet for Applied Tasks */}
      <TaskDetailSheet
        task={selectedTask}
        open={taskDetailOpen}
        onOpenChange={setTaskDetailOpen}
        onUpdateTask={(updated) => {
          setSelectedTask(updated);
          toast.success(`Đã cập nhật chi tiết ${updated.code}`);
        }}
      />
    </div>
  );
}

// ================= SUB-COMPONENT: SESSION SIDEBAR =================
interface SessionSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onToggleArchive: (id: string, e: React.MouseEvent) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  showArchived: boolean;
  onToggleShowArchived: () => void;
}

function SessionSidebarContent({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onToggleArchive,
  searchQuery,
  onSearchChange,
  showArchived,
  onToggleShowArchived,
}: SessionSidebarProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Top action: New Session */}
      <div className="p-3 border-b border-border/60 space-y-2">
        <Button
          onClick={onCreateSession}
          size="sm"
          className="w-full justify-center gap-1.5 text-xs h-8"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Phiên mới</span>
        </Button>

        {/* Search input */}
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm phiên..."
            className="text-xs h-8 pl-8 bg-background"
          />
        </div>
      </div>

      {/* Sessions List */}
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-1">
          {sessions.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Không tìm thấy phiên làm việc phù hợp.
            </div>
          ) : (
            sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              return (
                <div
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  className={cn(
                    "p-2.5 rounded-lg text-xs transition-colors cursor-pointer group flex flex-col gap-1 border border-transparent",
                    isActive
                      ? "bg-primary/10 border-primary/20 text-foreground font-medium"
                      : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <span
                      className={cn(
                        "line-clamp-2 text-xs flex-1",
                        isActive ? "font-semibold text-foreground" : "text-foreground/90"
                      )}
                    >
                      {session.title}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => onToggleArchive(session.id, e)}
                      className="h-5 w-5 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      title={session.archived ? "Bỏ lưu trữ" : "Lưu trữ phiên"}
                    >
                      {session.archived ? (
                        <ArchiveRestore className="h-3 w-3" />
                      ) : (
                        <Archive className="h-3 w-3" />
                      )}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                    <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono">
                      {session.kind}
                    </Badge>
                    <div className="flex items-center gap-1.5">
                      <span>{session.createdAt}</span>
                      {session.openDraftCount > 0 && (
                        <Badge
                          variant="info"
                          className="text-[9px] px-1 py-0 font-mono h-3.5"
                        >
                          {session.openDraftCount} nháp
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Footer: Archive Toggle */}
      <div className="p-2 border-t border-border/60 bg-muted/20">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleShowArchived}
          className="w-full text-xs text-muted-foreground hover:text-foreground justify-between h-7"
        >
          <span className="flex items-center gap-1.5">
            <Archive className="h-3 w-3" />
            <span>{showArchived ? "Ẩn phiên đã lưu trữ" : "Hiện phiên đã lưu trữ"}</span>
          </span>
        </Button>
      </div>
    </div>
  );
}

// ================= SUB-COMPONENT: DRAFT RAIL =================
interface DraftRailProps {
  proposals: AIProposal[];
  totalOpenDrafts: number;
  onApplyProposal: (proposalId: string, keys?: string[]) => void;
  onDiscardItem: (proposalId: string, draftKey: string) => void;
  onUpdateItemManual: (
    proposalId: string,
    draftKey: string,
    patch: { title: string; estimateHours: number; assigneeId: string }
  ) => void;
  onOpenAppliedTask: (code: string, draftItem?: DraftItem) => void;
  selectedDraftKeys: Record<string, boolean>;
  onToggleSelectDraftKey: (key: string) => void;
  versionConflictAlert: boolean;
  onReloadProposals: () => void;
  highlightedApplyBtn: boolean;
  draftItemRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
}

function DraftRailContent({
  proposals,
  totalOpenDrafts,
  onApplyProposal,
  onDiscardItem,
  onUpdateItemManual,
  onOpenAppliedTask,
  selectedDraftKeys,
  onToggleSelectDraftKey,
  versionConflictAlert,
  onReloadProposals,
  highlightedApplyBtn,
  draftItemRefs,
}: DraftRailProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Rail Header */}
      <div className="p-3 border-b border-border/60 bg-muted/20 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-info" />
          <h3 className="text-xs font-semibold text-foreground">Bản nháp trong phiên</h3>
          <Badge variant="info" className="text-[10px] px-1.5 py-0 font-mono">
            {totalOpenDrafts} mở
          </Badge>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">Server SOT</span>
      </div>

      {/* Version Conflict Alert if triggered */}
      {versionConflictAlert && (
        <div className="p-3 bg-destructive/10 border-b border-destructive/20">
          <Alert variant="destructive" className="py-2 px-3">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="text-xs font-semibold">Xung đột phiên bản (409 Conflict)</AlertTitle>
            <AlertDescription className="text-[11px] leading-relaxed mt-0.5">
              Bản nháp đã được cập nhật ở tab hoặc phiên khác. Vui lòng tải lại dữ liệu để đảm bảo tính nhất quán.
            </AlertDescription>
            <Button
              variant="outline"
              size="sm"
              onClick={onReloadProposals}
              className="mt-2 h-6 text-[10px] gap-1 bg-background text-foreground"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Tải lại dữ liệu</span>
            </Button>
          </Alert>
        </div>
      )}

      {/* Rail Proposal Cards List */}
      <ScrollArea className="flex-1 p-3">
        {proposals.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
            <Layers className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <p>Chưa có đề xuất bản nháp nào trong phiên này.</p>
            <p className="text-[11px] text-muted-foreground/80">
              Hãy gửi tin nhắn trong khung chat để AI tự động phân rã WBS.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {proposals.map((proposal) => {
              const draftItems = proposal.items.filter((i) => i.status === "DRAFT");
              const selectedCountInProp = draftItems.filter((i) => selectedDraftKeys[i.draftKey]).length;

              return (
                <Card
                  key={proposal.id}
                  className={cn(
                    "border-border/80 bg-card overflow-hidden shadow-xs",
                    proposal.status === "APPLIED" && "border-success/40 bg-success/5"
                  )}
                >
                  {/* Proposal Header */}
                  <CardHeader className="p-3 pb-2 border-b border-border/40 bg-muted/10">
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 truncate">
                        <Badge
                          variant={proposal.status === "APPLIED" ? "success" : "info"}
                          className="text-[9px] px-1 py-0 uppercase font-mono"
                        >
                          {proposal.kind}
                        </Badge>
                        <CardTitle className="text-xs font-semibold truncate text-foreground">
                          {proposal.title}
                        </CardTitle>
                      </div>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono shrink-0">
                        v{proposal.version}
                      </Badge>
                    </div>
                    <CardDescription className="text-[10px] text-muted-foreground">
                      Tạo lúc {proposal.createdAt} · {proposal.items.length} hạng mục
                    </CardDescription>
                  </CardHeader>

                  {/* Proposal Items List */}
                  <CardContent className="p-2 space-y-2">
                    {proposal.items.map((item) => (
                      <DraftItemCard
                        key={item.draftKey}
                        item={item}
                        isSelected={!!selectedDraftKeys[item.draftKey]}
                        onToggleSelect={() => onToggleSelectDraftKey(item.draftKey)}
                        onDiscard={() => onDiscardItem(proposal.id, item.draftKey)}
                        onUpdateManual={(patch) =>
                          onUpdateItemManual(proposal.id, item.draftKey, patch)
                        }
                        onOpenAppliedTask={() =>
                          item.appliedTaskId && onOpenAppliedTask(item.appliedTaskId, item)
                        }
                        refCallback={(el) => {
                          draftItemRefs.current[item.draftKey] = el;
                        }}
                      />
                    ))}
                  </CardContent>

                  {/* Proposal Action Footer: Approval Buttons */}
                  {draftItems.length > 0 && (
                    <CardFooter className="p-2.5 pt-0 border-t border-border/40 flex items-center justify-between gap-2 bg-muted/5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          draftItems.forEach((it) => onDiscardItem(proposal.id, it.draftKey));
                        }}
                        className="h-7 text-xs text-muted-foreground hover:text-destructive px-2"
                      >
                        Huỷ bỏ
                      </Button>

                      <div className="flex items-center gap-2">
                        {selectedCountInProp > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const keysToApply = draftItems
                                .filter((i) => selectedDraftKeys[i.draftKey])
                                .map((i) => i.draftKey);
                              onApplyProposal(proposal.id, keysToApply);
                            }}
                            className="h-7 text-xs gap-1 border-primary/40 text-primary"
                          >
                            <Check className="h-3 w-3" />
                            <span>Duyệt {selectedCountInProp} mục chọn</span>
                          </Button>
                        )}

                        <Button
                          size="sm"
                          onClick={() => onApplyProposal(proposal.id)}
                          className={cn(
                            "h-7 text-xs gap-1.5 transition-all",
                            highlightedApplyBtn &&
                              "ring-2 ring-primary ring-offset-2 animate-bounce font-bold"
                          )}
                        >
                          <Check className="h-3 w-3" />
                          <span>Duyệt {draftItems.length} mục</span>
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

// ================= SUB-COMPONENT: DRAFT ITEM CARD =================
interface DraftItemCardProps {
  item: DraftItem;
  isSelected: boolean;
  onToggleSelect: () => void;
  onDiscard: () => void;
  onUpdateManual: (patch: { title: string; estimateHours: number; assigneeId: string }) => void;
  onOpenAppliedTask: () => void;
  refCallback: (el: HTMLDivElement | null) => void;
}

function DraftItemCard({
  item,
  isSelected,
  onToggleSelect,
  onDiscard,
  onUpdateManual,
  onOpenAppliedTask,
  refCallback,
}: DraftItemCardProps) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState(item.title);
  const [editHours, setEditHours] = React.useState(item.estimateHours.toString());
  const [editAssigneeId, setEditAssigneeId] = React.useState(item.assigneeId);

  const isDiscarded = item.status === "DISCARDED";
  const isApplied = item.status === "APPLIED";

  const handleSaveManual = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateManual({
      title: editTitle.trim() || item.title,
      estimateHours: Number(editHours) || item.estimateHours,
      assigneeId: editAssigneeId,
    });
    setEditOpen(false);
  };

  return (
    <div
      ref={refCallback}
      className={cn(
        "p-2.5 rounded-lg border text-xs transition-all space-y-2",
        item.status === "DRAFT" && "border-info/40 bg-info/5 hover:border-info/70",
        isApplied && "border-success/40 bg-success/10 text-foreground",
        isDiscarded && "border-border/40 bg-muted/30 opacity-60",
        item.highlight && "ring-2 ring-info animate-pulse"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {item.status === "DRAFT" && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelect}
              className="mt-0.5"
            />
          )}

          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className="font-mono text-[9px] px-1 py-0 shrink-0">
                {item.draftKey}
              </Badge>

              {isApplied && item.appliedTaskId && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={onOpenAppliedTask}
                  className="h-5 p-0 text-success font-mono font-bold text-xs gap-1 hover:underline"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  <span>{item.appliedTaskId}</span>
                  <ExternalLink className="h-2.5 w-2.5" />
                </Button>
              )}

              {item.status === "DRAFT" && (
                <Badge variant="info" className="text-[9px] px-1 py-0">
                  AI · Chờ duyệt
                </Badge>
              )}

              {isDiscarded && (
                <Badge variant="secondary" className="text-[9px] px-1 py-0">
                  Đã loại bỏ
                </Badge>
              )}
            </div>

            <p
              className={cn(
                "text-xs leading-relaxed font-medium text-foreground",
                isDiscarded && "line-through text-muted-foreground"
              )}
            >
              {item.title}
            </p>
          </div>
        </div>

        {/* Action icons for Draft item */}
        {item.status === "DRAFT" && (
          <div className="flex items-center gap-0.5 shrink-0">
            {/* Popover Edit Manual */}
            <Popover open={editOpen} onOpenChange={setEditOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  title="Sửa tay thông tin"
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-3 text-xs space-y-3" align="end">
                <form onSubmit={handleSaveManual} className="space-y-2.5">
                  <h4 className="font-semibold text-foreground text-xs">
                    Chỉnh sửa bản nháp {item.draftKey}
                  </h4>
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground">
                      Tiêu đề công việc
                    </label>
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="text-xs h-8"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground">
                        Ước lượng (giờ)
                      </label>
                      <Input
                        type="number"
                        value={editHours}
                        onChange={(e) => setEditHours(e.target.value)}
                        className="text-xs h-8 font-mono"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground">
                        Người phụ trách
                      </label>
                      <select
                        value={editAssigneeId}
                        onChange={(e) => setEditAssigneeId(e.target.value)}
                        className="w-full h-8 text-xs rounded-md border border-border bg-background px-2"
                      >
                        {MEMBERS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.role})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditOpen(false)}
                      className="h-7 text-xs"
                    >
                      Đóng
                    </Button>
                    <Button type="submit" size="sm" className="h-7 text-xs">
                      Lưu bản nháp
                    </Button>
                  </div>
                </form>
              </PopoverContent>
            </Popover>

            {/* Discard button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onDiscard}
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              title="Loại bỏ bản nháp"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Item Meta: Hours, Assignee, Skills, Dependencies */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 font-mono font-medium text-foreground">
            <Clock className="h-3 w-3 text-muted-foreground" />
            {item.estimateHours}h
          </span>
          <div className="flex items-center gap-1">
            <UserAvatar
              name={item.assigneeName}
              role={item.assigneeRole}
              initials={item.assigneeName.slice(0, 2).toUpperCase()}
              size="sm"
            />
            <span className="truncate max-w-[80px]">{item.assigneeName}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {item.dependencies.length > 0 && (
            <span className="text-[10px] text-muted-foreground">
              sau {item.dependencies.join(", ")}
            </span>
          )}
          {item.skills.length > 0 && (
            <Badge variant="outline" className="text-[9px] px-1 py-0">
              {item.skills[0].name}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
