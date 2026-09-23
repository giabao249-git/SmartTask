/**
 * SmartTask Production-Ready Seed Script
 * Xóa sạch dữ liệu rác cũ và nạp lại dữ liệu mẫu chuẩn cho kiểm thử phân quyền & AI
 * 
 * 6 Tài khoản test với các Role khác nhau (Mật khẩu chung: Demo@1234):
 *  1. admin@smarttask.local  -> Bùi Hoàng Long    (Platform Super Admin / SUPER_ADMIN)
 *  2. lan@smarttask.local    -> Nguyễn Thị Lan     (Workspace OWNER & Project PM)
 *  3. quang@smarttask.local  -> Đỗ Hồng Quang     (Workspace ADMIN & Project PM)
 *  4. minh@smarttask.local   -> Trần Quang Minh    (Workspace MEMBER & Backend Developer)
 *  5. huy@smarttask.local    -> Lê Đức Huy        (Workspace MEMBER & Frontend/QA Engineer)
 *  6. mai@smarttask.local    -> Phạm Phương Mai   (Workspace VIEWER - Chỉ xem, không sửa)
 */
import {
  PrismaClient,
  WorkspaceRole,
  ProjectRole,
  SprintStatus,
  Priority,
  TaskType,
  PlatformRole,
  AiPurpose,
  AiProvider,
  AiLogStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { DEFAULT_SKILLS } from '../src/skills/skill-seed';
import { defaultWorkspaceSettings } from '../src/workspaces/workspace-settings';
import { AI_CATALOG_SEED } from '../src/ai/ai-config/ai-catalog.seed';

const prisma = new PrismaClient();

const DEFAULT_COLUMNS = [
  { name: 'Cần làm', statusKey: 'TODO', position: 1, isDone: false },
  { name: 'Đang làm', statusKey: 'IN_PROGRESS', position: 2, isDone: false },
  { name: 'Kiểm thử', statusKey: 'REVIEW', position: 3, isDone: false },
  { name: 'Hoàn thành', statusKey: 'DONE', position: 4, isDone: true },
];

const day = (offset: number): Date => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + offset);
  return d;
};

async function cleanDatabase(): Promise<void> {
  console.log('🧹 [1/6] Đang dọn dẹp và xóa các dữ liệu cũ rác...');
  await prisma.systemAuditLog.deleteMany({});
  await prisma.supportAccessSession.deleteMany({});
  await prisma.aiTokenLog.deleteMany({});
  await prisma.aiProposal.deleteMany({});
  await prisma.aiFeedback.deleteMany({});
  await prisma.chatMessage.deleteMany({});
  await prisma.chatSession.deleteMany({});
  await prisma.aiConfig.deleteMany({});
  await prisma.aiPromptConfig.deleteMany({});
  await prisma.aiMemory.deleteMany({});
  await prisma.aiHabit.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.pushSubscription.deleteMany({});
  await prisma.activityLog.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.mention.deleteMany({});
  await prisma.attachment.deleteMany({});
  await prisma.taskAssignee.deleteMany({});
  await prisma.taskSkill.deleteMany({});
  await prisma.taskDependency.deleteMany({});
  await prisma.taskLabel.deleteMany({});
  await prisma.taskReview.deleteMany({});
  await prisma.timeEntry.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.burndownSnapshot.deleteMany({});
  await prisma.sprint.deleteMany({});
  await prisma.boardColumn.deleteMany({});
  await prisma.label.deleteMany({});
  await prisma.projectMember.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.userSkill.deleteMany({});
  await prisma.memberAlias.deleteMany({});
  await prisma.skillAlias.deleteMany({});
  await prisma.skill.deleteMany({});
  await prisma.workspaceMember.deleteMany({});
  await prisma.invitation.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.userTimeOff.deleteMany({});
  await prisma.workloadAlert.deleteMany({});
  await prisma.workloadSnapshot.deleteMany({});
  await prisma.calendarEvent.deleteMany({});
  await prisma.calendarConnection.deleteMany({});
  await prisma.userMetricsWeekly.deleteMany({});
  await prisma.workspace.deleteMany({});
  await prisma.user.deleteMany({});
  console.log('   ✅ Đã dọn dẹp sạch toàn bộ dữ liệu cũ!');
}

