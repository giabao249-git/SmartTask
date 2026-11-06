/**
 * Lịch sử dự án cho HỒ SƠ KỸ NĂNG TỪ BẰNG CHỨNG (docs 02/08): hai sprint đã đóng, việc đã xong có yêu cầu kỹ năng,
 * đánh giá của PM, giờ làm thực tế, một bug gắn việc gốc và một lần mở lại. Không có lịch sử thì engine chỉ
 * trả "chưa có bằng chứng" cho mọi người và vận tốc sprint luôn trống.
 *
 * Chạy kèm `prisma/seed.ts`, hoặc riêng (cộng thêm vào CSDL đang có, chạy lại không sinh trùng):
 *   npm run prisma:seed:history -w apps/api
 */
import { PrismaClient, SprintStatus, TaskType, Priority } from '@prisma/client';

const PROJECT = '33333333-3333-4333-8333-000000000001';
const USERS = {
  Long: '11111111-1111-4111-8111-000000000001',
  Lan: '11111111-1111-4111-8111-000000000002',
  Quang: '11111111-1111-4111-8111-000000000003',
  Minh: '11111111-1111-4111-8111-000000000004',
  Huy: '11111111-1111-4111-8111-000000000005',
} as const;
type Who = keyof typeof USERS;
const SPRINT_A = '44444444-4444-4444-8444-00000000000a';
const SPRINT_B = '44444444-4444-4444-8444-00000000000b';

/** Ngày tương đối so với thứ Hai tuần này (cùng quy ước với seed.ts). */
const day = (offset: number): Date => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + offset);
  return d;
};

interface HistTask {
  title: string;
  who: Who[];
  skills: [string, number][];
  hours: number;
  difficulty: number;
  sprint: 'A' | 'B';
  start: number;
  due: number;
  /** Ngày xong (lệch so với hạn để có đúng/trễ hạn) */
  done: number;
  type?: TaskType;
  /** Đánh giá của PM: [rating, độ khó thực tế, giờ thực tế xác nhận?] */
  review?: [number, number, number?];
  /** Giờ ghi theo ngày: [lệch ngày so với start, giờ] */
  log?: [number, number][];
  reopened?: boolean;
}

