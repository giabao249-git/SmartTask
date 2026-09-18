export interface SkillDefinition {
  id: string;
  name: string;
  category: "Frontend" | "Backend" | "DevOps / DB" | "QA" | "Agile & Product";
  description: string;
  aliases: string[];
}

export const SKILL_DEFINITIONS: SkillDefinition[] = [
  { id: "sk-nextjs", name: "Next.js", category: "Frontend", description: "React Framework, App Router, SSR, Server Actions", aliases: ["Next", "NextJS", "React Server Components"] },
  { id: "sk-react", name: "React", category: "Frontend", description: "Thư viện UI React, Hooks, Context, State Management", aliases: ["ReactJS", "React.js"] },
  { id: "sk-shadcn", name: "shadcn/ui", category: "Frontend", description: "Radix UI Primitives, Tailwind CSS Tokens, CVA", aliases: ["shadcn", "radix", "tailwind components"] },
  { id: "sk-ts", name: "TypeScript", category: "Frontend", description: "Hệ thống kiểu tĩnh, Generics, Utility Types", aliases: ["TS", "Type Script"] },
  { id: "sk-tailwind", name: "Tailwind CSS", category: "Frontend", description: "Utility-first CSS, Design Tokens, Container Queries", aliases: ["Tailwind", "tw"] },
  { id: "sk-nestjs", name: "NestJS", category: "Backend", description: "Node.js Enterprise Framework, TypeScript, DI, Modules", aliases: ["Nest", "Nest.js"] },
  { id: "sk-postgres", name: "PostgreSQL", category: "DevOps / DB", description: "RDBMS, Indexing, Partitioning, Query Optimization, Prisma", aliases: ["Postgres", "SQL", "pg"] },
  { id: "sk-redis", name: "Redis", category: "DevOps / DB", description: "In-memory cache, pub/sub, rate limiting", aliases: ["Redis Cache", "Key-Value"] },
  { id: "sk-docker", name: "Docker", category: "DevOps / DB", description: "Containerization, Dockerfile, Compose, Multi-stage build", aliases: ["Container", "Docker Compose"] },
  { id: "sk-playwright", name: "Playwright", category: "QA", description: "E2E automated testing, cross-browser, visual regression", aliases: ["Playwright Test", "E2E"] },
  { id: "sk-jest", name: "Jest / Vitest", category: "QA", description: "Unit test, integration test, mock functions", aliases: ["Jest", "Unit Test", "Vitest"] },
  { id: "sk-agile", name: "Scrum & Agile", category: "Agile & Product", description: "Sprint planning, backlog refinement, velocity, retrospective", aliases: ["Scrum", "Kanban", "Agile Coach"] },
];

export interface MemberSkillRating {
  memberId: string;
  skillId: string;
  level: number; // 1 to 5
  verified: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
}

export const MEMBER_SKILLS_RATINGS: MemberSkillRating[] = [
  // Lan (PM)
  { memberId: "user-lan", skillId: "sk-agile", level: 5, verified: true, verifiedBy: "Ban Giám Đốc", verifiedAt: "01/09/2026" },
  { memberId: "user-lan", skillId: "sk-react", level: 4, verified: true, verifiedBy: "Ban Giám Đốc", verifiedAt: "01/09/2026" },
  { memberId: "user-lan", skillId: "sk-nestjs", level: 2, verified: true, verifiedBy: "Minh (Backend Lead)", verifiedAt: "10/09/2026" },
  { memberId: "user-lan", skillId: "sk-nextjs", level: 3, verified: true, verifiedBy: "Huy (Frontend Lead)", verifiedAt: "10/09/2026" },
  { memberId: "user-lan", skillId: "sk-ts", level: 3, verified: true, verifiedBy: "Huy (Frontend Lead)", verifiedAt: "10/09/2026" },

  // Minh (Backend)
  { memberId: "user-minh", skillId: "sk-nestjs", level: 4, verified: true, verifiedBy: "Lan (PM)", verifiedAt: "12/09/2026" },
  { memberId: "user-minh", skillId: "sk-postgres", level: 3, verified: true, verifiedBy: "Lan (PM)", verifiedAt: "12/09/2026" },
  { memberId: "user-minh", skillId: "sk-docker", level: 3, verified: true, verifiedBy: "Lan (PM)", verifiedAt: "12/09/2026" },
  { memberId: "user-minh", skillId: "sk-redis", level: 4, verified: true, verifiedBy: "Lan (PM)", verifiedAt: "12/09/2026" },
  { memberId: "user-minh", skillId: "sk-jest", level: 3, verified: false },

  // Huy (Frontend)
  { memberId: "user-huy", skillId: "sk-nextjs", level: 4, verified: true, verifiedBy: "Lan (PM)", verifiedAt: "15/09/2026" },
  { memberId: "user-huy", skillId: "sk-shadcn", level: 3, verified: true, verifiedBy: "Lan (PM)", verifiedAt: "15/09/2026" },
  { memberId: "user-huy", skillId: "sk-ts", level: 4, verified: true, verifiedBy: "Lan (PM)", verifiedAt: "15/09/2026" },
  { memberId: "user-huy", skillId: "sk-tailwind", level: 4, verified: true, verifiedBy: "Lan (PM)", verifiedAt: "15/09/2026" },
  { memberId: "user-huy", skillId: "sk-react", level: 4, verified: true, verifiedBy: "Lan (PM)", verifiedAt: "15/09/2026" },

  // Thảo (QA)
  { memberId: "user-thao", skillId: "sk-playwright", level: 3, verified: true, verifiedBy: "Lan (PM)", verifiedAt: "18/09/2026" },
  { memberId: "user-thao", skillId: "sk-jest", level: 3, verified: true, verifiedBy: "Lan (PM)", verifiedAt: "18/09/2026" },
  { memberId: "user-thao", skillId: "sk-agile", level: 3, verified: true, verifiedBy: "Lan (PM)", verifiedAt: "18/09/2026" },

  // An (Fullstack - mới)
  { memberId: "user-an", skillId: "sk-react", level: 2, verified: false },
  { memberId: "user-an", skillId: "sk-nestjs", level: 2, verified: false },
  { memberId: "user-an", skillId: "sk-postgres", level: 2, verified: false },
  { memberId: "user-an", skillId: "sk-ts", level: 2, verified: false },
  { memberId: "user-an", skillId: "sk-tailwind", level: 2, verified: false },
];
