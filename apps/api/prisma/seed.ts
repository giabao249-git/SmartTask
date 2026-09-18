/**
 * Dữ liệu mẫu cho dev/demo (idempotent — chạy lại không tạo trùng). Chạy: npm run db:seed
 *   - 3 tài khoản lan/minh/huy@smarttask.local (mật khẩu Demo@1234)
 *   - workspace "SmartTask Demo" (slug smarttask-demo, Lan OWNER, Minh/Huy MEMBER) + 30 kỹ năng mẫu + danh tính/alias
 *   - dự án ST "SmartTask v1" (PM Lan) với cột mặc định, 1 sprint đang chạy + 1 sprint kế hoạch, 8 task
 * Phase 10 mở rộng thành bộ demo 3 tuần (docs/04-kien-truc/08 §5).
 */
import { PrismaClient, WorkspaceRole, ProjectRole, SprintStatus, Priority } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { DEFAULT_SKILLS } from '../src/skills/skill-seed';
import { defaultWorkspaceSettings } from '../src/workspaces/workspace-settings';

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
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + offset); // offset từ Thứ Hai tuần này
  return d;
};

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash('Demo@1234', 12);
  const users = [
    { email: 'lan@smarttask.local', fullName: 'Nguyễn Thị Lan', shortName: 'Lan' },
    { email: 'minh@smarttask.local', fullName: 'Trần Quang Minh', shortName: 'Minh' },
    { email: 'huy@smarttask.local', fullName: 'Lê Đức Huy', shortName: 'Huy' },
  ];
  const ids: Record<string, string> = {};
  for (const u of users) {
    const row = await prisma.user.upsert({ where: { email: u.email }, update: {}, create: { ...u, passwordHash } });
    ids[u.shortName] = row.id;
  }
  console.log(`Seed: ${users.length} tài khoản demo (mật khẩu Demo@1234)`);

  // ── Workspace ──
  let ws = await prisma.workspace.findUnique({ where: { slug: 'smarttask-demo' } });
  if (!ws) {
    ws = await prisma.workspace.create({
      data: {
        name: 'SmartTask Demo',
        slug: 'smarttask-demo',
        ownerId: ids.Lan,
        settings: defaultWorkspaceSettings(),
        members: {
          create: [
            { userId: ids.Lan, role: WorkspaceRole.OWNER, title: 'PM', department: 'Phòng Phát triển' },
            { userId: ids.Minh, role: WorkspaceRole.MEMBER, title: 'Backend', department: 'Phòng Phát triển', managerUserId: ids.Lan },
            { userId: ids.Huy, role: WorkspaceRole.MEMBER, title: 'Frontend', department: 'Phòng Phát triển', managerUserId: ids.Lan },
          ],
        },
      },
    });
    for (const s of DEFAULT_SKILLS)
      await prisma.skill.create({
        data: { workspaceId: ws.id, name: s.name, category: s.category, aliases: { create: (s.aliases ?? []).map((alias) => ({ alias })) } },
      });
    for (const [userId, alias] of [
      [ids.Lan, 'chị Lan'],
      [ids.Minh, 'Minh BE'],
      [ids.Huy, 'Huy FE'],
    ] as const)
      await prisma.memberAlias.create({ data: { workspaceId: ws.id, userId, alias, createdById: ids.Lan } });
    console.log('Seed: workspace SmartTask Demo + 30 kỹ năng + alias');
  }
  const wsId = ws.id;

  // ── Kỹ năng cá nhân ──
  const skills = await prisma.skill.findMany({ where: { workspaceId: wsId }, select: { id: true, name: true } });
  const skillId = (name: string) => skills.find((s) => s.name === name)?.id;
  const levels: Record<string, [string, number][]> = {
    Lan: [['React', 4], ['Next.js', 4], ['TypeScript', 4], ['Scrum / Agile', 5], ['Phân tích nghiệp vụ', 4]],
    Minh: [['NestJS', 5], ['Node.js', 4], ['PostgreSQL', 4], ['Prisma', 4], ['Docker', 3]],
    Huy: [['React', 4], ['Tailwind CSS', 4], ['HTML/CSS', 5], ['UI Testing', 3], ['Figma', 3]],
  };
  for (const [name, list] of Object.entries(levels))
    for (const [skill, level] of list) {
      const sid = skillId(skill);
      if (!sid) continue;
      await prisma.userSkill.upsert({
        where: { userId_skillId: { userId: ids[name], skillId: sid } },
        update: {},
        create: { userId: ids[name], skillId: sid, level },
      });
    }

  // ── Dự án ──
  let project = await prisma.project.findFirst({ where: { workspaceId: wsId, key: 'ST' } });
  if (!project) {
    project = await prisma.project.create({
      data: {
        workspaceId: wsId,
        key: 'ST',
        name: 'SmartTask v1',
        description: 'Nền tảng quản trị dự án Agile/Kanban cân bằng tải & AI Agent',
        startDate: day(-14),
        endDate: day(42),
        taskCounter: 8,
        members: {
          create: [
            { userId: ids.Lan, role: ProjectRole.PM },
            { userId: ids.Minh, role: ProjectRole.MEMBER },
            { userId: ids.Huy, role: ProjectRole.MEMBER },
          ],
        },
        columns: { create: DEFAULT_COLUMNS },
        labels: {
          create: [
            { name: 'backend', color: '#2563eb' },
            { name: 'frontend', color: '#16a34a' },
            { name: 'bug', color: '#dc2626' },
          ],
        },
      },
    });
    const columns = await prisma.boardColumn.findMany({ where: { projectId: project.id }, orderBy: { position: 'asc' } });
    const col = (key: string) => columns.find((c) => c.statusKey === key)!.id;
    const sprint1 = await prisma.sprint.create({
      data: { projectId: project.id, name: 'Sprint 1', goal: 'Đăng nhập & bảng Kanban', startDate: day(-7), endDate: day(4), status: SprintStatus.ACTIVE, startedAt: day(-7), scopeHoursInitial: 52 },
    });
    const sprint2 = await prisma.sprint.create({
      data: { projectId: project.id, name: 'Sprint 2', goal: 'Tải nhân sự & Trợ lý AI', startDate: day(7), endDate: day(18), status: SprintStatus.PLANNED },
    });
    const tasks: {
      title: string; col: string; sprint: string | null; hours: number; difficulty: number; priority: Priority; assignee?: string; skill?: string; start: number; due: number; progress?: number; done?: boolean;
    }[] = [
      { title: 'Thiết kế schema người dùng & workspace', col: 'DONE', sprint: sprint1.id, hours: 8, difficulty: 3, priority: Priority.HIGH, assignee: 'Minh', skill: 'Prisma', start: -7, due: -5, progress: 100, done: true },
      { title: 'API đăng nhập / refresh token', col: 'REVIEW', sprint: sprint1.id, hours: 12, difficulty: 4, priority: Priority.HIGH, assignee: 'Minh', skill: 'NestJS', start: -6, due: 1, progress: 80 },
      { title: 'Màn đăng nhập & AppShell', col: 'IN_PROGRESS', sprint: sprint1.id, hours: 10, difficulty: 3, priority: Priority.MEDIUM, assignee: 'Huy', skill: 'React', start: -4, due: 2, progress: 50 },
      { title: 'Bảng Kanban kéo thả có WIP', col: 'IN_PROGRESS', sprint: sprint1.id, hours: 16, difficulty: 4, priority: Priority.HIGH, assignee: 'Huy', skill: 'React', start: -3, due: 4, progress: 30 },
      { title: 'Socket.io phòng dự án + presence', col: 'TODO', sprint: sprint1.id, hours: 6, difficulty: 3, priority: Priority.MEDIUM, assignee: 'Minh', skill: 'Socket.io', start: 0, due: 4 },
      { title: 'Tính tải theo tuần & cảnh báo quá tải', col: 'TODO', sprint: sprint2.id, hours: 14, difficulty: 4, priority: Priority.HIGH, skill: 'NestJS', start: 7, due: 12 },
      { title: 'Màn Workload heatmap', col: 'TODO', sprint: sprint2.id, hours: 10, difficulty: 3, priority: Priority.MEDIUM, skill: 'React', start: 8, due: 14 },
      { title: 'Viết tài liệu API Swagger', col: 'TODO', sprint: null, hours: 4, difficulty: 2, priority: Priority.LOW, skill: 'Viết tài liệu', start: 0, due: 18 },
    ];
    let number = 1;
    for (const t of tasks) {
      const sid = t.skill ? skillId(t.skill) : undefined;
      await prisma.task.create({
        data: {
          projectId: project.id,
          sprintId: t.sprint,
          columnId: col(t.col),
          number: number++,
          title: t.title,
          priority: t.priority,
          difficulty: t.difficulty,
          estimateHours: t.hours,
          remainingHours: t.done ? 0 : Math.round(t.hours * (1 - (t.progress ?? 0) / 100)),
          progress: t.progress ?? 0,
          position: number * 1000,
          startDate: day(t.start),
          dueDate: day(t.due),
          createdById: ids.Lan,
          startedAt: (t.progress ?? 0) > 0 ? day(t.start) : null,
          completedAt: t.done ? day(t.due) : null,
          assignees: t.assignee ? { create: [{ userId: ids[t.assignee] }] } : undefined,
          skills: sid ? { create: [{ skillId: sid, minLevel: 3 }] } : undefined,
        },
      });
    }
    console.log(`Seed: dự án ST với ${tasks.length} task, 2 sprint`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
