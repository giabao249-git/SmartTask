import { MEMBERS, type Member } from "./members";
import type { PriorityLevel, TaskStatus } from "@/lib/status";

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TaskComment {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  content: string;
  createdAt: string;
}

export interface TaskActivity {
  id: string;
  actor: string;
  action: string;
  timestamp: string;
}

export interface TaskItem {
  id: string;
  code: string; // ST-1, ST-12...
  title: string;
  description: string;
  status: TaskStatus;
  priority: PriorityLevel;
  assigneeId: string;
  assignee: Member;
  estimateHours: number;
  actualHours: number;
  remainingHours: number;
  dueDate: string;
  startDate: string;
  isOverdue?: boolean;
  isAiGenerated?: boolean;
  labels: string[];
  subtasks: Subtask[];
  requiredSkills: { name: string; level: number }[];
  dependencies: string[]; // task codes
  comments: TaskComment[];
  activities: TaskActivity[];
  sprint: string;
}

const getMember = (id: string): Member => {
  return MEMBERS.find((m) => m.id === id) || MEMBERS[0];
};

export const INITIAL_TASKS: TaskItem[] = [
  // Cột Đang làm: 4 thẻ (WIP limit 3 -> viền warning!)
  {
    id: "task-7",
    code: "ST-7",
    title: "Tối ưu hóa chỉ mục PostgreSQL cho bảng workload_snapshots",
    description: "Tạo composite index trên (workspace_id, week_start, user_id) để tăng tốc truy vấn biểu đồ heatmap tải nhân sự từ 340ms xuống dưới 25ms.",
    status: "IN_PROGRESS",
    priority: "HIGH",
    assigneeId: "user-minh",
    assignee: getMember("user-minh"),
    estimateHours: 8,
    actualHours: 6,
    remainingHours: 2,
    startDate: "2026-10-24",
    dueDate: "2026-10-26",
    isOverdue: false,
    isAiGenerated: false,
    labels: ["backend", "database"],
    subtasks: [
      { id: "st-7-1", title: "Phân tích EXPLAIN ANALYZE các query chậm", completed: true },
      { id: "st-7-2", title: "Tạo migration thêm index", completed: true },
      { id: "st-7-3", title: "Benchmark trên dataset 50.000 snapshot", completed: false },
    ],
    requiredSkills: [
      { name: "PostgreSQL", level: 3 },
      { name: "NestJS", level: 3 },
    ],
    dependencies: ["ST-3"],
    comments: [
      {
        id: "c-1",
        authorId: "user-lan",
        authorName: "Lan",
        authorRole: "PM",
        content: "@Minh chú ý test kỹ partition theo tháng nhé, snapshot tích luỹ khá nhanh.",
        createdAt: "Hôm qua lúc 14:20",
      },
      {
        id: "c-2",
        authorId: "user-minh",
        authorName: "Minh",
        authorRole: "Backend",
        content: "Đã benchmark xong phần composite index, lát mình gửi PR review.",
        createdAt: "Hôm nay lúc 08:30",
      },
    ],
    activities: [
      { id: "a-1", actor: "Minh", action: "chuyển trạng thái sang Đang làm", timestamp: "24/10 09:15" },
      { id: "a-2", actor: "Lan", action: "cập nhật mô tả yêu cầu kỹ thuật", timestamp: "Hôm nay 08:10" },
    ],
    sprint: "Sprint 3 · 23/10–29/10",
  },
  {
    id: "task-12",
    code: "ST-12",
    title: "Dựng giao diện kéo thả thẻ Kanban với @dnd-kit và ghost preview",
    description: "Hiện thực bộ kéo thả Kanban mượt mà với cảm biến bàn phím, ghost preview khi đang drag, và hiển thị thẻ cảnh báo khi vượt WIP limit.",
    status: "IN_PROGRESS",
    priority: "URGENT",
    assigneeId: "user-huy",
    assignee: getMember("user-huy"),
    estimateHours: 14,
    actualHours: 11,
    remainingHours: 3,
    startDate: "2026-10-23",
    dueDate: "2026-10-25", // Quá hạn!
    isOverdue: true,
    isAiGenerated: false,
    labels: ["frontend", "ui"],
    subtasks: [
      { id: "st-12-1", title: "Cấu hình DndContext và DragOverlay", completed: true },
      { id: "st-12-2", title: "Ghép SortableContext theo cột", completed: true },
      { id: "st-12-3", title: "Xử lý va chạm và reorder mượt", completed: false },
      { id: "st-12-4", title: "Hỗ trợ phím tắt chuyển cột", completed: false },
      { id: "st-12-5", title: "Tích hợp toast realtime Sonner", completed: false },
    ],
    requiredSkills: [
      { name: "Next.js", level: 4 },
      { name: "shadcn/ui", level: 3 },
    ],
    dependencies: ["ST-5"],
    comments: [
      {
        id: "c-3",
        authorId: "user-huy",
        authorName: "Huy",
        authorRole: "Frontend",
        content: "Phần ghost overlay mượt rồi, đang vướng chút ở collision detection khi kéo qua cột rỗng.",
        createdAt: "25/10 lúc 17:40",
      },
    ],
    activities: [
      { id: "a-3", actor: "Huy", action: "bắt đầu thực hiện", timestamp: "23/10 10:00" },
      { id: "a-4", actor: "Hệ thống", action: "đánh dấu quá hạn 1 ngày", timestamp: "26/10 00:00" },
    ],
    sprint: "Sprint 3 · 23/10–29/10",
  },
  {
    id: "task-9",
    code: "ST-9",
    title: "Xây dựng Sheet bảng sự thật chi tiết tải giờ trống và focus block",
    description: "Sheet bên phải hiển thị chi tiết giờ khả dụng theo ngày (PerDay - Busy - Planned), các khối tập trung ≥ 2h không gián đoạn và lịch họp.",
    status: "IN_PROGRESS",
    priority: "HIGH",
    assigneeId: "user-huy",
    assignee: getMember("user-huy"),
    estimateHours: 10,
    actualHours: 7,
    remainingHours: 3,
    startDate: "2026-10-24",
    dueDate: "2026-10-27",
    isOverdue: false,
    isAiGenerated: true, // Do AI tạo
    labels: ["frontend", "workload", "ai"],
    subtasks: [
      { id: "st-9-1", title: "Dựng khung Sheet Radix sm:max-w-xl", completed: true },
      { id: "st-9-2", title: "Biểu đồ mini giờ trống 7 ngày", completed: false },
      { id: "st-9-3", title: "Danh sách khối tập trung focus block", completed: false },
    ],
    requiredSkills: [
      { name: "Next.js", level: 3 },
      { name: "shadcn/ui", level: 3 },
    ],
    dependencies: ["ST-8"],
    comments: [],
    activities: [
      { id: "a-5", actor: "AI Agent", action: "phân rã từ yêu cầu tải nhân sự", timestamp: "23/10 15:30" },
      { id: "a-6", actor: "Huy", action: "nhận việc", timestamp: "24/10 08:30" },
    ],
    sprint: "Sprint 3 · 23/10–29/10",
  },
  {
    id: "task-14",
    code: "ST-14",
    title: "Tích hợp xác thực JWT và cookie httpOnly an toàn với NestJS Passport",
    description: "Hoàn thiện luồng refresh token xoay vòng, mã hoá mật khẩu bcrypt và phân quyền RBAC cho PM, Developer, Admin.",
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    assigneeId: "user-minh",
    assignee: getMember("user-minh"),
    estimateHours: 12,
    actualHours: 8,
    remainingHours: 4,
    startDate: "2026-10-24",
    dueDate: "2026-10-28",
    isOverdue: false,
    isAiGenerated: false,
    labels: ["backend", "auth"],
    subtasks: [
      { id: "st-14-1", title: "Cấu hình JwtStrategy và RefreshStrategy", completed: true },
      { id: "st-14-2", title: "Guard Roles phân quyền", completed: true },
      { id: "st-14-3", title: "Unit test cho AuthGuard", completed: false },
    ],
    requiredSkills: [
      { name: "NestJS", level: 4 },
      { name: "Docker", level: 2 },
    ],
    dependencies: [],
    comments: [],
    activities: [
      { id: "a-7", actor: "Minh", action: "tạo task", timestamp: "23/10 11:20" },
    ],
    sprint: "Sprint 3 · 23/10–29/10",
  },

  // Cột Cần làm (TODO)
  {
    id: "task-1",
    code: "ST-1",
    title: "Thiết kế thuật toán phân bổ giờ theo tuần và tính tải hiệu dụng EffLoad",
    description: "Hiện thực công thức chia tải theo ngày làm việc, tính hệ số làm mượt Bayes EAR(u, c) và hệ số phân tâm Switch(u) theo kiến trúc doc-04.",
    status: "TODO",
    priority: "HIGH",
    assigneeId: "user-minh",
    assignee: getMember("user-minh"),
    estimateHours: 16,
    actualHours: 0,
    remainingHours: 16,
    startDate: "2026-10-27",
    dueDate: "2026-10-29",
    isOverdue: false,
    isAiGenerated: false,
    labels: ["backend", "algorithm"],
    subtasks: [
      { id: "st-1-1", title: "Hàm tính share(t, w) theo workdays", completed: false },
      { id: "st-1-2", title: "Hàm tính EAR làm mượt Bayes k=20", completed: false },
      { id: "st-1-3", title: "Bộ test Jest kiểm thử 8 ca biên", completed: false },
    ],
    requiredSkills: [
      { name: "NestJS", level: 4 },
      { name: "PostgreSQL", level: 3 },
    ],
    dependencies: [],
    comments: [],
    activities: [],
    sprint: "Sprint 3 · 23/10–29/10",
  },
  {
    id: "task-2",
    code: "ST-2",
    title: "Giao diện ma trận kỹ năng tương tác và xác nhận PM",
    description: "Bảng 5 thành viên x 8 kỹ năng, ô mức 1–5 tô màu chart-1..5, PM bấm xác nhận với hiệu ứng chuyển đổi trạng thái tức thì.",
    status: "TODO",
    priority: "MEDIUM",
    assigneeId: "user-an",
    assignee: getMember("user-an"),
    estimateHours: 8,
    actualHours: 0,
    remainingHours: 8,
    startDate: "2026-10-27",
    dueDate: "2026-10-29",
    isOverdue: false,
    isAiGenerated: true,
    labels: ["frontend", "ai", "skills"],
    subtasks: [
      { id: "st-2-1", title: "Dựng Table ma trận với tooltip", completed: false },
      { id: "st-2-2", title: "Dialog thêm kỹ năng mới có alias", completed: false },
    ],
    requiredSkills: [
      { name: "React", level: 2 },
      { name: "TypeScript", level: 2 },
    ],
    dependencies: ["ST-10"],
    comments: [],
    activities: [],
    sprint: "Sprint 3 · 23/10–29/10",
  },
  {
    id: "task-3",
    code: "ST-3",
    title: "Viết kịch bản kiểm thử E2E luồng kéo thả thẻ và cập nhật WIP limit",
    description: "Dùng Playwright mô phỏng thao tác kéo thả thẻ giữa các cột và xác minh hiển thị cảnh báo khi Đang làm vượt 3 task.",
    status: "TODO",
    priority: "MEDIUM",
    assigneeId: "user-thao",
    assignee: getMember("user-thao"),
    estimateHours: 8,
    actualHours: 0,
    remainingHours: 8,
    startDate: "2026-10-28",
    dueDate: "2026-10-29",
    isOverdue: false,
    isAiGenerated: false,
    labels: ["qa", "e2e"],
    subtasks: [
      { id: "st-3-1", title: "Scaffold Playwright spec", completed: false },
      { id: "st-3-2", title: "Test drag and drop giữa 4 cột", completed: false },
      { id: "st-3-3", title: "Test hiển thị viền warning khi cột vượt limit", completed: false },
    ],
    requiredSkills: [
      { name: "Playwright", level: 3 },
      { name: "API Testing", level: 3 },
    ],
    dependencies: ["ST-12"],
    comments: [],
    activities: [],
    sprint: "Sprint 3 · 23/10–29/10",
  },
  {
    id: "task-4",
    code: "ST-4",
    title: "Hiện thực Drawer Chat Trợ lý AI với Action Card đề xuất",
    description: "Cửa sổ chat bên phải hỗ trợ phím tắt ⌘J, gợi ý lệnh /decompose, /rebalance và hiển thị các đề xuất dưới dạng thẻ tương tác có nút Xác nhận/Sửa.",
    status: "TODO",
    priority: "HIGH",
    assigneeId: "user-huy",
    assignee: getMember("user-huy"),
    estimateHours: 12,
    actualHours: 0,
    remainingHours: 12,
    startDate: "2026-10-27",
    dueDate: "2026-10-29",
    isOverdue: false,
    isAiGenerated: false,
    labels: ["frontend", "ai"],
    subtasks: [
      { id: "st-4-1", title: "Dựng Sheet Drawer trượt phải toàn chiều cao", completed: false },
      { id: "st-4-2", title: "Action Card parser cho JSON action", completed: false },
      { id: "st-4-3", title: "Autocomplete command /decompose, /rebalance", completed: false },
    ],
    requiredSkills: [
      { name: "Next.js", level: 4 },
      { name: "shadcn/ui", level: 3 },
    ],
    dependencies: ["ST-9"],
    comments: [],
    activities: [],
    sprint: "Sprint 3 · 23/10–29/10",
  },
  {
    id: "task-15",
    code: "ST-15",
    title: "Cấu hình kết nối Ollama local dự phòng khi Gemini quá hạn ngạch",
    description: "Tích hợp provider fallback với Llama 3 8B chạy cục bộ, tự động chuyển đổi khi nhận lỗi AI_QUOTA_EXCEEDED.",
    status: "TODO",
    priority: "LOW",
    assigneeId: "user-minh",
    assignee: getMember("user-minh"),
    estimateHours: 6,
    actualHours: 0,
    remainingHours: 6,
    startDate: "2026-10-28",
    dueDate: "2026-10-29",
    isOverdue: false,
    isAiGenerated: true,
    labels: ["ai", "backend", "devops"],
    subtasks: [
      { id: "st-15-1", title: "Setup Ollama HTTP client adapter", completed: false },
      { id: "st-15-2", title: "Thử nghiệm fallback tự động", completed: false },
    ],
    requiredSkills: [
      { name: "NestJS", level: 3 },
      { name: "Docker", level: 3 },
    ],
    dependencies: [],
    comments: [],
    activities: [],
    sprint: "Sprint 3 · 23/10–29/10",
  },
  {
    id: "task-16",
    code: "ST-16",
    title: "Bổ sung Ma trận Eisenhower phân loại 4 góc phần tư",
    description: "Trang ma trận theo 2 trục Quan trọng x Khẩn cấp, hỗ trợ kéo thả thẻ giữa 4 ô Do/Plan/Delegate/Eliminate.",
    status: "TODO",
    priority: "LOW",
    assigneeId: "user-an",
    assignee: getMember("user-an"),
    estimateHours: 6,
    actualHours: 0,
    remainingHours: 6,
    startDate: "2026-10-28",
    dueDate: "2026-10-29",
    isOverdue: false,
    isAiGenerated: false,
    labels: ["frontend", "ui"],
    subtasks: [
      { id: "st-16-1", title: "Thiết kế lưới 2x2 responsive", completed: false },
      { id: "st-16-2", title: "Gắn DnD context cập nhật độ ưu tiên", completed: false },
    ],
    requiredSkills: [
      { name: "React", level: 2 },
      { name: "TypeScript", level: 2 },
    ],
    dependencies: [],
    comments: [],
    activities: [],
    sprint: "Sprint 3 · 23/10–29/10",
  },

  // Cột Review (REVIEW)
  {
    id: "task-8",
    code: "ST-8",
    title: "Xây dựng biểu đồ Heatmap tải nhân sự và Tooltip 6 yếu tố Burnout",
    description: "Hiển thị ma trận 5 thành viên x 4 tuần với màu sắc theo tỷ lệ % tải, tooltip công thức chi tiết 6 yếu tố rủi ro.",
    status: "REVIEW",
    priority: "HIGH",
    assigneeId: "user-huy",
    assignee: getMember("user-huy"),
    estimateHours: 12,
    actualHours: 13,
    remainingHours: 1,
    startDate: "2026-10-23",
    dueDate: "2026-10-26", // Quá hạn!
    isOverdue: true,
    isAiGenerated: false,
    labels: ["frontend", "workload"],
    subtasks: [
      { id: "st-8-1", title: "Bảng ma trận người x tuần", completed: true },
      { id: "st-8-2", title: "Tooltip phân rã 6 yếu tố burnout", completed: true },
      { id: "st-8-3", title: "Đồng bộ bộ lọc tuần và dự án", completed: true },
    ],
    requiredSkills: [
      { name: "Next.js", level: 4 },
      { name: "shadcn/ui", level: 3 },
    ],
    dependencies: ["ST-1"],
    comments: [
      {
        id: "c-4",
        authorId: "user-lan",
        authorName: "Lan",
        authorRole: "PM",
        content: "Phần tooltip giải thích 6 yếu tố burnout trình bày rất rõ ràng, Thảo test lại trên màn hình nhỏ nhé.",
        createdAt: "26/10 lúc 16:15",
      },
    ],
    activities: [
      { id: "a-8", actor: "Huy", action: "chuyển sang Review", timestamp: "26/10 15:00" },
    ],
    sprint: "Sprint 3 · 23/10–29/10",
  },
  {
    id: "task-10",
    code: "ST-10",
    title: "Hiện thực Service tính toán Burn-down và dự báo rủi ro Sprint",
    description: "Cron snapshot 00:05 lưu Scope và Remaining, tính vận tốc trung bình 5 ngày và dự báo ngày hoàn thành ETA kèm nguyên nhân trễ.",
    status: "REVIEW",
    priority: "HIGH",
    assigneeId: "user-minh",
    assignee: getMember("user-minh"),
    estimateHours: 10,
    actualHours: 9,
    remainingHours: 1,
    startDate: "2026-10-23",
    dueDate: "2026-10-27",
    isOverdue: false,
    isAiGenerated: false,
    labels: ["backend", "forecast"],
    subtasks: [
      { id: "st-10-1", title: "Cron job snapshot tiến độ 00:05", completed: true },
      { id: "st-10-2", title: "Hàm tính ETA và phân loại 3 mức rủi ro", completed: true },
      { id: "st-10-3", title: "API trả danh sách nguyên nhân trễ", completed: true },
    ],
    requiredSkills: [
      { name: "NestJS", level: 4 },
      { name: "PostgreSQL", level: 3 },
    ],
    dependencies: [],
    comments: [],
    activities: [
      { id: "a-9", actor: "Minh", action: "yêu cầu review", timestamp: "26/10 18:30" },
    ],
    sprint: "Sprint 3 · 23/10–29/10",
  },
  {
    id: "task-17",
    code: "ST-17",
    title: "Viết kịch bản kiểm thử API cho luồng phân rã công việc AI Decompose",
    description: "Kiểm tra endpoint /ai/decompose với 5 ca kiểm thử: đủ kỹ năng, thiếu kỹ năng, quá tải nhân sự, trùng lặp và chu trình phụ thuộc.",
    status: "REVIEW",
    priority: "MEDIUM",
    assigneeId: "user-thao",
    assignee: getMember("user-thao"),
    estimateHours: 6,
    actualHours: 6,
    remainingHours: 0,
    startDate: "2026-10-24",
    dueDate: "2026-10-27",
    isOverdue: false,
    isAiGenerated: false,
    labels: ["qa", "api"],
    subtasks: [
      { id: "st-17-1", title: "Soạn kịch bản Postman/Jest", completed: true },
      { id: "st-17-2", title: "Xác minh mã lỗi ASSIGN_SKILL_GAP", completed: true },
    ],
    requiredSkills: [
      { name: "API Testing", level: 4 },
      { name: "Jest", level: 3 },
    ],
    dependencies: ["ST-11"],
    comments: [],
    activities: [],
    sprint: "Sprint 3 · 23/10–29/10",
  },

  // Cột Hoàn thành (DONE)
  {
    id: "task-5",
    code: "ST-5",
    title: "Thiết lập khung ứng dụng AppShell với Sidebar thu gọn và ⌘K Command Palette",
    description: "Xây dựng khung shell chuẩn gồm Sidebar trượt thu gọn, Breadcrumb động, thanh tìm kiếm nhanh ⌘K, thông báo realtime và dark mode toggle.",
    status: "DONE",
    priority: "HIGH",
    assigneeId: "user-huy",
    assignee: getMember("user-huy"),
    estimateHours: 10,
    actualHours: 9,
    remainingHours: 0,
    startDate: "2026-10-23",
    dueDate: "2026-10-24",
    isOverdue: false,
    isAiGenerated: false,
    labels: ["frontend", "ui"],
    subtasks: [
      { id: "st-5-1", title: "AppShell layout với Sidebar", completed: true },
      { id: "st-5-2", title: "Hộp thoại ⌘K Command Palette", completed: true },
      { id: "st-5-3", title: "Tích hợp dark mode theme provider", completed: true },
    ],
    requiredSkills: [
      { name: "Next.js", level: 4 },
      { name: "Tailwind CSS", level: 4 },
    ],
    dependencies: [],
    comments: [],
    activities: [
      { id: "a-10", actor: "Huy", action: "hoàn thành task", timestamp: "24/10 17:00" },
    ],
    sprint: "Sprint 3 · 23/10–29/10",
  },
  {
    id: "task-6",
    code: "ST-6",
    title: "Khởi tạo cơ sở dữ liệu Prisma Schema và migration ban đầu",
    description: "Tạo schema cho User, Workspace, Project, Sprint, Task, Skill, TimeEntry, WorkloadSnapshot và thiết lập quan hệ khoá ngoại.",
    status: "DONE",
    priority: "URGENT",
    assigneeId: "user-minh",
    assignee: getMember("user-minh"),
    estimateHours: 8,
    actualHours: 7,
    remainingHours: 0,
    startDate: "2026-10-23",
    dueDate: "2026-10-24",
    isOverdue: false,
    isAiGenerated: false,
    labels: ["backend", "database"],
    subtasks: [
      { id: "st-6-1", title: "Viết model trong schema.prisma", completed: true },
      { id: "st-6-2", title: "Chạy migration và sinh client", completed: true },
      { id: "st-6-3", title: "Viết script seed dữ liệu mẫu", completed: true },
    ],
    requiredSkills: [
      { name: "PostgreSQL", level: 3 },
      { name: "NestJS", level: 3 },
    ],
    dependencies: [],
    comments: [],
    activities: [],
    sprint: "Sprint 3 · 23/10–29/10",
  },
  {
    id: "task-11",
    code: "ST-11",
    title: "Xây dựng AI Agent Prompt phân rã yêu cầu phần mềm thành WBS công việc",
    description: "Thiết kế system prompt cho Gemini trích xuất danh sách công việc con, ước lượng giờ, nhận diện kỹ năng cần thiết và phụ thuộc.",
    status: "DONE",
    priority: "HIGH",
    assigneeId: "user-lan",
    assignee: getMember("user-lan"),
    estimateHours: 8,
    actualHours: 6,
    remainingHours: 0,
    startDate: "2026-10-23",
    dueDate: "2026-10-25",
    isOverdue: false,
    isAiGenerated: true,
    labels: ["ai", "prompt"],
    subtasks: [
      { id: "st-11-1", title: "Thiết kế Few-shot prompt", completed: true },
      { id: "st-11-2", title: "Định nghĩa JSON Schema đầu ra", completed: true },
      { id: "st-11-3", title: "Đo độ chính xác trích xuất kỹ năng", completed: true },
    ],
    requiredSkills: [
      { name: "Scrum & Agile", level: 5 },
      { name: "Product Design", level: 4 },
    ],
    dependencies: [],
    comments: [],
    activities: [],
    sprint: "Sprint 3 · 23/10–29/10",
  },
  {
    id: "task-13",
    code: "ST-13",
    title: "Định nghĩa bộ mã lỗi ErrorCode thống nhất giữa API và Web",
    description: "Tạo enum mã lỗi chuẩn trong package @smarttask/shared gồm 47 mã lỗi cho các nghiệp vụ tải, rủi ro, phân quyền và AI.",
    status: "DONE",
    priority: "MEDIUM",
    assigneeId: "user-lan",
    assignee: getMember("user-lan"),
    estimateHours: 4,
    actualHours: 3,
    remainingHours: 0,
    startDate: "2026-10-23",
    dueDate: "2026-10-24",
    isOverdue: false,
    isAiGenerated: false,
    labels: ["backend", "shared"],
    subtasks: [
      { id: "st-13-1", title: "Viết errors.ts trong @smarttask/shared", completed: true },
      { id: "st-13-2", title: "Ánh xạ mô tả lỗi tiếng Việt", completed: true },
    ],
    requiredSkills: [
      { name: "Scrum & Agile", level: 4 },
    ],
    dependencies: [],
    comments: [],
    activities: [],
    sprint: "Sprint 3 · 23/10–29/10",
  },
  {
    id: "task-18",
    code: "ST-18",
    title: "Sửa lỗi crash khi render avatar người dùng chưa có ảnh đại diện",
    description: "Thêm fallback chữ cái đầu tên (Initials) và background màu tương phản khi ảnh đại diện bị 404.",
    status: "DONE",
    priority: "LOW",
    assigneeId: "user-an",
    assignee: getMember("user-an"),
    estimateHours: 2,
    actualHours: 2,
    remainingHours: 0,
    startDate: "2026-10-24",
    dueDate: "2026-10-25",
    isOverdue: false,
    isAiGenerated: false,
    labels: ["frontend", "bug"],
    subtasks: [
      { id: "st-18-1", title: "Thêm AvatarFallback component", completed: true },
    ],
    requiredSkills: [
      { name: "React", level: 2 },
    ],
    dependencies: [],
    comments: [],
    activities: [],
    sprint: "Sprint 3 · 23/10–29/10",
  },
];