// Sprint A: day(-42) → day(-29) · Sprint B: day(-28) → day(-15)
const TASKS: HistTask[] = [
  {
    title: 'Khung NestJS: module, cấu hình, bộ lọc lỗi dùng chung',
    who: ['Minh'],
    skills: [['NestJS', 3]],
    hours: 8,
    difficulty: 3,
    sprint: 'A',
    start: -42,
    due: -39,
    done: -39,
    review: [4, 3, 7.5],
    log: [
      [0, 4],
      [1, 3.5],
    ],
  },
  {
    title: 'Lược đồ Prisma ban đầu + migration',
    who: ['Minh'],
    skills: [
      ['Prisma', 3],
      ['PostgreSQL', 3],
    ],
    hours: 10,
    difficulty: 3,
    sprint: 'A',
    start: -41,
    due: -37,
    done: -36,
    review: [4, 3, 11],
    log: [
      [0, 5],
      [1, 4],
      [2, 2],
    ],
  },
  {
    title: 'Đăng nhập email + refresh token xoay vòng',
    who: ['Minh'],
    skills: [
      ['NestJS', 3],
      ['Xác thực & bảo mật', 3],
    ],
    hours: 12,
    difficulty: 4,
    sprint: 'A',
    start: -38,
    due: -33,
    done: -32,
    review: [2, 4, 18],
    log: [
      [0, 6],
      [1, 6],
      [3, 6],
    ],
  },
  {
    title: 'Docker Compose cho Postgres + Elasticsearch',
    who: ['Long'],
    skills: [['Docker', 4]],
    hours: 6,
    difficulty: 3,
    sprint: 'A',
    start: -42,
    due: -40,
    done: -40,
    review: [4, 3, 5],
    log: [[0, 5]],
  },
  {
    title: 'Chỉ mục & truy vấn tìm kiếm không dấu',
    who: ['Long'],
    skills: [['PostgreSQL', 3]],
    hours: 8,
    difficulty: 3,
    sprint: 'A',
    start: -39,
    due: -36,
    done: -36,
    review: [4, 3],
  },
  {
    title: 'Khung Next.js App Router + shadcn',
    who: ['Huy'],
    skills: [
      ['Next.js', 3],
      ['React', 3],
    ],
    hours: 8,
    difficulty: 3,
    sprint: 'A',
    start: -42,
    due: -39,
    done: -38,
    review: [4, 3, 9],
    log: [
      [0, 4],
      [1, 5],
    ],
  },
  {
    title: 'Form đăng nhập + xử lý lỗi hiển thị',
    who: ['Huy'],
    skills: [['React', 3]],
    hours: 6,
    difficulty: 2,
    sprint: 'A',
    start: -37,
    due: -35,
    done: -34,
    review: [3, 2],
  },
  {
    title: 'Phân tích yêu cầu phân quyền 3 cấp',
    who: ['Lan'],
    skills: [['Phân tích nghiệp vụ', 3]],
    hours: 6,
    difficulty: 3,
    sprint: 'A',
    start: -42,
    due: -40,
    done: -40,
    review: [4, 3],
  },
  {
    title: 'Kiến trúc chia module & quy ước API',
    who: ['Quang'],
    skills: [
      ['NestJS', 4],
      ['REST API', 4],
    ],
    hours: 8,
    difficulty: 5,
    sprint: 'A',
    start: -42,
    due: -38,
    done: -38,
    review: [5, 5, 8],
  },

  {
    title: 'API workspace + lời mời thành viên',
    who: ['Minh'],
    skills: [
      ['NestJS', 3],
      ['REST API', 3],
    ],
    hours: 10,
    difficulty: 4,
    sprint: 'B',
    start: -28,
    due: -24,
    done: -24,
    review: [5, 4, 9],
    log: [
      [0, 5],
      [1, 4],
    ],
  },
  {
    title: 'Khoá lạc quan theo version cho task',
    who: ['Minh'],
    skills: [['Prisma', 3]],
    hours: 6,
    difficulty: 3,
    sprint: 'B',
    start: -24,
    due: -22,
    done: -21,
    reopened: true,
  },
  {
    title: 'Bảng Kanban đọc cột + thẻ',
    who: ['Huy'],
    skills: [
      ['React', 3],
      ['Tailwind CSS', 2],
    ],
    hours: 10,
    difficulty: 3,
    sprint: 'B',
    start: -28,
    due: -24,
    done: -23,
    review: [4, 3, 11],
    log: [
      [0, 5],
      [2, 6],
    ],
  },
  {
    title: 'Kiểm thử giao diện đăng nhập bằng Puppeteer',
    who: ['Huy'],
    skills: [['UI Testing', 2]],
    hours: 4,
    difficulty: 2,
    sprint: 'B',
    start: -23,
    due: -22,
    done: -22,
  },
  {
    title: 'Kiểm thử giao diện Kanban',
    who: ['Huy'],
    skills: [['UI Testing', 2]],
    hours: 4,
    difficulty: 2,
    sprint: 'B',
    start: -21,
    due: -19,
    done: -18,
  },
  {
    title: 'CI chạy lint + e2e trên Postgres tạm',
    who: ['Long'],
    skills: [
      ['Docker', 4],
      ['CI/CD', 3],
    ],
    hours: 8,
    difficulty: 4,
    sprint: 'B',
    start: -28,
    due: -25,
    done: -25,
    review: [4, 4, 8],
  },
  {
    title: 'Luồng đặt lại mật khẩu qua email',
    who: ['Minh', 'Huy'],
    skills: [
      ['NestJS', 3],
      ['React', 2],
    ],
    hours: 8,
    difficulty: 3,
    sprint: 'B',
    start: -22,
    due: -18,
    done: -17,
    review: [4, 3],
  },
  {
    title: 'Viết đặc tả luồng Sprint & báo cáo',
    who: ['Lan'],
    skills: [['Phân tích nghiệp vụ', 3]],
    hours: 5,
    difficulty: 3,
    sprint: 'B',
    start: -27,
    due: -25,
    done: -25,
    review: [4, 3],
  },
];

