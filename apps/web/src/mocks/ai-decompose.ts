export interface DecomposedTaskItem {
  id: string;
  selected: boolean;
  title: string;
  estimateHours: number;
  requiredSkills: { name: string; level: number }[];
  dependencies: string[];
  suggestedAssigneeId: string;
  suggestedAssigneeName: string;
  suggestedAssigneeRole: string;
  currentWorkload: number;
  postAssignWorkload: number; // e.g. An 30% -> 48%
  assignmentRationale: string;
}

export const DEFAULT_AI_PROMPT = 
`Xây dựng phân hệ xác thực SSO đa nhà cung cấp (Google Workspace và Microsoft Azure AD) cho doanh nghiệp. 
Cần lưu trữ Refresh Token mã hoá AES-256 trong PostgreSQL, hỗ trợ tự động gán role (Admin/Member) theo domain email @vnpt.vn. 
Giao diện Next.js cần có nút đăng nhập 1 chạm, xử lý callback an toàn chống CSRF và viết kịch bản Playwright kiểm thử tự động.`;

export const MOCK_DECOMPOSED_TASKS: DecomposedTaskItem[] = [
  {
    id: "dec-1",
    selected: true,
    title: "Thiết kế bảng oauth_providers và oauth_tokens với mã hoá AES-256",
    estimateHours: 6,
    requiredSkills: [{ name: "PostgreSQL", level: 3 }, { name: "NestJS", level: 3 }],
    dependencies: [],
    suggestedAssigneeId: "user-minh",
    suggestedAssigneeName: "Minh",
    suggestedAssigneeRole: "Backend",
    currentWorkload: 96,
    postAssignWorkload: 104,
    assignmentRationale: "Thành viên nắm vững kiến trúc DB và mã hoá token, tải sau nhận đạt 104% (chấp nhận trong hạn định).",
  },
  {
    id: "dec-2",
    selected: true,
    title: "Hiện thực OAuth2 Strategy cho Google Workspace với NestJS Passport",
    estimateHours: 8,
    requiredSkills: [{ name: "NestJS", level: 4 }],
    dependencies: ["dec-1"],
    suggestedAssigneeId: "user-minh",
    suggestedAssigneeName: "Minh",
    suggestedAssigneeRole: "Backend",
    currentWorkload: 96,
    postAssignWorkload: 108,
    assignmentRationale: "Chuyên gia NestJS của nhóm, có sẵn module Passport JWT từ ST-14.",
  },
  {
    id: "dec-3",
    selected: true,
    title: "Hiện thực OAuth2 OpenID Connect Strategy cho Microsoft Azure AD",
    estimateHours: 8,
    requiredSkills: [{ name: "Node.js", level: 2 }, { name: "NestJS", level: 2 }],
    dependencies: ["dec-1"],
    suggestedAssigneeId: "user-an",
    suggestedAssigneeName: "An",
    suggestedAssigneeRole: "Fullstack",
    currentWorkload: 30,
    postAssignWorkload: 45,
    assignmentRationale: "Giao việc cho An để cân bằng tải; An có kỹ năng Node.js 2/5 và được Minh hỗ trợ review.",
  },
  {
    id: "dec-4",
    selected: true,
    title: "Xây dựng logic tự động mapping vai trò và phòng ban theo domain email",
    estimateHours: 4,
    requiredSkills: [{ name: "NestJS", level: 2 }, { name: "PostgreSQL", level: 2 }],
    dependencies: ["dec-2", "dec-3"],
    suggestedAssigneeId: "user-an",
    suggestedAssigneeName: "An",
    suggestedAssigneeRole: "Fullstack",
    currentWorkload: 30,
    postAssignWorkload: 52,
    assignmentRationale: "Tải hiện tại của An chỉ 30%, có nhiều focus blocks trống trong tuần tới.",
  },
  {
    id: "dec-5",
    selected: true,
    title: "Thiết kế component nút đăng nhập SSO 1-chạm chuẩn shadcn/ui",
    estimateHours: 4,
    requiredSkills: [{ name: "React", level: 2 }, { name: "Tailwind CSS", level: 2 }],
    dependencies: [],
    suggestedAssigneeId: "user-an",
    suggestedAssigneeName: "An",
    suggestedAssigneeRole: "Fullstack",
    currentWorkload: 30,
    postAssignWorkload: 58,
    assignmentRationale: "Tránh giao cho Huy vì Huy đang quá tải 118%; An đáp ứng tốt kỹ năng UI cơ bản.",
  },
  {
    id: "dec-6",
    selected: true,
    title: "Trang xử lý Callback OAuth2 với state validation chống tấn công CSRF",
    estimateHours: 6,
    requiredSkills: [{ name: "Next.js", level: 3 }, { name: "TypeScript", level: 3 }],
    dependencies: ["dec-5"],
    suggestedAssigneeId: "user-lan",
    suggestedAssigneeName: "Lan",
    suggestedAssigneeRole: "PM / Tech",
    currentWorkload: 62,
    postAssignWorkload: 72,
    assignmentRationale: "Lan có kỹ năng React/TS 4/5 và tải tuần chỉ 62%, hỗ trợ team tăng tốc chốt luồng bảo mật.",
  },
  {
    id: "dec-7",
    selected: true,
    title: "Dialog liên kết tài khoản SSO khi phát hiện email trùng lặp",
    estimateHours: 6,
    requiredSkills: [{ name: "shadcn/ui", level: 2 }, { name: "React", level: 2 }],
    dependencies: ["dec-6"],
    suggestedAssigneeId: "user-an",
    suggestedAssigneeName: "An",
    suggestedAssigneeRole: "Fullstack",
    currentWorkload: 30,
    postAssignWorkload: 68,
    assignmentRationale: "Phù hợp với năng lực của An, giúp nâng tải tuần lên mức tối ưu 68%.",
  },
  {
    id: "dec-8",
    selected: true,
    title: "Viết kịch bản Playwright E2E mô phỏng luồng đăng nhập Mock SSO",
    estimateHours: 8,
    requiredSkills: [{ name: "Playwright", level: 3 }, { name: "API Testing", level: 3 }],
    dependencies: ["dec-6", "dec-7"],
    suggestedAssigneeId: "user-thao",
    suggestedAssigneeName: "Thảo",
    suggestedAssigneeRole: "QA",
    currentWorkload: 45,
    postAssignWorkload: 60,
    assignmentRationale: "Thảo chuyên trách QA, có kỹ năng Playwright 3/5, tải sau nhận đạt 60% lý tưởng.",
  },
  {
    id: "dec-9",
    selected: true,
    title: "Cập nhật tài liệu OpenAPI Swagger và hướng dẫn cấu hình Client ID",
    estimateHours: 4,
    requiredSkills: [{ name: "Scrum & Agile", level: 3 }, { name: "NestJS", level: 2 }],
    dependencies: ["dec-8"],
    suggestedAssigneeId: "user-lan",
    suggestedAssigneeName: "Lan",
    suggestedAssigneeRole: "PM",
    currentWorkload: 62,
    postAssignWorkload: 78,
    assignmentRationale: "PM Lan phụ trách hoàn thiện tài liệu phát hành cho sprint tiếp theo.",
  },
];
