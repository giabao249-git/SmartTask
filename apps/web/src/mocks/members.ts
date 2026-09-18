export interface Member {
  id: string;
  name: string;
  email: string;
  role: "PM" | "Backend" | "Frontend" | "QA" | "Fullstack";
  avatar: string;
  initials: string;
  color: string;
  utilization: number; // % (e.g. 62, 96, 118, 45, 30)
  burnoutScore: number; // 0-100
  burnoutLevel: "NORMAL" | "MONITOR" | "WARNING";
  weeklyCapacity: number; // h (40)
  effectiveLoad: number; // h
  effectiveCapacity: number; // h
  meetingHours: number; // h
  timeOffHours: number; // h
  skills: { name: string; level: number; verified: boolean }[];
  statusMessage?: string;
  isOnline: boolean;
}

export const CURRENT_WORKSPACE = {
  id: "ws-vnpt",
  name: "VNPT Dev Team",
  slug: "vnpt-dev-team",
  plan: "Enterprise",
  memberCount: 5,
  defaultCapacity: 40,
  workdays: ["T2", "T3", "T4", "T5", "T6"],
  workloadThresholds: {
    normal: 70,
    high: 90,
    overload: 110,
  },
  aiConfig: {
    provider: "Gemini",
    model: "gemini-1.5-pro",
    monthlyTokenQuota: 1000000,
    tokensUsed: 428600,
  },
};

export const CURRENT_PROJECT = {
  id: "proj-smarttask",
  name: "SmartTask v1",
  key: "ST",
  description: "Nền tảng quản trị dự án Agile/Kanban cân bằng tải & AI Agent",
  currentSprint: "Sprint 3 · 23/10–29/10",
  startDate: "2026-10-23",
  endDate: "2026-10-29",
  totalHours: 120,
  remainingHours: 58,
  forecastDate: "2026-10-31", // trễ 2 ngày
  riskLevel: "MEDIUM" as const, // Trung bình
};

export const MEMBERS: Member[] = [
  {
    id: "user-lan",
    name: "Lan",
    email: "lan.pm@vnpt.vn",
    role: "PM",
    avatar: "",
    initials: "LN",
    color: "bg-blue-600",
    utilization: 62,
    burnoutScore: 34,
    burnoutLevel: "NORMAL",
    weeklyCapacity: 40,
    effectiveLoad: 24.8,
    effectiveCapacity: 40,
    meetingHours: 8,
    timeOffHours: 0,
    isOnline: true,
    statusMessage: "Điều phối Sprint 3",
    skills: [
      { name: "Scrum & Agile", level: 5, verified: true },
      { name: "React", level: 4, verified: true },
      { name: "NestJS", level: 2, verified: true },
      { name: "Product Design", level: 4, verified: true },
    ],
  },
  {
    id: "user-minh",
    name: "Minh",
    email: "minh.be@vnpt.vn",
    role: "Backend",
    avatar: "",
    initials: "MH",
    color: "bg-emerald-600",
    utilization: 96,
    burnoutScore: 52,
    burnoutLevel: "MONITOR",
    weeklyCapacity: 40,
    effectiveLoad: 38.4,
    effectiveCapacity: 40,
    meetingHours: 4,
    timeOffHours: 0,
    isOnline: true,
    statusMessage: "Tối ưu hóa query PostgreSQL",
    skills: [
      { name: "NestJS", level: 4, verified: true },
      { name: "PostgreSQL", level: 3, verified: true },
      { name: "Docker", level: 3, verified: true },
      { name: "Redis", level: 4, verified: true },
    ],
  },
  {
    id: "user-huy",
    name: "Huy",
    email: "huy.fe@vnpt.vn",
    role: "Frontend",
    avatar: "",
    initials: "HY",
    color: "bg-amber-600",
    utilization: 118,
    burnoutScore: 74,
    burnoutLevel: "WARNING",
    weeklyCapacity: 40,
    effectiveLoad: 47.2,
    effectiveCapacity: 40,
    meetingHours: 3,
    timeOffHours: 0,
    isOnline: true,
    statusMessage: "Đang làm Kanban board",
    skills: [
      { name: "Next.js", level: 4, verified: true },
      { name: "shadcn/ui", level: 3, verified: true },
      { name: "TypeScript", level: 4, verified: true },
      { name: "Tailwind CSS", level: 4, verified: true },
    ],
  },
  {
    id: "user-thao",
    name: "Thảo",
    email: "thao.qa@vnpt.vn",
    role: "QA",
    avatar: "",
    initials: "TH",
    color: "bg-purple-600",
    utilization: 45,
    burnoutScore: 28,
    burnoutLevel: "NORMAL",
    weeklyCapacity: 40,
    effectiveLoad: 18,
    effectiveCapacity: 40,
    meetingHours: 4,
    timeOffHours: 0,
    isOnline: false,
    statusMessage: "Viết kịch bản Playwright E2E",
    skills: [
      { name: "Playwright", level: 3, verified: true },
      { name: "Manual Test", level: 4, verified: true },
      { name: "API Testing", level: 4, verified: true },
      { name: "Jest", level: 3, verified: true },
    ],
  },
  {
    id: "user-an",
    name: "An",
    email: "an.fs@vnpt.vn",
    role: "Fullstack",
    avatar: "",
    initials: "AN",
    color: "bg-rose-600",
    utilization: 30,
    burnoutScore: 22,
    burnoutLevel: "NORMAL",
    weeklyCapacity: 40,
    effectiveLoad: 12,
    effectiveCapacity: 40,
    meetingHours: 2,
    timeOffHours: 0,
    isOnline: true,
    statusMessage: "Sẵn sàng nhận thêm việc",
    skills: [
      { name: "React", level: 2, verified: false },
      { name: "Node.js", level: 2, verified: false },
      { name: "PostgreSQL", level: 2, verified: false },
      { name: "TypeScript", level: 2, verified: false },
    ],
  },
];
