export const AI_EVENTS = {
  proposalApplied: 'ai.proposal.applied',
  /** Bản nháp trong phiên đổi (vá, bỏ, duyệt một phần) — tới user:{id} để tab thứ hai thấy thẻ đổi màu */
  proposalUpdated: 'ai.proposal.updated',
  sessionUpdated: 'ai.session.updated',
} as const;

export interface AiProposalUpdatedPayload {
  userId: string;
  sessionId: string | null;
  projectId: string;
  proposal: unknown;
  at: Date;
}

export interface AiSessionUpdatedPayload {
  userId: string;
  sessionId: string;
  projectId: string | null;
  /** created | turn | renamed | archived | deleted */
  change: string;
  at: Date;
}

export interface AiProposalAppliedPayload {
  proposalId: string;
  projectId: string;
  workspaceId: string;
  kind: string;
  taskIds: string[];
  /** Người được giao trong các task vừa tạo — để thông báo */
  assigneeIds: string[];
  actorId: string;
  at: Date;
}