async function seedAiCatalog(): Promise<void> {
  console.log('🤖 [2/6] Đang đồng bộ danh mục Model AI (bao gồm DeepSeek V4 Flash & Gemini)...');
  for (const model of AI_CATALOG_SEED) {
    await prisma.aiModelCatalog.upsert({
      where: {
        provider_model: {
          provider: model.provider,
          model: model.model,
        },
      },
      update: {
        label: model.label,
        inputPrice: model.inputPrice,
        outputPrice: model.outputPrice,
        cachedInputPrice: model.cachedInputPrice,
        contextWindow: model.contextWindow,
        isReasoning: model.isReasoning,
        supportsStructuredOutput: model.supportsStructuredOutput,
        sortOrder: model.sortOrder,
      },
      create: model,
    });
  }
  console.log(`   ✅ Đã nạp ${AI_CATALOG_SEED.length} models vào AiModelCatalog!`);
}

/**
 * Id cố định cho dữ liệu demo: seed chạy lại vẫn giữ nguyên đường dẫn
 * (/projects/<id>/…, link trong thông báo, tab đang mở) thay vì sinh UUID mới mỗi lần.
 */
const ID = {
  users: {
    Long: '11111111-1111-4111-8111-000000000001',
    Lan: '11111111-1111-4111-8111-000000000002',
    Quang: '11111111-1111-4111-8111-000000000003',
    Minh: '11111111-1111-4111-8111-000000000004',
    Huy: '11111111-1111-4111-8111-000000000005',
    Mai: '11111111-1111-4111-8111-000000000006',
  } as Record<string, string>,
  workspace: '22222222-2222-4222-8222-000000000001',
  project: '33333333-3333-4333-8333-000000000001',
  sprint1: '44444444-4444-4444-8444-000000000001',
  sprint2: '44444444-4444-4444-8444-000000000002',
};

