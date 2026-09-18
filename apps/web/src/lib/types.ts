/**
 * Kiểu dữ liệu trả về của API (theo Swagger /docs và docs/04-kien-truc/11). Chỉ những trường web dùng;
 * structured action & mã lỗi lấy từ @smarttask/shared, KHÔNG định nghĩa lại ở đây.
 */
import type { StructuredAction, ValidationResult, DraftItemStatus } from "@smarttask/shared";

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
export type ProjectRole = "PM" | "MEMBER";

export interface UserView {
  id: string;
  email: string;
  fullName: string;
  shortName: string | null;
  avatarUrl: string | null;
  timezone: string;
  weeklyCapacityHours: number | null;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  role: WorkspaceRole;
}

export interface MeResponse {
  user: UserView;
  workspaces: WorkspaceSummary[];
}

export interface WorkspaceListItem extends WorkspaceSummary {
  createdAt: string;
  joinedAt: string;
  _count: { members: number; projects: number };
}

export interface ProjectListItem {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "ARCHIVED";
  startDate: string | null;
  endDate: string | null;
  workspaceId: string;
  createdAt?: string;
  _count?: { members: number; tasks: number };
  activeSprint?: { id: string; name: string; startDate: string; endDate: string } | null;
  myRole?: ProjectRole | null;
}

export interface ProjectMember {
  id: string;
  fullName: string;
  shortName: string | null;
  avatarUrl: string | null;
  email?: string;
  role: ProjectRole;
  joinedAt: string;
}

export interface BoardColumn {
  id: string;
  projectId: string;
  name: string;
  statusKey: string;
  position: number;
  wipLimit: number | null;
  isDone: boolean;
}

export interface LabelView {
  id: string;
  name: string;
  color: string;
}

export interface ProjectDetail extends ProjectListItem {
  columns: BoardColumn[];
  labels: LabelView[];
  members: ProjectMember[];
  canManage: boolean;
  canEdit: boolean;
  _count?: { members: number; tasks: number };
}

// ── AI chat (docs 12 §5, phase-8 mục E) ─────────────────────
export type ProposalKind = "DECOMPOSE" | "TASK_DRAFT" | "TASK_UPDATE" | "ASSIGN" | "REBALANCE" | "RESCHEDULE";
export type ProposalStatus = "DRAFT" | "APPLIED" | "REJECTED" | "EXPIRED";

export interface ProposalItem {
  draftKey: string;
  title: string;
  estimateHours?: number | null;
  assignee?: string | null;
  task?: string | null;
  dependsOn?: string[];
  start?: string | null;
  due?: string | null;
  skills?: string[];
  extra?: string;
  status: DraftItemStatus;
  taskId: string | null;
  edited: boolean;
}

export interface CodeMap {
  users: Record<string, string>;
  tasks: Record<string, string>;
  sprints: Record<string, string>;
  skills: Record<string, string>;
  drafts?: Record<string, string>;
}

