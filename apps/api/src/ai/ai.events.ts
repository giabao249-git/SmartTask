export const AI_EVENTS = {
  proposalApplied: 'ai.proposal.applied',
} as const;

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