async function main(): Promise<void> {
  console.log('🚀 Bắt đầu quy trình Seed dữ liệu mẫu cho SmartTask...');
  
  await cleanDatabase();
  await seedAiCatalog();

  console.log('👥 [3/6] Đang tạo 6 tài khoản mẫu với đầy đủ phân cấp Role...');
  const passwordHash = await bcrypt.hash('Demo@1234', 10);

  const testAccounts = [
    {
      key: 'Long',
      email: 'admin@smarttask.local',
      fullName: 'Bùi Hoàng Long',
      shortName: 'Long (Super Admin)',
      isSuperAdmin: true,
      platformRole: PlatformRole.ROOT_ADMIN,
    },
    {
      key: 'Lan',
      email: 'lan@smarttask.local',
      fullName: 'Nguyễn Thị Lan',
      shortName: 'Lan (Owner/PM)',
      isSuperAdmin: false,
      platformRole: null,
    },
    {
      key: 'Quang',
      email: 'quang@smarttask.local',
      fullName: 'Đỗ Hồng Quang',
      shortName: 'Quang (Admin)',
      isSuperAdmin: false,
      platformRole: null,
    },
    {
      key: 'Minh',
      email: 'minh@smarttask.local',
      fullName: 'Trần Quang Minh',
      shortName: 'Minh (BE Dev)',
      isSuperAdmin: false,
      platformRole: null,
    },
    {
      key: 'Huy',
      email: 'huy@smarttask.local',
      fullName: 'Lê Đức Huy',
      shortName: 'Huy (FE/QA)',
      isSuperAdmin: false,
      platformRole: null,
    },
    {
      key: 'Mai',
      email: 'mai@smarttask.local',
      fullName: 'Phạm Phương Mai',
      shortName: 'Mai (Viewer)',
      isSuperAdmin: false,
      platformRole: null,
    },
  ];

  const userMap: Record<string, string> = {};
  for (const acc of testAccounts) {
    const user = await prisma.user.create({
      data: {
        id: ID.users[acc.key],
        email: acc.email,
        fullName: acc.fullName,
        shortName: acc.shortName,
        passwordHash,
        isSuperAdmin: acc.isSuperAdmin,
        platformRole: acc.platformRole,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${acc.key}`,
      },
    });
    userMap[acc.key] = user.id;
  }
  console.log('   ✅ Đã tạo 6 tài khoản người dùng mẫu (Mật khẩu: Demo@1234)!');

  console.log('🏢 [4/6] Đang tạo Workspace "SmartTask Demo" và phân quyền thành viên...');
  const ws = await prisma.workspace.create({
    data: {
      id: ID.workspace,
      name: 'SmartTask Demo',
      slug: 'smarttask-demo',
      ownerId: userMap.Lan,
      settings: defaultWorkspaceSettings(),
      members: {
        create: [
          { userId: userMap.Lan, role: WorkspaceRole.OWNER, title: 'Project Manager', department: 'Ban Giám đốc' },
          { userId: userMap.Long, role: WorkspaceRole.ADMIN, title: 'Platform Architect', department: 'Hạ tầng' },
          { userId: userMap.Quang, role: WorkspaceRole.ADMIN, title: 'Engineering Lead', department: 'Phát triển' },
          { userId: userMap.Minh, role: WorkspaceRole.MEMBER, title: 'Backend Developer', department: 'Phát triển', managerUserId: userMap.Quang },
          { userId: userMap.Huy, role: WorkspaceRole.MEMBER, title: 'Frontend / QA', department: 'Phát triển', managerUserId: userMap.Quang },
          { userId: userMap.Mai, role: WorkspaceRole.VIEWER, title: 'Khách hàng / Stakeholder', department: 'Đối tác' },
        ],
      },
    },
  });
  const wsId = ws.id;

  // Nạp danh mục kỹ năng
  for (const s of DEFAULT_SKILLS) {
    await prisma.skill.create({
      data: {
        workspaceId: wsId,
        name: s.name,
        category: s.category,
        aliases: { create: (s.aliases ?? []).map((alias) => ({ alias })) },
      },
    });
  }

  // Gán kỹ năng cho các thành viên
  const skills = await prisma.skill.findMany({ where: { workspaceId: wsId } });
  const getSkillId = (name: string) => skills.find((s) => s.name === name)?.id;

  const memberSkills: Record<string, [string, number][]> = {
    Lan: [['Scrum / Agile', 5], ['Phân tích nghiệp vụ', 5], ['React', 4]],
    Long: [['Docker', 5], ['PostgreSQL', 5], ['NestJS', 5], ['Prisma', 5]],
    Quang: [['NestJS', 5], ['Node.js', 5], ['Scrum / Agile', 4], ['Docker', 4]],
    Minh: [['NestJS', 5], ['PostgreSQL', 4], ['Node.js', 4], ['Prisma', 4]],
    Huy: [['React', 5], ['Next.js', 4], ['Tailwind CSS', 5], ['UI Testing', 4]],
    Mai: [['Phân tích nghiệp vụ', 3]],
  };

  for (const [key, list] of Object.entries(memberSkills)) {
    for (const [skillName, level] of list) {
      const sid = getSkillId(skillName);
      if (!sid) continue;
      await prisma.userSkill.create({
        data: {
          userId: userMap[key],
          skillId: sid,
          level,
        },
      });
    }
  }

  // Chỉ tạo cấu hình cho nhà cung cấp THỰC SỰ có khoá trong .env — nếu không, Trợ lý AI sẽ 503
  // ngay ở lượt đầu (cấu hình workspace được ưu tiên hơn AI_PROVIDER).
  const hasDeepSeekKey = !!process.env.DEEPSEEK_API_KEY;
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;
  console.log(
    `🤖 [5/6] Đang cấu hình AI Workspace (DeepSeek: ${hasDeepSeekKey ? 'có khoá' : 'chưa có khoá → bỏ qua'}, Gemini: ${hasGeminiKey ? 'có khoá' : 'chưa có khoá → bỏ qua'})...`,
  );
  // Cấu hình AI cho workspace
  const deepseekModel = await prisma.aiModelCatalog.findUnique({
    where: { provider_model: { provider: AiProvider.DEEPSEEK, model: 'deepseek-v4-flash' } },
  });
  const geminiFlash = await prisma.aiModelCatalog.findUnique({
    where: { provider_model: { provider: AiProvider.GEMINI, model: 'gemini-2.5-flash' } },
  });
  const geminiLite = await prisma.aiModelCatalog.findUnique({
    where: { provider_model: { provider: AiProvider.GEMINI, model: 'gemini-2.5-flash-lite' } },
  });

  if (deepseekModel && hasDeepSeekKey) {
    await prisma.aiConfig.create({
      data: {
        workspaceId: wsId,
        name: 'Cấu hình Mặc định (DeepSeek V4 Flash)',
        purpose: AiPurpose.GENERAL,
        catalogId: deepseekModel.id,
        createdById: userMap.Lan,
        advancedParams: { temperature: 0.7, maxOutputTokens: 4096 },
      },
    });
    await prisma.aiConfig.create({
      data: {
        workspaceId: wsId,
        name: 'Trợ lý Hội thoại (DeepSeek V4 Flash)',
        purpose: AiPurpose.CHAT,
        catalogId: deepseekModel.id,
        createdById: userMap.Lan,
        advancedParams: { temperature: 0.8, maxOutputTokens: 4096 },
      },
    });
  }

  if (geminiFlash && hasGeminiKey && !hasDeepSeekKey) {
    // Không có khoá DeepSeek → Gemini gánh luôn GENERAL và CHAT để Trợ lý AI chạy được ngay
    await prisma.aiConfig.create({
      data: {
        workspaceId: wsId,
        name: 'Cấu hình Mặc định (Gemini 2.5 Flash)',
        purpose: AiPurpose.GENERAL,
        catalogId: geminiFlash.id,
        createdById: userMap.Lan,
        advancedParams: { temperature: 0.7, maxOutputTokens: 4096 },
      },
    });
    await prisma.aiConfig.create({
      data: {
        workspaceId: wsId,
        name: 'Trợ lý Hội thoại (Gemini 2.5 Flash)',
        purpose: AiPurpose.CHAT,
        catalogId: geminiFlash.id,
        createdById: userMap.Lan,
        advancedParams: { temperature: 0.8, maxOutputTokens: 4096 },
      },
    });
  }

  if (geminiFlash && hasGeminiKey) {
    await prisma.aiConfig.create({
      data: {
        workspaceId: wsId,
        name: 'Phân rã WBS & Đề xuất Task (Gemini 2.5 Flash)',
        purpose: AiPurpose.DECOMPOSE,
        catalogId: geminiFlash.id,
        createdById: userMap.Lan,
        advancedParams: { temperature: 0.4, maxOutputTokens: 4096 },
      },
    });
  }

  if (geminiLite && hasGeminiKey) {
    await prisma.aiConfig.create({
      data: {
        workspaceId: wsId,
        name: 'Giải thích Tiến độ & Rủi ro (Gemini 2.5 Flash-Lite)',
        purpose: AiPurpose.EXPLAIN,
        catalogId: geminiLite.id,
        createdById: userMap.Lan,
        advancedParams: { temperature: 0.3, maxOutputTokens: 2048 },
      },
    });
  }

  // Tạo một số dòng AiTokenLog mẫu phục vụ FinOps
  await prisma.aiTokenLog.createMany({
    data: [
      {
        workspaceId: wsId,
        userId: userMap.Lan,
        provider: 'DEEPSEEK',
        model: 'deepseek-v4-flash',
        purpose: AiPurpose.GENERAL,
        status: AiLogStatus.SUCCESS,
        totalTokens: 1450,
        inputTokens: 950,
        outputTokens: 500,
        estimatedCost: 0.00027,
        durationMs: 420,
        endpoint: '/chat/completions',
        promptChars: 3800,
        promptHash: 'hash_seed_01',
      },
      {
        workspaceId: wsId,
        userId: userMap.Minh,
        provider: 'DEEPSEEK',
        model: 'deepseek-v4-flash',
        purpose: AiPurpose.CHAT,
        status: AiLogStatus.SUCCESS,
        totalTokens: 2300,
        inputTokens: 1500,
        outputTokens: 800,
        estimatedCost: 0.00043,
        durationMs: 510,
        endpoint: '/chat/completions',
        promptChars: 5600,
        promptHash: 'hash_seed_02',
      },
      {
        workspaceId: wsId,
        userId: userMap.Quang,
        provider: 'GEMINI',
        model: 'gemini-2.5-flash',
        purpose: AiPurpose.DECOMPOSE,
        status: AiLogStatus.SUCCESS,
        totalTokens: 4200,
        inputTokens: 3000,
        outputTokens: 1200,
        estimatedCost: 0.0039,
        durationMs: 980,
        endpoint: '/models/gemini-2.5-flash:generateContent',
        promptChars: 11200,
        promptHash: 'hash_seed_03',
      },
    ],
  });

  console.log('📌 [6/6] Đang tạo Dự án ST "SmartTask v1", Sprints và 10 Task mẫu...');
  const project = await prisma.project.create({
    data: {
      id: ID.project,
      workspaceId: wsId,
      key: 'ST',
      name: 'SmartTask v1',
      description: 'Nền tảng quản trị dự án Agile/Kanban cân bằng tải & AI Agent',
      startDate: day(-14),
      endDate: day(42),
      taskCounter: 10,
      members: {
        create: [
          { userId: userMap.Lan, role: ProjectRole.PM },
          { userId: userMap.Long, role: ProjectRole.MEMBER },
          { userId: userMap.Quang, role: ProjectRole.MEMBER },
          { userId: userMap.Minh, role: ProjectRole.MEMBER },
          { userId: userMap.Huy, role: ProjectRole.MEMBER },
          { userId: userMap.Mai, role: ProjectRole.MEMBER },
        ],
      },
      columns: { create: DEFAULT_COLUMNS },
      labels: {
        create: [
          { name: 'backend', color: '#2563eb' },
          { name: 'frontend', color: '#16a34a' },
          { name: 'ai', color: '#8b5cf6' },
          { name: 'security', color: '#dc2626' },
        ],
      },
    },
  });

  const columns = await prisma.boardColumn.findMany({
    where: { projectId: project.id },
    orderBy: { position: 'asc' },
  });
  const colMap = (key: string) => columns.find((c) => c.statusKey === key)!.id;

  const sprint1 = await prisma.sprint.create({
    data: {
      id: ID.sprint1,
      projectId: project.id,
      name: 'Sprint 1',
      goal: 'Kiến trúc RBAC, Cổng Admin & Tích hợp DeepSeek V4 Flash',
      startDate: day(-7),
      endDate: day(7),
      status: SprintStatus.ACTIVE,
      startedAt: day(-7),
      scopeHoursInitial: 68,
    },
  });

  const sprint2 = await prisma.sprint.create({
    data: {
      id: ID.sprint2,
      projectId: project.id,
      name: 'Sprint 2',
      goal: 'Cân bằng tải Workload & Trợ lý AI phân rã WBS',
      startDate: day(8),
      endDate: day(22),
      status: SprintStatus.PLANNED,
    },
  });

  const sampleTasks = [
    {
      title: 'Thiết kế schema đa người dùng & phân quyền RBAC 3 cấp',
      type: TaskType.TASK,
      col: 'DONE',
      sprint: sprint1.id,
      hours: 8,
      difficulty: 4,
      priority: Priority.HIGH,
      assignee: 'Minh',
      skill: 'Prisma',
      start: -7,
      due: -5,
      progress: 100,
      done: true,
    },
    {
      title: 'API xác thực JWT & bảo vệ cổng quản trị /admin',
      type: TaskType.STORY,
      col: 'DONE',
      sprint: sprint1.id,
      hours: 12,
      difficulty: 5,
      priority: Priority.URGENT,
      assignee: 'Minh',
      skill: 'NestJS',
      start: -6,
      due: -2,
      progress: 100,
      done: true,
    },
    {
      title: 'Cấu hình AI Catalog & tích hợp DeepSeek V4 Flash',
      type: TaskType.TASK,
      col: 'REVIEW',
      sprint: sprint1.id,
      hours: 10,
      difficulty: 4,
      priority: Priority.HIGH,
      assignee: 'Minh',
      skill: 'NestJS',
      start: -4,
      due: 1,
      progress: 90,
    },
    {
      title: 'Top Navbar Fixed & Workspace Switcher công thái học',
      type: TaskType.STORY,
      col: 'IN_PROGRESS',
      sprint: sprint1.id,
      hours: 8,
      difficulty: 3,
      priority: Priority.MEDIUM,
      assignee: 'Huy',
      skill: 'React',
      start: -3,
      due: 2,
      progress: 60,
    },
    {
      title: 'Bảng Kanban kéo thả với WIP limits & bộ lọc Việc của tôi',
      type: TaskType.STORY,
      col: 'IN_PROGRESS',
      sprint: sprint1.id,
      hours: 14,
      difficulty: 4,
      priority: Priority.HIGH,
      assignee: 'Huy',
      skill: 'React',
      start: -2,
      due: 4,
      progress: 40,
    },
    // Các task chưa phân công (Unassigned) -> Dùng để test chức năng "+ Nhận task"
    {
      title: 'Nút nhận việc nhanh (+ Nhận task) cho các task chưa phân công',
      type: TaskType.STORY,
      col: 'TODO',
      sprint: sprint1.id,
      hours: 6,
      difficulty: 2,
      priority: Priority.MEDIUM,
      skill: 'React',
      start: 0,
      due: 3,
    },
    {
      title: 'Kiểm thử tự động E2E phân quyền các role với Puppeteer',
      type: TaskType.TASK,
      col: 'TODO',
      sprint: sprint1.id,
      hours: 8,
      difficulty: 3,
      priority: Priority.HIGH,
      skill: 'UI Testing',
      start: 1,
      due: 5,
    },
    {
      title: 'Cân bằng tải nhân sự theo ma trận kỹ năng phòng ban',
      type: TaskType.STORY,
      col: 'TODO',
      sprint: sprint2.id,
      hours: 16,
      difficulty: 5,
      priority: Priority.HIGH,
      skill: 'NestJS',
      start: 8,
      due: 15,
    },
    {
      title: 'Trợ lý AI phân rã WBS tự động bằng DeepSeek V4 Flash',
      type: TaskType.STORY,
      col: 'TODO',
      sprint: sprint2.id,
      hours: 12,
      difficulty: 4,
      priority: Priority.MEDIUM,
      skill: 'React',
      start: 10,
      due: 18,
    },
    {
      title: 'Xuất báo cáo tiến độ Sprint & kiểm toán mật mã HMAC',
      type: TaskType.TASK,
      col: 'TODO',
      sprint: null,
      hours: 6,
      difficulty: 3,
      priority: Priority.LOW,
      assignee: 'Long',
      skill: 'Docker',
      start: 0,
      due: 20,
    },
    {
      title: 'Lỗi: kéo thẻ sang cột vượt WIP vẫn hiện toast thành công rồi mới hoàn tác',
      type: TaskType.BUG,
      col: 'DOING',
      sprint: sprint1.id,
      hours: 3,
      difficulty: 2,
      priority: Priority.HIGH,
      assignee: 'Huy',
      skill: 'React',
      start: -1,
      due: 3,
      progress: 40,
    },
    {
      title: 'Lỗi: làm mới trang ở màn Tải nhân sự mất bộ lọc tuần đang chọn',
      type: TaskType.BUG,
      col: 'TODO',
      sprint: sprint1.id,
      hours: 2,
      difficulty: 2,
      priority: Priority.MEDIUM,
      skill: 'React',
      start: 1,
      due: 5,
    },
  ];

  let taskNumber = 1;
  for (const t of sampleTasks) {
    const sid = t.skill ? getSkillId(t.skill) : undefined;
    await prisma.task.create({
      data: {
        projectId: project.id,
        sprintId: t.sprint,
        columnId: colMap(t.col),
        number: taskNumber++,
        title: t.title,
        type: t.type,
        priority: t.priority,
        difficulty: t.difficulty,
        estimateHours: t.hours,
        remainingHours: t.done ? 0 : Math.round(t.hours * (1 - (t.progress ?? 0) / 100)),
        progress: t.progress ?? 0,
        position: taskNumber * 1000,
        startDate: day(t.start),
        dueDate: day(t.due),
        createdById: userMap.Lan,
        startedAt: (t.progress ?? 0) > 0 ? day(t.start) : null,
        completedAt: t.done ? day(t.due) : null,
        assignees: t.assignee ? { create: [{ userId: userMap[t.assignee] }] } : undefined,
        skills: sid ? { create: [{ skillId: sid, minLevel: 3 }] } : undefined,
      },
    });
  }

  // Tạo Audit Log có mã băm HMAC hợp lệ mẫu
  const secret = process.env.JWT_ACCESS_SECRET || 'smarttask_audit_secret_key';
  const genesisHash = '0000000000000000000000000000000000000000000000000000000000000000';
  const logDate1 = new Date(Date.now() - 3600000);
  const logStr1 = [
    genesisHash,
    logDate1.toISOString(),
    userMap.Long,
    'SYSTEM_BOOTSTRAP',
    'Platform',
    'global',
    JSON.stringify(null),
    JSON.stringify({ status: 'INITIALIZED' }),
    'Khởi tạo dữ liệu seed sạch và nạp danh mục model AI',
  ].join('|');
  const hash1 = crypto.createHmac('sha256', secret).update(logStr1).digest('hex');

  await prisma.systemAuditLog.create({
    data: {
      createdAt: logDate1,
      actorId: userMap.Long,
      actorEmail: 'admin@smarttask.local',
      action: 'SYSTEM_BOOTSTRAP',
      targetType: 'Platform',
      targetId: 'global',
      reason: 'Khởi tạo dữ liệu seed sạch và nạp danh mục model AI',
      afterState: { status: 'INITIALIZED' },
      previousHash: genesisHash,
      currentHash: hash1,
    },
  });

  console.log('\n================================================================');
  console.log('🎉 SEED DỮ LIỆU THÀNH CÔNG RỰC RỠ! THÔNG TIN CÁC TÀI KHOẢN:');
  console.log('================================================================');
  console.table([
    {
      Email: 'admin@smarttask.local',
      Password: 'Demo@1234',
      Tên: 'Bùi Hoàng Long',
      'Platform Role': 'ROOT_ADMIN',
      'Workspace Role': 'ADMIN',
      'Project Role': 'PM',
      'Đặc quyền test': 'Vào /admin (Mission Control, FinOps, Telemetry, Maintenance)',
    },
    {
      Email: 'lan@smarttask.local',
      Password: 'Demo@1234',
      Tên: 'Nguyễn Thị Lan',
      'Platform Role': 'None',
      'Workspace Role': 'OWNER',
      'Project Role': 'PM',
      'Đặc quyền test': 'Toàn quyền Workspace Settings, AI Configs, Đổi role, Tạo Sprint',
    },
    {
      Email: 'quang@smarttask.local',
      Password: 'Demo@1234',
      Tên: 'Đỗ Hồng Quang',
      'Platform Role': 'None',
      'Workspace Role': 'ADMIN',
      'Project Role': 'PM',
      'Đặc quyền test': 'Quản lý thành viên, Tải nhân sự, Tạo/quản lý Sprint & Task',
    },
    {
      Email: 'minh@smarttask.local',
      Password: 'Demo@1234',
      Tên: 'Trần Quang Minh',
      'Platform Role': 'None',
      'Workspace Role': 'MEMBER',
      'Project Role': 'MEMBER',
      'Đặc quyền test': 'Test filter "Việc của tôi (Q)", "+ Nhận task", Kéo thả task BE',
    },
    {
      Email: 'huy@smarttask.local',
      Password: 'Demo@1234',
      Tên: 'Lê Đức Huy',
      'Platform Role': 'None',
      'Workspace Role': 'MEMBER',
      'Project Role': 'MEMBER',
      'Đặc quyền test': 'Test nhận task FE, cập nhật tiến độ, chat AI với DeepSeek',
    },
    {
      Email: 'mai@smarttask.local',
      Password: 'Demo@1234',
      Tên: 'Phạm Phương Mai',
      'Platform Role': 'None',
      'Workspace Role': 'VIEWER',
      'Project Role': 'MEMBER',
      'Đặc quyền test': 'Chỉ xem dữ liệu (Read-only), bị khóa quyền tạo/sửa/xóa',
    },
  ]);
  console.log('================================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi chạy seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
