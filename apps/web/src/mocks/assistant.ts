
export type ProposalKind =
  | "DECOMPOSE"
  | "TASK_DRAFT"
  | "TASK_UPDATE"
  | "REBALANCE"
  | "ASSIGN";

export type ProposalStatus = "DRAFT" | "APPLIED" | "REJECTED" | "EXPIRED";
export type DraftItemStatus = "DRAFT" | "APPLIED" | "DISCARDED";

export interface DraftItem {
  draftKey: string; // d1, d2, d7...
  title: string;
  estimateHours: number;
  assigneeId: string;
  assigneeName: string;
  assigneeRole: string;
  dueDate: string;
  skills: { name: string; level: number }[];
  dependencies: string[];
  status: DraftItemStatus;
  appliedTaskId?: string; // ST-31, ST-32... khi đã tạo
  highlight?: boolean; // Hiệu ứng nhấp sáng khi AI vừa vá
}

export interface AIProposal {
  id: string; // p1, p2...
  sessionId: string;
  kind: ProposalKind;
  title: string;
  createdAt: string;
  status: ProposalStatus;
  version: number;
  items: DraftItem[];
}

export interface ClarificationOption {
  code: string;
  label: string;
  department: string;
  role: string;
  avatar?: string;
}

export interface RiskExplanationData {
  velocityHoursPerDay: number;
  totalScopeHours: number;
  remainingHours: number;
  etaDate: string;
  delayDays: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  causes: string[];
}

export interface AssistantMessage {
  id: string;
  sender: "user" | "ai";
  timestamp: string;
  text: string;
  actionCode?:
    | "DECOMPOSE_PROPOSAL"
    | "CREATE_TASK_DRAFT"
    | "UPDATE_TASK_DRAFT"
    | "DISCARD_DRAFT"
    | "ASK_CLARIFICATION"
    | "RISK_EXPLANATION"
    | "CHAT_RESPONSE";
  clarification?: {
    question: string;
    options: ClarificationOption[];
    selectedCode?: string;
  };
  riskData?: RiskExplanationData;
  referencedDraftKeys?: string[];
  suggestApply?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  lastTurnAt: string;
  archived: boolean;
  kind: ProposalKind;
  openDraftCount: number;
}

export const INITIAL_SESSIONS: ChatSession[] = [
  {
    id: "session-sso",
    title: "Phân rã SSO Doanh nghiệp (Google & Azure AD)",
    createdAt: "24/10 08:15",
    lastTurnAt: "24/10 09:30",
    archived: false,
    kind: "DECOMPOSE",
    openDraftCount: 6,
  },
  {
    id: "session-rebalance",
    title: "Cân bằng tải cho Huy & Sprint 3",
    createdAt: "24/10 10:00",
    lastTurnAt: "24/10 10:45",
    archived: false,
    kind: "REBALANCE",
    openDraftCount: 2,
  },
  {
    id: "session-docs",
    title: "Kịch bản E2E Playwright và Swagger",
    createdAt: "23/10 14:20",
    lastTurnAt: "23/10 15:00",
    archived: true,
    kind: "TASK_DRAFT",
    openDraftCount: 0,
  },
];

