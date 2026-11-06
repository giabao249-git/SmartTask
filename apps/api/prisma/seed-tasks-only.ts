/**
 * SmartTask Seed Tasks Only
 * Re-seed lại các Sprints, Tasks, Burndown và Workload trong DB local
 * TUYỆT ĐỐI KHÔNG ĐỤNG / KHÔNG ĐỔI:
 * - Tài khoản người dùng (User, Password, Avatar, Role)
 * - Cấu hình AI & API Keys (AiConfig, AiPromptConfig, AiModelCatalog)
 * - Workspace và Thành viên (Workspace, WorkspaceMember, ProjectMember)
 * - Kỹ năng người dùng (Skill, UserSkill)
 */
import {
  PrismaClient,
  SprintStatus,
  Priority,
  TaskType,
} from '@prisma/client';
import { seedHistory } from './seed-history';

const prisma = new PrismaClient();

const day = (offset: number): Date => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + offset);
  return d;
};

const ID = {
  project: '33333333-3333-4333-8333-000000000001',
  sprint1: '44444444-4444-4444-8444-000000000001',
  sprint2: '44444444-4444-4444-8444-000000000002',
};

async function main(): Promise<void> {
  console.log('🚀 Bắt đầu re-seed riêng phân hệ CÔNG VIỆC & SPRINT (Giữ nguyên Account & API Key)...');

  // 1. Kiểm tra Project và Workspace
  const project = await prisma.project.findUnique({
    where: { id: ID.project },
    include: {
      workspace: true,
      columns: { orderBy: { position: 'asc' } },
      members: { include: { user: true } },
    },
  });

  if (!project) {
    throw new Error(`Không tìm thấy dự án ${ID.project}. Vui lòng chạy npm run db:seed trước một lần!`);
  }

  const wsId = project.workspaceId;
  console.log(`🏢 Dự án: "${project.name}" (Key: ${project.key}) thuộc Workspace: "${project.workspace.name}"`);

  // 2. Lấy danh sách Users hiện có trong DB (KHÔNG XÓA USER)
  const users = await prisma.user.findMany();
  const userMap: Record<string, string> = {};
  for (const u of users) {
    if (u.email.includes('lan@')) userMap.Lan = u.id;
    if (u.email.includes('admin@') || u.email.includes('long@')) userMap.Long = u.id;
    if (u.email.includes('quang@')) userMap.Quang = u.id;
    if (u.email.includes('minh@')) userMap.Minh = u.id;
    if (u.email.includes('huy@')) userMap.Huy = u.id;
    if (u.email.includes('mai@')) userMap.Mai = u.id;
  }

  // Fallback nếu thiếu key nào
  const firstUser = users[0]?.id;
  if (!userMap.Lan) userMap.Lan = firstUser;
  if (!userMap.Long) userMap.Long = firstUser;
  if (!userMap.Quang) userMap.Quang = firstUser;
  if (!userMap.Minh) userMap.Minh = firstUser;
  if (!userMap.Huy) userMap.Huy = firstUser;
  if (!userMap.Mai) userMap.Mai = firstUser;

  console.log(`👤 Đã tìm thấy ${users.length} tài khoản trong DB (được giữ nguyên 100%):`);
  users.forEach((u) => console.log(`   - ${u.fullName} (${u.email})`));

  // 3. Lấy danh mục Skills hiện có (KHÔNG XÓA SKILL)
  const skills = await prisma.skill.findMany({ where: { workspaceId: wsId } });
  const getSkillId = (name: string) => skills.find((s) => s.name === name)?.id;

  // 4. Đảm bảo cột Review có wipLimit = 2
  const reviewCol = project.columns.find((c) => c.statusKey === 'REVIEW');
  if (reviewCol && reviewCol.wipLimit !== 2) {
    await prisma.boardColumn.update({
      where: { id: reviewCol.id },
      data: { wipLimit: 2 },
    });
    console.log('   ✅ Đã cập nhật wipLimit = 2 cho cột Kiểm thử (REVIEW)');
  }

  // 5. CHỈ DỌN DẸP DỮ LIỆU CÔNG VIỆC CŨ (Tasks, Sprints, Burndown, Workload)
  console.log('🧹 Đang xóa các công việc, sprint và snapshot cũ của dự án...');
  await prisma.notification.deleteMany({});
  await prisma.comment.deleteMany({ where: { task: { projectId: project.id } } });
  await prisma.mention.deleteMany({});
  await prisma.attachment.deleteMany({ where: { task: { projectId: project.id } } });
  await prisma.activityLog.deleteMany({ where: { projectId: project.id } });
  await prisma.taskReview.deleteMany({ where: { task: { projectId: project.id } } });
  await prisma.timeEntry.deleteMany({ where: { task: { projectId: project.id } } });
  await prisma.taskAssignee.deleteMany({ where: { task: { projectId: project.id } } });
  await prisma.taskSkill.deleteMany({ where: { task: { projectId: project.id } } });
  await prisma.taskDependency.deleteMany({ where: { task: { projectId: project.id } } });
  await prisma.taskLabel.deleteMany({ where: { task: { projectId: project.id } } });
  await prisma.task.deleteMany({ where: { projectId: project.id } });
  await prisma.burndownSnapshot.deleteMany({ where: { sprint: { projectId: project.id } } });
  await prisma.sprint.deleteMany({ where: { projectId: project.id } });
  await prisma.workloadAlert.deleteMany({ where: { workspaceId: wsId } });
  await prisma.workloadSnapshot.deleteMany({ where: { workspaceId: wsId } });
  console.log('   ✅ Đã dọn dẹp sạch công việc cũ!');

  // 6. Cập nhật ngày dự án
  await prisma.project.update({
    where: { id: project.id },
    data: {
      startDate: day(-28),
      endDate: day(42),
    },
  });

  // 7. Tạo Sprint 1 (ACTIVE - Đang chạy từ Thứ 2 tuần này đến Chủ Nhật tuần sau)
  const sprint1 = await prisma.sprint.create({
    data: {
      id: ID.sprint1,
      projectId: project.id,
      name: 'Sprint 1',
      goal: 'Kiến trúc RBAC, Cổng Admin & Tích hợp Gemini AI',
      startDate: day(0),
      endDate: day(13),
      status: SprintStatus.ACTIVE,
      startedAt: day(0),
      scopeHoursInitial: 82,
    },
  });

  // 8. Tạo Sprint 2 (PLANNED - Kế hoạch tuần tiếp theo)
  const sprint2 = await prisma.sprint.create({
    data: {
      id: ID.sprint2,
      projectId: project.id,
      name: 'Sprint 2',
      goal: 'Cân bằng tải Workload & Trợ lý AI phân rã WBS',
      startDate: day(14),
      endDate: day(27),
      status: SprintStatus.PLANNED,
    },
  });

  console.log('   ✅ Đã tạo Sprints mới:');
  console.log(`      - Sprint 1 [ACTIVE]: ${sprint1.startDate.toISOString().slice(0, 10)} -> ${sprint1.endDate.toISOString().slice(0, 10)}`);
  console.log(`      - Sprint 2 [PLANNED]: ${sprint2.startDate.toISOString().slice(0, 10)} -> ${sprint2.endDate.toISOString().slice(0, 10)}`);

  // 9. Bản đồ cột
  const columns = await prisma.boardColumn.findMany({
    where: { projectId: project.id },
    orderBy: { position: 'asc' },
  });
  const colMap = (key: string) => {
    const col = columns.find((c) => c.statusKey === key);
    if (!col) throw new Error(`Column statusKey "${key}" không tồn tại!`);
    return col.id;
  };

  // 10. Danh sách 14 task mẫu với số giờ và tiến độ cân chỉnh cho demo
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
      start: 0,
      due: 2,
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
      start: 0,
      due: 3,
      progress: 100,
      done: true,
    },
    {
      title: 'Cấu hình AI Catalog & tích hợp Gemini 3.1 Flash-Lite',
      type: TaskType.TASK,
      col: 'REVIEW',
      sprint: sprint1.id,
      hours: 10,
      difficulty: 4,
      priority: Priority.HIGH,
      assignee: 'Minh',
      skill: 'NestJS',
      start: 1,
      due: 6,
      progress: 90,
    },
    {
      title: 'Tối ưu hoá truy vấn cơ sở dữ liệu và bộ nhớ đệm Redis',
      type: TaskType.STORY,
      col: 'IN_PROGRESS',
      sprint: sprint1.id,
      hours: 16,
      difficulty: 4,
      priority: Priority.HIGH,
      assignee: 'Minh',
      skill: 'NestJS',
      start: 1,
      due: 8,
      progress: 10,
    },
    {
      title: 'Xây dựng bộ kết nối thanh toán và quản lý giao dịch',
      type: TaskType.STORY,
      col: 'IN_PROGRESS',
      sprint: sprint1.id,
      hours: 21,
      difficulty: 5,
      priority: Priority.URGENT,
      assignee: 'Minh',
      skill: 'NestJS',
      start: 2,
      due: 9,
      progress: 10,
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
      start: 1,
      due: 7,
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
      start: 2,
      due: 9,
      progress: 40,
    },
    {
      title: 'Lỗi: kéo thẻ sang cột vượt WIP vẫn hiện toast thành công rồi mới hoàn tác',
      type: TaskType.BUG,
      col: 'IN_PROGRESS',
      sprint: sprint1.id,
      hours: 3,
      difficulty: 2,
      priority: Priority.HIGH,
      assignee: 'Huy',
      skill: 'React',
      start: 3,
      due: 8,
      progress: 40,
    },
    // Các task chưa phân công trong Sprint 1 -> Cho Member nhận hoặc PM giao
    {
      title: 'Nút nhận việc nhanh (+ Nhận task) cho các task chưa phân công',
      type: TaskType.STORY,
      col: 'TODO',
      sprint: sprint1.id,
      hours: 6,
      difficulty: 2,
      priority: Priority.MEDIUM,
      skill: 'React',
      start: 4,
      due: 10,
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
      start: 4,
      due: 11,
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
      start: 4,
      due: 10,
    },
    // Sprint 2 (Kế hoạch)
    {
      title: 'Cân bằng tải nhân sự theo ma trận kỹ năng phòng ban',
      type: TaskType.STORY,
      col: 'TODO',
      sprint: sprint2.id,
      hours: 16,
      difficulty: 5,
      priority: Priority.HIGH,
      skill: 'NestJS',
      start: 14,
      due: 21,
    },
    {
      title: 'Trợ lý AI phân rã WBS tự động bằng Gemini 2.5 Flash',
      type: TaskType.STORY,
      col: 'TODO',
      sprint: sprint2.id,
      hours: 12,
      difficulty: 4,
      priority: Priority.MEDIUM,
      skill: 'React',
      start: 16,
      due: 24,
    },
    // Backlog (chưa vào Sprint)
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
      start: 4,
      due: 20,
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
        remainingHours: t.done
          ? 0
          : Math.round(t.hours * (1 - (t.progress ?? 0) / 100)),
        progress: t.progress ?? 0,
        position: taskNumber * 1000,
        startDate: day(t.start),
        dueDate: day(t.due),
        createdById: userMap.Lan,
        startedAt: (t.progress ?? 0) > 0 ? day(t.start) : null,
        completedAt: t.done ? day(t.due) : null,
        assignees: t.assignee
          ? { create: [{ userId: userMap[t.assignee] }] }
          : undefined,
        skills: sid ? { create: [{ skillId: sid, minLevel: 3 }] } : undefined,
      },
    });
  }

  // Cập nhật bộ đếm taskCounter của project
  await prisma.project.update({
    where: { id: project.id },
    data: { taskCounter: taskNumber - 1 },
  });

  // 11. Tạo 4 bản chụp Burndown lịch sử cho Sprint 1 (Thứ Hai -> Thứ Năm)
  await prisma.burndownSnapshot.createMany({
    data: [
      {
        sprintId: sprint1.id,
        date: day(0),
        scopeHours: 82,
        remainingHours: 82,
        completedHours: 0,
      },
      {
        sprintId: sprint1.id,
        date: day(1),
        scopeHours: 82,
        remainingHours: 74,
        completedHours: 8,
      },
      {
        sprintId: sprint1.id,
        date: day(2),
        scopeHours: 82,
        remainingHours: 62,
        completedHours: 20,
      },
      {
        sprintId: sprint1.id,
        date: day(3),
        scopeHours: 82,
        remainingHours: 58,
        completedHours: 20,
      },
    ],
  });

  // 12. Thêm bình luận mẫu định dạng Markdown và @mention
  const task3 = await prisma.task.findFirst({
    where: { projectId: project.id, number: 3 },
  });
  if (task3) {
    await prisma.comment.create({
      data: {
        taskId: task3.id,
        authorId: userMap.Minh,
        body: '**Đã hoàn thành cấu hình Gemini API!** Nhờ @Lan (Owner/PM) kiểm tra và duyệt giúp nhé.',
        mentions: {
          create: [{ userId: userMap.Lan }],
        },
      },
    });
    await prisma.notification.create({
      data: {
        userId: userMap.Lan,
        type: 'MENTIONED',
        title: 'Trần Quang Minh đã nhắc đến bạn trong một bình luận',
        body: '**Đã hoàn thành cấu hình Gemini API!** Nhờ @Lan (Owner/PM) kiểm tra và duyệt giúp nhé.',
        data: { taskId: task3.id, projectId: project.id },
      },
    });
  }

  // 13. Nạp lịch sử Sprint 0A & 0B (cho Velocity và bằng chứng kỹ năng)
  await seedHistory(prisma);

  console.log('\n================================================================');
  console.log('🎉 RE-SEED CÔNG VIỆC THÀNH CÔNG RỰC RỠ! TẤT CẢ ACCOUNTS & API KEYS GIỮ NGUYÊN.');
  console.log('================================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi re-seed tasks:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
