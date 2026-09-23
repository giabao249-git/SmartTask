/**
 * Kiểu dữ liệu trả về của API (theo Swagger /docs và docs/04-kien-truc/11). Chỉ những trường web dùng;
 * structured action & mã lỗi lấy từ @smarttask/shared, KHÔNG định nghĩa lại ở đây.
 */
import type { StructuredAction, ValidationResult, DraftItemStatus } from "@smarttask/shared";

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
export type ProjectRole = "PM" | "MEMBER";
export type PlatformRole = "ROOT_ADMIN" | "FINOPS_OPERATOR" | "CUSTOMER_SUPPORT" | "SECURITY_AUDITOR";
export type WorkspaceLifecycleStatus = "ACTIVE" | "WARNING_GRACE" | "READ_ONLY_ENFORCED" | "SOFT_SUSPENDED" | "COLD_STORAGE_ARCHIVED" | "PURGED";

export interface UserView {
  id: string;
  email: string;
  fullName: string;
  shortName: string | null;
  avatarUrl: string | null;
  timezone: string;
  weeklyCapacityHours: number | null;
  notificationPrefs?: NotificationPrefs | null;
  isSuperAdmin?: boolean;
  platformRole?: PlatformRole | null;
}

export type NotificationPrefKey = "taskAssigned" | "mentioned" | "taskDue" | "workloadAlert" | "sprint";
export interface NotificationPrefs {
  inApp?: Partial<Record<NotificationPrefKey, boolean>>;
  push?: Partial<Record<NotificationPrefKey, boolean>>;
}