export interface ProposalView {
  id: string;
  projectId: string;
  userId: string;
  sessionId: string | null;
  messageId: string | null;
  kind: ProposalKind;
  status: ProposalStatus;
  version: number;
  request: { text?: string; requirement?: string; detail?: string; sprintId: string | null };
  action: StructuredAction;
  items: ProposalItem[];
  itemStatus: Record<string, DraftItemStatus>;
  appliedMap: Record<string, string>;
  applied: { taskIds: string[]; tasks: { draftKey: string; taskId: string; key: string }[] } | null;
  validation: ValidationResult | null;
  codeMap: CodeMap | null;
  appliedById: string | null;
  appliedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface ChatSessionView {
  id: string;
  projectId: string | null;
  workspaceId: string;
  title: string | null;
  nextDraftSeq: number;
  lastTurnAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  openDrafts?: number;
  openKinds?: ProposalKind[];
}

export interface ChatMessageView {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  text: string;
  structuredData: unknown;
  schemaVersion?: number;
  parseFailed?: boolean;
  createdAt: string;
}

export interface SessionDetail {
  session: ChatSessionView;
  messages: ChatMessageView[];
  proposals: ProposalView[];
}

export interface TurnUsage {
  provider: string;
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  durationMs: number;
  estimatedCost: number;
  attempts: number;
  promptChars: number;
}

export interface ChatTurnResponse {
  sessionId: string;
  session: ChatSessionView;
  message: { id: string; role: "ASSISTANT"; text: string; createdAt: string };
  userMessageId: string;
  action: StructuredAction;
  validation: ValidationResult | null;
  proposals: ProposalView[];
  usage: TurnUsage;
}

export interface ApplyResponse {
  proposalId: string;
  proposal: ProposalView;
  createdTaskIds: string[];
  createdTasks: { draftKey: string; taskId: string; key: string }[];
  idempotent: boolean;
}

export interface PromptView {
  type: "MASTER" | "WORKSPACE";
  content: string;
  version: number;
  changeNote: string | null;
  updatedAt: string | null;
  readOnly: boolean;
}

export interface MemberAlias {
  id: string;
  userId: string;
  alias: string;
  createdAt: string;
  user?: { fullName: string; shortName: string | null };
}

export interface WorkspaceMemberView {
  id: string;
  email: string;
  fullName: string;
  shortName: string | null;
  avatarUrl: string | null;
  role: WorkspaceRole;
  joinedAt: string;
  department?: string | null;
  title?: string | null;
  managerUserId?: string | null;
}

export interface SprintView {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  startDate: string;
  endDate: string;
  status: "PLANNED" | "ACTIVE" | "CLOSED";
  taskCount?: number;
  totalHours?: number;
}

export interface QuotaView {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
  timezone: string;
}

export interface SkillView {
  id: string;
  name: string;
  category: string;
  isActive: boolean;
  aliases: string[];
}

// ── Task (TasksService.toListView / toDetailView) ────────────
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface TaskUserRef {
  id: string;
  fullName: string;
  shortName: string | null;
  avatarUrl: string | null;
}

export interface TaskListItem {
  id: string;
  projectId: string;
  sprintId: string | null;
  parentId: string | null;
  columnId: string;
  number: number;
  key?: string;
  title: string;
  priority: TaskPriority;
  isUrgent: boolean;
  difficulty: number;
  size: "S" | "M" | "L" | "XL" | null;
  startDate: string | null;
  dueDate: string | null;
  estimateHours: number | null;
  remainingHours: number | null;
  progress: number;
  position: number;
  version: number;
  source: "MANUAL" | "AI";
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  assignees: TaskUserRef[];
  labels: LabelView[];
  requiredSkills: { id: string; name: string; minLevel: number }[];
  dependsOnIds: string[];
  subtaskCount: number;
  commentCount: number;
  attachmentCount: number;
}

export interface TaskDetail extends TaskListItem {
  key: string;
  description: string | null;
  createdAt: string;
  createdBy: TaskUserRef;
  column: { id: string; name: string; statusKey: string; isDone: boolean };
  sprint: { id: string; name: string; status: string } | null;
  parent: { id: string; number: number; title: string } | null;
  subtasks: TaskListItem[];
  dependentIds: string[];
}

export interface TaskListResponse {
  items: TaskListItem[];
  deletedIds: string[];
  serverTime: string;
}

export interface CommentView {
  id: string;
  taskId: string;
  parentId: string | null;
  body: string;
  editedAt: string | null;
  createdAt: string;
  author: TaskUserRef;
  mentions: { id: string; fullName: string; shortName: string | null }[];
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface AttachmentView {
  id: string;
  taskId: string;
  fileName: string;
  mime: string;
  sizeBytes: number;
  storagePath: string;
  uploader: TaskUserRef;
  createdAt: string;
}

export interface SuggestItem {
  id: string;
  fullName: string;
  shortName: string | null;
  email?: string;
  avatarUrl?: string | null;
}