export async function seedHistory(
  prisma: PrismaClient,
): Promise<{ created: number } | null> {
  if (await prisma.sprint.findUnique({ where: { id: SPRINT_A } })) return null;
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: PROJECT },
    select: {
      workspaceId: true,
      columns: { select: { id: true, isDone: true, position: true } },
    },
  });
  const done = project.columns.find((c) => c.isDone)!;
  const skills = await prisma.skill.findMany({
    where: { workspaceId: project.workspaceId },
    select: { id: true, name: true },
  });
  const skillId = (n: string) => {
    const s = skills.find((x) => x.name === n);
    if (!s)
      throw new Error(`seed-history: không có kỹ năng "${n}" trong danh mục`);
    return s.id;
  };
  const hoursOf = (s: 'A' | 'B') =>
    TASKS.filter((t) => t.sprint === s).reduce((x, t) => x + t.hours, 0);
  const SHIFT = 14;
  await prisma.sprint.createMany({
    data: [
      {
        id: SPRINT_A,
        projectId: PROJECT,
        name: 'Sprint 0A · Khởi động',
        goal: 'Khung API, CSDL, giao diện và hạ tầng chạy được',
        startDate: day(-42 + SHIFT),
        endDate: day(-29 + SHIFT),
        status: SprintStatus.CLOSED,
        startedAt: day(-42 + SHIFT),
        closedAt: day(-29 + SHIFT),
        scopeHoursInitial: hoursOf('A'),
      },
      {
        id: SPRINT_B,
        projectId: PROJECT,
        name: 'Sprint 0B · Nền móng',
        goal: 'Workspace, Kanban đọc được, CI',
        startDate: day(-28 + SHIFT),
        endDate: day(-15 + SHIFT),
        status: SprintStatus.CLOSED,
        startedAt: day(-28 + SHIFT),
        closedAt: day(-15 + SHIFT),
        scopeHoursInitial: hoursOf('B'),
      },
    ],
  });

  // Số việc: nối tiếp bộ đếm hiện có (không dùng lại số — seed cũ từng để bộ đếm thấp hơn số đã dùng)
  const max = await prisma.task.aggregate({
    where: { projectId: PROJECT },
    _max: { number: true },
  });
  let number = Math.max(
    max._max.number ?? 0,
    (
      await prisma.project.findUniqueOrThrow({
        where: { id: PROJECT },
        select: { taskCounter: true },
      })
    ).taskCounter,
  );
  const ids: Record<string, string> = {};
  for (const t of TASKS) {
    number += 1;
    const startOff = t.start + SHIFT;
    const dueOff = t.due + SHIFT;
    const doneOff = t.done + SHIFT;
    const completedAt = new Date(day(doneOff).getTime() + 16 * 3600_000);
    const row = await prisma.task.create({
      data: {
        projectId: PROJECT,
        sprintId: t.sprint === 'A' ? SPRINT_A : SPRINT_B,
        columnId: done.id,
        number,
        title: t.title,
        type: t.type ?? TaskType.TASK,
        priority: Priority.MEDIUM,
        difficulty: t.difficulty,
        estimateHours: t.hours,
        remainingHours: 0,
        progress: 100,
        position: number * 1000,
        startDate: day(startOff),
        dueDate: day(dueOff),
        createdById: USERS.Lan,
        createdAt: day(startOff - 2),
        startedAt: day(startOff),
        completedAt,
        assignees: {
          create: t.who.map((w) => ({
            userId: USERS[w],
            assignedAt: day(startOff - 1),
          })),
        },
        skills: {
          create: t.skills.map(([n, m]) => ({
            skillId: skillId(n),
            minLevel: m,
          })),
        },
        ...(t.review
          ? {
              review: {
                create: {
                  // Việc của PM do quản trị workspace chấm (không tự chấm)
                  reviewerId: t.who.includes('Lan') ? USERS.Quang : USERS.Lan,
                  rating: t.review[0],
                  difficultyActual: t.review[1],
                  actualHoursConfirmed: t.review[2] ?? null,
                  createdAt: new Date(completedAt.getTime() + 3600_000),
                },
              },
            }
          : {}),
        ...(t.log
          ? {
              timeEntries: {
                create: t.log.map(([off, h]) => ({
                  userId: USERS[t.who[0]],
                  workDate: day(startOff + off),
                  hours: h,
                })),
              },
            }
          : {}),
      },
      select: { id: true },
    });
    ids[t.title] = row.id;
    if (t.reopened) {
      // Nhật ký y như khi kéo thẻ khỏi cột Xong (ActivityListener ghi `task.moved`)
      await prisma.activityLog.create({
        data: {
          projectId: PROJECT,
          taskId: row.id,
          actorId: USERS.Lan,
          action: 'task.moved',
          diff: { completedAt: { from: completedAt.toISOString(), to: null } },
          createdAt: new Date(completedAt.getTime() + 2 * 3600_000),
        },
      });
    }
  }
  // Bug sinh ra từ việc gốc → việc gốc tính là "phải làm lại"
  number += 1;
  const origin = ids['Bảng Kanban đọc cột + thẻ'];
  await prisma.task.create({
    data: {
      projectId: PROJECT,
      sprintId: SPRINT_B,
      columnId: done.id,
      number,
      title: 'Lỗi: thẻ Kanban mất nhãn sau khi tải lại',
      type: TaskType.BUG,
      priority: Priority.HIGH,
      difficulty: 2,
      estimateHours: 2,
      remainingHours: 0,
      progress: 100,
      position: number * 1000,
      startDate: day(-20),
      dueDate: day(-19),
      createdById: USERS.Lan,
      createdAt: day(-20),
      startedAt: day(-20),
      completedAt: new Date(day(-19).getTime() + 16 * 3600_000),
      originTaskId: origin,
      assignees: { create: [{ userId: USERS.Huy }] },
    },
  });
  await prisma.project.update({
    where: { id: PROJECT },
    data: { taskCounter: number },
  });
  return { created: TASKS.length + 1 };
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedHistory(prisma)
    .then((r) =>
      console.log(
        r
          ? `✔ Đã thêm lịch sử: 2 sprint đã đóng, ${r.created} việc đã xong`
          : '• Lịch sử đã có — bỏ qua',
      ),
    )
    .catch((e) => {
      console.error('❌ seed-history:', e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