export interface InvitationPreview {
  workspaceName: string;
  workspaceSlug: string;
  role: WorkspaceRole;
  inviter: string;
  email: string | null;
  expiresAt: string;
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

export type AiProvider = "GEMINI" | "OPENAI" | "OLLAMA" | "DEEPSEEK";
export type AiPurpose = "GENERAL" | "DECOMPOSE" | "ASSIGN" | "EXPLAIN" | "CHAT";
export type AiCacheMode = "NONE" | "GEMINI_CACHED_CONTENTS" | "OPENAI_BREAKPOINT";

export interface AiModelCatalogItem {
  id: string;
  provider: AiProvider;
  model: string;
  label: string;
  inputPrice: number;
  outputPrice: number;
  cachedInputPrice: number | null;
  priceEffectiveFrom: string | null;
  contextWindow: number | null;
  isReasoning: boolean;
  supportsTemperature: boolean;
  supportsStructuredOutput: boolean;
  supportsVision: boolean;
  maxOutputTokenParam: string;
  cacheMode: AiCacheMode;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AiConfigItem {
  id: string;
  workspaceId: string | null;
  name: string;
  catalogId: string;
  apiKeyMasked: string;
  hasApiKey: boolean;
  /** Không có khoá riêng nhưng máy chủ có khoá hệ thống cho nhà cung cấp này */
  usesSystemKey?: boolean;
  baseUrl: string | null;
  purpose: AiPurpose;
  advancedParams: {
    temperature?: number;
    maxOutputTokens?: number;
    promptCache?: { enabled: boolean; ttlSeconds?: number; minStaticChars?: number };
    trace?: { enabled: boolean };
  } | null;
  timeoutMs: number;
  isDefault: boolean;
  isActive: boolean;
  notes: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  catalog: {
    id: string;
    provider: AiProvider;
    model: string;
    label: string;
    inputPrice: number;
    outputPrice: number;
    cachedInputPrice: number | null;
    isReasoning: boolean;
    supportsTemperature: boolean;
    supportsStructuredOutput: boolean;
    maxOutputTokenParam?: string;
    cacheMode?: AiCacheMode;
    isActive?: boolean;
  };
}

export interface AiTestResult {
  ok: boolean;
  latencyMs: number;
  provider: string;
  model: string;
  reply?: string;
  error?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
  };
}

export interface AiUsageReport {
  from: string;
  to: string;
  groupBy: "day" | "purpose" | "user";
  usdVnd: number;
  rows: {
    key: string;
    label: string;
    calls: number;
    tokens: number;
    inputTokens: number;
    cachedTokens: number;
    outputTokens: number;
    costUsd: number;
    costVnd: number;
    durationMs: number;
    errors: number;
    avgMs: number;
    errorRate: number;
    cachedRate: number;
  }[];
  totals: {
    calls: number;
    tokens: number;
    cachedTokens: number;
    costUsd: number;
    costVnd: number;
    errors: number;
    durationMs: number;
    errorRate: number;
    avgMs: number;
  };
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
export type TaskType = "STORY" | "TASK" | "BUG";

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
  type: TaskType;
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

// ── Dashboard / workload / kỹ năng / dự báo (docs 11 §3.4, 3.5, 3.9; số do backend tính) ──
export type WorkloadLevelApi = "NORMAL" | "HIGH" | "FULL" | "OVERLOAD";

export interface DashboardView {
  counts: { total: number; done: number; open: number; overdue: number; unassigned: number };
  byStatus: { columnId: string; name: string; statusKey: string; count: number }[];
  byAssignee: { userId: string; openTasks: number }[];
  workloadWeek: { userId: string; fullName: string; shortName: string | null; avatarUrl: string | null; utilization: number; level: WorkloadLevelApi; riskScore: number; effLoadHours: number; effCapacityHours: number }[];
  openAlerts: { id: string; userId: string; kind: string; weekStart: string; riskScore: number; user: { fullName: string } }[];
  burndownMini: { sprintId: string; name: string; startDate: string; endDate: string; scopeInitial: number | null; lastSnapshot: { date: string; remaining: number; scope: number } | null } | null;
}

export interface WeekLoadView {
  weekStart: string;
  loadHours: number;
  effLoadHours: number;
  capacityHours: number;
  effCapacityHours: number;
  meetingHours: number;
  timeOffHours: number;
  utilization: number;
  level: WorkloadLevelApi;
  riskScore: number;
  riskLabel: "NORMAL" | "WATCH" | "BURNOUT_RISK";
  riskBreakdown: Record<string, number>;
  switchPenalty: number;
  projectsOpen: number;
  tasks: { taskId: string; key: string; title: string; projectId: string; remainingHours: number; share: number; hoursInWeek: number; hoursEff: number; factors: { ear: number; difficulty: number; skillGap: number }; overdue: boolean; dueDate: string | null }[];
}

export interface WorkloadView {
  users: { userId: string; fullName: string; shortName: string | null; avatarUrl: string | null; weeks: WeekLoadView[] }[];
  spread: number;
  thresholds: { high: number; full: number; overload: number };
}

export interface CapacityTableView {
  generatedAt: string;
  window: { from: string; days: number };
  members: {
    userId: string;
    fullName: string;
    shortName: string | null;
    role: string;
    skills: { skillId: string; name: string; level: number }[];
    utilizationBefore: number;
    levelBefore: WorkloadLevelApi;
    projectsOpen: number;
    metrics: { ear: number; onTimeRate: number | null; sampleSize: number };
    freeByDay: { date: string; freeHours: number; busyHours: number; plannedHours: number; focusBlocks: number; isWorkday: boolean }[];
  }[];
  tasks: {
    taskId: string;
    key: string;
    title: string;
    remainingHours: number;
    difficulty: number;
    dueDate: string | null;
    dependsOnIds: string[];
    requiredSkills: { skillId: string; name: string; minLevel: number }[];
    perUser: { userId: string; hoursEff: number; skillMatch: { avg: number; missing: string[] }; freeBeforeDue: number | null }[];
  }[];
  spread: number;
}

export interface SkillMatrixView {
  users: { id: string; fullName: string; shortName: string | null; avatarUrl: string | null }[];
  skills: { id: string; name: string; category: string }[];
  cells: { userId: string; skillId: string; level: number; verified: boolean }[];
  busFactor: { skillId: string; name: string; holders: number }[];
  minLevel: number;
}

export interface BurndownView {
  sprintId: string;
  status: string;
  startDate: string;
  endDate: string;
  scopeInitial: number;
  ideal: { date: string; ideal: number }[];
  actual: { date: string; scope: number; remaining: number; completed: number }[];
  velocity: number;
  scopeCreepDays: string[];
}

export interface ForecastView {
  sprintId: string;
  status: string;
  endDate: string;
  remainingHours: number;
  velocity: number;
  eta: string | null;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
  sprintAgeWorkdays: number;
  causes: { code: string; count: number; taskIds?: string[]; userIds?: string[] }[];
}

export interface ExplainView {
  action: import("@smarttask/shared").StructuredAction;
  validation: import("@smarttask/shared").ValidationResult;
  usage: TurnUsage;
  forecast: ForecastView;
  cached: boolean;
  cachedUntil: string | null;
}

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

export interface WorkspaceSettingsView {
  defaultCapacityHours: number;
  workdays: number[];
  holidays: string[];
  workHours: { start: string; end: string };
  adminOverhead: number;
  workload: {
    thresholds: { high: number; full: number; overload: number };
    ear: { smoothingHours: number; windowWeeks: number };
    burnout: Record<string, number>;
    fairnessTarget: number;
  };
  ai: { dailyLimitPerUser: number; enabledPurposes: string[]; behaviorSignals: boolean };
  retention: Record<string, number>;
}

export interface InvitationView {
  id: string;
  email: string | null;
  role: WorkspaceRole;
  token: string;
  expiresAt: string;
  createdAt: string;
  invitedBy?: { id: string; fullName: string } | null;
}

export interface ActivityItem {
  id: string;
  taskId: string | null;
  taskKey: string | null;
  task: { title: string } | null;
  action: string;
  diff: Record<string, unknown> | null;
  source: "MANUAL" | "AI" | "SYSTEM";
  createdAt: string;
  actor: { id: string; fullName: string; shortName: string | null; avatarUrl: string | null } | null;
}

export interface PlatformStats {
  workspaces: {
    total: number;
    active: number;
    suspended: number;
  };
  users: {
    total: number;
    active: number;
    superAdmins: number;
  };
  tasks: {
    total: number;
    completed: number;
    completionRate: number;
  };
  aiFinOps: {
    totalCalls: number;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    totalCostUsd: number;
    totalCostVnd: number;
  };
  maintenance: {
    mode: "DISABLED" | "READ_ONLY" | "FULL";
    reason?: string;
    expectedDurationMinutes?: number;
    updatedAt: string;
    updatedBy?: string;
  };
}

export interface AdminWorkspaceItem {
  id: string;
  name: string;
  slug: string;
  status: WorkspaceLifecycleStatus;
  logoUrl?: string | null;
  owner: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl?: string | null;
  };
  suspendedAt?: string | null;
  suspendReason?: string | null;
  membersCount: number;
  projectsCount: number;
  aiCallsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserItem {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  isActive: boolean;
  isSuperAdmin: boolean;
  platformRole?: PlatformRole | null;
  lastLoginAt?: string | null;
  createdAt: string;
  workspacesCount: number;
  ownedWorkspacesCount: number;
}

export interface SystemAuditLogItem {
  id: string;
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  reason?: string | null;
  previousHash: string;
  currentHash: string;
  createdAt: string;
}

export interface SystemTelemetry {
  status: string;
  uptimeSeconds: number;
  system: {
    platform: string;
    arch: string;
    cpuCores: number;
    freeMemMb: number;
    totalMemMb: number;
  };
  process: {
    nodeVersion: string;
    pid: number;
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
  };
  database: {
    provider: string;
    status: string;
  };
  maintenance: {
    mode: "DISABLED" | "READ_ONLY" | "FULL";
    reason?: string;
    expectedDurationMinutes?: number;
    updatedAt: string;
    updatedBy?: string;
  };
}


export interface AiCallLogItem {
  id: string;
  createdAt: string;
  endpoint: string;
  purpose: AiPurpose;
  provider: AiProvider;
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  durationMs: number;
  status: "SUCCESS" | "ERROR" | "INVALID_OUTPUT" | "QUOTA" | "TIMEOUT";
  errorMessage: string | null;
  userMessage: string | null;
  masterPromptVersion: number | null;
  workspacePromptVersion: number | null;
  user: { id: string; fullName: string; shortName: string | null } | null;
  costUsd: number;
  costVnd: number;
}

export interface AiCallLogPage {
  from: string;
  to: string;
  usdVnd: number;
  page: number;
  limit: number;
  total: number;
  items: AiCallLogItem[];
}
