"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DraftPatch } from "@smarttask/shared";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { AiConfigItem, ApplyResponse, ChatSessionView, ChatTurnResponse, ProposalView, QuotaView, SessionDetail } from "@/lib/types";

/** Khoá query cho chat (docs 12 §5): danh sách phiên theo dự án, chi tiết phiên (session + messages + proposals). */
export const aiKeys = {
  sessions: (projectId: string, archived: boolean) => ["ai", "sessions", projectId, archived] as const,
  session: (id: string) => ["ai", "session", id] as const,
  quota: (wsId: string) => ["ai", "quota", wsId] as const,
};

export function useSessions(projectId: string, includeArchived: boolean) {
  return useQuery({
    queryKey: aiKeys.sessions(projectId, includeArchived),
    queryFn: () => api.get<ChatSessionView[]>("/ai/sessions", { projectId, includeArchived }),
  });
}

/** Mở phiên: một request trả đủ; rail vẽ TỪ `proposals` server — không giữ nháp trong localStorage. */
export function useSessionDetail(sessionId: string | null) {
  return useQuery({
    queryKey: aiKeys.session(sessionId ?? ""),
    queryFn: () => api.get<SessionDetail>(`/ai/sessions/${sessionId}`),
    enabled: !!sessionId,
  });
}

export function useQuota(wsId: string) {
  return useQuery({ queryKey: aiKeys.quota(wsId), queryFn: () => api.get<QuotaView>("/ai/quota", { workspaceId: wsId }), staleTime: 60_000 });
}

/**
 * Model đang dùng cho lượt chat, đọc từ cấu hình AI của workspace (CHAT → GENERAL → mặc định .env).
 * Nhờ vậy nhãn model hiển thị đúng ngay khi mở/tải lại trang, không phải đợi gửi một lượt.
 */
export function useChatModelLabel(wsId: string): string | null {
  const q = useQuery({
    queryKey: ["workspaces", wsId, "ai-configs"],
    queryFn: () => api.get<AiConfigItem[]>(`/workspaces/${wsId}/ai-configs`),
    enabled: !!wsId,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const list = (q.data ?? []).filter((c) => c.isActive);
  const pick = list.find((c) => c.purpose === "CHAT") ?? list.find((c) => c.purpose === "GENERAL");
  return pick ? `${pick.catalog.provider} · ${pick.catalog.model}` : null;
}

/** Thay proposal trong cache chi tiết phiên (sau apply/patch/socket). */
export function useProposalCache() {
  const qc = useQueryClient();
  return React.useCallback(
    (sessionId: string, next: ProposalView) => {
      qc.setQueryData<SessionDetail>(aiKeys.session(sessionId), (cur) => {
        if (!cur) return cur;
        const exists = cur.proposals.some((p) => p.id === next.id);
        return {
          ...cur,
          proposals: exists ? cur.proposals.map((p) => (p.id === next.id ? next : p)) : [...cur.proposals, next],
        };
      });
    },
    [qc],
  );
}

export function useChatTurn(projectId: string, wsId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { sessionId?: string; text: string; selectedCode?: string; sprintId?: string }) =>
      api.post<ChatTurnResponse>("/ai/chat", { projectId, ...body }),
    onSuccess: (res, vars) => {
      // Thêm tin người + tin trợ lý, THAY toàn bộ proposals của phiên bằng mảng server trả (UI không merge)
      qc.setQueryData<SessionDetail>(aiKeys.session(res.sessionId), (cur) => ({
        session: res.session,
        messages: [
          ...(cur?.messages ?? []),
          { id: res.userMessageId, role: "USER", text: vars.text, structuredData: null, createdAt: res.message.createdAt },
          { id: res.message.id, role: "ASSISTANT", text: res.message.text, structuredData: res.action, createdAt: res.message.createdAt },
        ],
        proposals: res.proposals,
      }));
      void qc.invalidateQueries({ queryKey: ["ai", "sessions", projectId] });
      void qc.invalidateQueries({ queryKey: aiKeys.quota(wsId) });
    },
  });
}