export const INITIAL_PROPOSALS: Record<string, AIProposal[]> = {
  "session-sso": [
    {
      id: "p1",
      sessionId: "session-sso",
      kind: "DECOMPOSE",
      title: "Đề xuất phân rã: Phân hệ SSO Doanh nghiệp",
      createdAt: "Hôm nay, 08:30",
      status: "DRAFT",
      version: 1,
      items: [
        {
          draftKey: "d1",
          title: "Thiết kế schema bảng oauth_providers & oauth_tokens (AES-256)",
          estimateHours: 8,
          assigneeId: "user-minh",
          assigneeName: "Minh",
          assigneeRole: "Backend",
          dueDate: "2026-10-27",
          skills: [{ name: "PostgreSQL", level: 3 }],
          dependencies: [],
          status: "DRAFT",
        },
        {
          draftKey: "d2",
          title: "Hiện thực OAuth2 Strategy Google Workspace với Passport",
          estimateHours: 8,
          assigneeId: "user-minh",
          assigneeName: "Minh",
          assigneeRole: "Backend",
          dueDate: "2026-10-28",
          skills: [{ name: "NestJS", level: 4 }],
          dependencies: ["d1"],
          status: "DRAFT",
        },
        {
          draftKey: "d3",
          title: "Hiện thực OAuth2 OpenID Connect Strategy Azure AD",
          estimateHours: 8,
          assigneeId: "user-an",
          assigneeName: "An",
          assigneeRole: "Fullstack",
          dueDate: "2026-10-28",
          skills: [{ name: "Node.js", level: 2 }],
          dependencies: ["d1"],
          status: "DRAFT",
        },
        {
          draftKey: "d4",
          title: "Logic tự động mapping vai trò và phòng ban theo domain",
          estimateHours: 4,
          assigneeId: "user-an",
          assigneeName: "An",
          assigneeRole: "Fullstack",
          dueDate: "2026-10-29",
          skills: [{ name: "NestJS", level: 2 }],
          dependencies: ["d2", "d3"],
          status: "DRAFT",
        },
        {
          draftKey: "d5",
          title: "Component nút đăng nhập SSO 1-chạm chuẩn shadcn/ui",
          estimateHours: 4,
          assigneeId: "user-an",
          assigneeName: "An",
          assigneeRole: "Fullstack",
          dueDate: "2026-10-27",
          skills: [{ name: "React", level: 2 }],
          dependencies: [],
          status: "DRAFT",
        },
        {
          draftKey: "d6",
          title: "Trang callback OAuth2 và kiểm tra state chống CSRF",
          estimateHours: 6,
          assigneeId: "user-lan",
          assigneeName: "Lan",
          assigneeRole: "PM / Tech",
          dueDate: "2026-10-28",
          skills: [{ name: "Next.js", level: 3 }],
          dependencies: ["d5"],
          status: "DRAFT",
        },
      ],
    },
    {
      id: "p2",
      sessionId: "session-sso",
      kind: "TASK_DRAFT",
      title: "Bản nháp đã duyệt: Kịch bản kiểm thử & Tài liệu",
      createdAt: "Hôm qua, 15:45",
      status: "APPLIED",
      version: 2,
      items: [
        {
          draftKey: "d7",
          title: "Viết kịch bản Playwright E2E mô phỏng luồng đăng nhập Mock SSO",
          estimateHours: 8,
          assigneeId: "user-thao",
          assigneeName: "Thảo",
          assigneeRole: "QA",
          dueDate: "2026-10-29",
          skills: [{ name: "Playwright", level: 3 }],
          dependencies: ["d6"],
          status: "APPLIED",
          appliedTaskId: "ST-31",
        },
        {
          draftKey: "d8",
          title: "Cập nhật tài liệu OpenAPI Swagger và hướng dẫn cấu hình Client ID",
          estimateHours: 4,
          assigneeId: "user-lan",
          assigneeName: "Lan",
          assigneeRole: "PM",
          dueDate: "2026-10-29",
          skills: [{ name: "Scrum & Agile", level: 3 }],
          dependencies: ["d7"],
          status: "APPLIED",
          appliedTaskId: "ST-32",
        },
      ],
    },
  ],
  "session-rebalance": [
    {
      id: "p3",
      sessionId: "session-rebalance",
      kind: "REBALANCE",
      title: "Đề xuất cân bằng tải: Giảm áp lực cho Huy",
      createdAt: "Hôm nay, 10:00",
      status: "DRAFT",
      version: 1,
      items: [
        {
          draftKey: "d9",
          title: "Chuyển giao ST-16 (Ma trận Eisenhower) từ Huy sang An",
          estimateHours: 6,
          assigneeId: "user-an",
          assigneeName: "An",
          assigneeRole: "Fullstack",
          dueDate: "2026-10-29",
          skills: [{ name: "React", level: 2 }],
          dependencies: [],
          status: "DRAFT",
        },
        {
          draftKey: "d10",
          title: "Chuyển giao ST-9 (Sheet bảng sự thật) từ Huy sang An",
          estimateHours: 10,
          assigneeId: "user-an",
          assigneeName: "An",
          assigneeRole: "Fullstack",
          dueDate: "2026-10-30",
          skills: [{ name: "React", level: 2 }],
          dependencies: [],
          status: "DRAFT",
        },
      ],
    },
  ],
  "session-docs": [],
};

export const INITIAL_MESSAGES: Record<string, AssistantMessage[]> = {
  "session-sso": [
    {
      id: "m1",
      sender: "user",
      timestamp: "08:15",
      text: "Phân rã yêu cầu: Xây dựng phân hệ xác thực SSO đa nhà cung cấp Google Workspace và Microsoft Azure AD cho doanh nghiệp VNPT.",
    },
    {
      id: "m2",
      sender: "ai",
      timestamp: "08:16",
      text: "Tôi đã phân rã yêu cầu thành 6 công việc con (d1 đến d6) và tự động đối chiếu ma trận kỹ năng để giao việc. Bản nháp đã xuất hiện ở panel bên phải để bạn duyệt.",
      actionCode: "DECOMPOSE_PROPOSAL",
      referencedDraftKeys: ["d1", "d2", "d3", "d4", "d5", "d6"],
    },
    {
      id: "m3",
      sender: "user",
      timestamp: "08:20",
      text: "Tạo thêm task kiểm thử E2E và tài liệu Swagger cho sprint này",
    },
    {
      id: "m4",
      sender: "ai",
      timestamp: "08:21",
      text: "Đã tạo thêm 2 bản nháp d7 (E2E giao Thảo) và d8 (Swagger giao Lan). Cả hai mục này bạn đã duyệt hôm qua và đã tạo thành ST-31, ST-32.",
      actionCode: "CREATE_TASK_DRAFT",
      referencedDraftKeys: ["d7", "d8"],
    },
  ],
  "session-rebalance": [
    {
      id: "mb1",
      sender: "user",
      timestamp: "10:00",
      text: "Gỡ bớt cho Huy trong tuần này, Huy đang quá tải 118%",
    },
    {
      id: "mb2",
      sender: "ai",
      timestamp: "10:01",
      text: "Dựa trên phân tích giờ trống, An hiện mới đạt 30% tải. Tôi đề xuất chuyển ST-16 và ST-9 sang An. Sau khi chuyển, tải của Huy hạ về 88% và Spread giảm từ 41% về 18%.",
      actionCode: "DECOMPOSE_PROPOSAL",
      referencedDraftKeys: ["d9", "d10"],
    },
  ],
  "session-docs": [],
};

export const CLARIFICATION_BAO: ClarificationOption[] = [
  {
    code: "u5",
    label: "Phạm Bảo · QA",
    department: "Phòng Kiểm thử",
    role: "QA Engineer",
  },
  {
    code: "u6",
    label: "Lê Bảo · Fullstack",
    department: "Phòng Phát triển",
    role: "Fullstack Developer",
  },
];