export function useApplyProposal(sessionId: string | null) {
  const setProposal = useProposalCache();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { proposalId: string; draftKeys?: string[]; version: number }) =>
      api.post<ApplyResponse>(`/ai/proposals/${v.proposalId}/apply`, { draftKeys: v.draftKeys, version: v.version }),
    onSuccess: (res) => {
      if (sessionId) setProposal(sessionId, res.proposal);
      void qc.invalidateQueries({ queryKey: ["projects", res.proposal.projectId, "tasks"] });
      void qc.invalidateQueries({ queryKey: ["ai", "sessions", res.proposal.projectId] });
    },
  });
}

export function useRejectProposal(sessionId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { proposalId: string; draftKeys?: string[]; reason?: string }) =>
      api.post<void>(`/ai/proposals/${v.proposalId}/reject`, { draftKeys: v.draftKeys, reason: v.reason }),
    onSuccess: async () => {
      if (!sessionId) return;
      const proposals = await api.get<ProposalView[]>(`/ai/sessions/${sessionId}/proposals`);
      qc.setQueryData<SessionDetail>(aiKeys.session(sessionId), (cur) => (cur ? { ...cur, proposals } : cur));
      void qc.invalidateQueries({ queryKey: ["ai", "sessions"] });
    },
  });
}

export function usePatchItem(sessionId: string | null) {
  const setProposal = useProposalCache();
  return useMutation({
    mutationFn: (v: { proposalId: string; draftKey: string; patch: DraftPatch; version: number }) =>
      api.patch<ProposalView>(`/ai/proposals/${v.proposalId}/items/${v.draftKey}`, { patch: v.patch, version: v.version }),
    onSuccess: (res) => {
      if (sessionId) setProposal(sessionId, res);
    },
  });
}

export function useSessionMutations(projectId: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["ai", "sessions", projectId] });
  const create = useMutation({
    mutationFn: (title?: string) => api.post<ChatSessionView>("/ai/sessions", { projectId, title }),
    onSuccess: invalidate,
  });
  const patch = useMutation({
    mutationFn: (v: { id: string; title?: string; archived?: boolean }) => api.patch<ChatSessionView>(`/ai/sessions/${v.id}`, { title: v.title, archived: v.archived }),
    onSuccess: (s) => {
      qc.setQueryData<SessionDetail>(aiKeys.session(s.id), (cur) => (cur ? { ...cur, session: s } : cur));
      void invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/ai/sessions/${id}`),
    onSuccess: (_r, id) => {
      qc.removeQueries({ queryKey: aiKeys.session(id) });
      void invalidate();
    },
  });
  return { create, patch, remove };
}

/** Socket `ai:proposal:updated` / `ai:session:updated` tới user:{id} (docs 12 §5) — tab khác thấy thẻ đổi màu. */
export function useAssistantRealtime(projectId: string, activeSessionId: string | null) {
  const qc = useQueryClient();
  const setProposal = useProposalCache();
  React.useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const onProposal = (p: { sessionId: string | null; projectId: string; proposal: ProposalView }) => {
      if (p.sessionId) setProposal(p.sessionId, p.proposal);
    };
    const onSession = (p: { sessionId: string; projectId: string | null; change: string }) => {
      void qc.invalidateQueries({ queryKey: ["ai", "sessions", projectId] });
      if (p.change === "turn" && p.sessionId === activeSessionId) void qc.invalidateQueries({ queryKey: aiKeys.session(p.sessionId) });
    };
    s.on("ai:proposal:updated", onProposal);
    s.on("ai:session:updated", onSession);
    return () => {
      s.off("ai:proposal:updated", onProposal);
      s.off("ai:session:updated", onSession);
    };
  }, [qc, setProposal, projectId, activeSessionId]);
}
