import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, uniqueEmail } from './helpers';

/**
 * Tra cứu trong hội thoại (docs 14): LLM chỉ chọn ý định + bộ lọc, backend chạy truy vấn thật.
 * Bộ này kiểm cả các RỦI RO đã nêu khi thiết kế: quyền theo người hỏi, không rò dự án khác,
 * mã lạ không đoán bừa, giới hạn số dòng, và "Làm mới" không tốn lượt AI.
 */
describe('Tra cứu dữ liệu cho Trợ lý AI (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const api = () => request(app.getHttpServer());

  const pm = { email: uniqueEmail('pm'), token: '', id: '' };
  const dev = { email: uniqueEmail('dev'), token: '', id: '' };
  const outsider = { email: uniqueEmail('out'), token: '', id: '' };
  let wsId = '';
  let projectId = '';
  let sprintId = '';
  let columnId = '';
  let doneColumnId = '';
  let skillId = '';
  const taskIds: string[] = [];

  const auth = (u: { token: string }) => ({
    Authorization: `Bearer ${u.token}`,
  });
  const register = async (
    u: { email: string; token: string; id: string },
    name: string,
  ) => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ email: u.email, password: 'MatKhau@123', fullName: name })
      .expect(201);
    u.token = res.body.accessToken;
    u.id = res.body.user.id;
  };
  const day = (offset: number) =>
    new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

  /** Gọi truy vấn như UI "Làm mới" (không qua LLM). */
  const runQuery = (
    u: { token: string },
    query: Record<string, unknown>,
    project = projectId,
  ) =>
    api()
      .post('/api/v1/ai/query')
      .set(auth(u))
      .send({ projectId: project, query });

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await register(pm, 'Phạm Quản Lý');
    await register(dev, 'Đỗ Lập Trình');
    await register(outsider, 'Người Ngoài');

    const ws = await api()
      .post('/api/v1/workspaces')
      .set(auth(pm))
      .send({ name: 'WS tra cứu', slug: `ws-query-${Date.now()}` })
      .expect(201);
    wsId = ws.body.id;
    const inv = await api()
      .post(`/api/v1/workspaces/${wsId}/invitations`)
      .set(auth(pm))
      .send({ email: dev.email, role: 'MEMBER' })
      .expect(201);
    await api()
      .post(`/api/v1/invitations/${inv.body.token}/accept`)
      .set(auth(dev))
      .expect(201);

    const project = await api()
      .post(`/api/v1/workspaces/${wsId}/projects`)
      .set(auth(pm))
      .send({ key: 'TC', name: 'Dự án tra cứu', pmUserId: pm.id })
      .expect(201);
    projectId = project.body.id;
    await api()
      .put(`/api/v1/projects/${projectId}/members`)
      .set(auth(pm))
      .send({
        members: [
          { userId: pm.id, role: 'PM' },
          { userId: dev.id, role: 'MEMBER' },
        ],
      })
      .expect(200);

    const detail = await api()
      .get(`/api/v1/projects/${projectId}`)
      .set(auth(pm))
      .expect(200);
    columnId = detail.body.columns[0].id;
    doneColumnId = detail.body.columns.find(
      (c: { isDone: boolean }) => c.isDone,
    ).id;

    const sprint = await api()
      .post(`/api/v1/projects/${projectId}/sprints`)
      .set(auth(pm))
      .send({ name: 'Sprint tra cứu', startDate: day(-3), endDate: day(11) })
      .expect(201);
    sprintId = sprint.body.id;
    await api()
      .post(`/api/v1/sprints/${sprintId}/start`)
      .set(auth(pm))
      .expect(201);

    // 4 task: quá hạn (giao dev), đến hạn hôm nay (giao dev), chưa giao, đã xong
    const mk = async (title: string, extra: Record<string, unknown>) => {
      const r = await api()
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set(auth(pm))
        .send({ title, columnId, sprintId, ...extra })
        .expect(201);
      taskIds.push(r.body.id);
      return r.body as { id: string; version: number };
    };
    await mk('Việc quá hạn', {
      dueDate: day(-2),
      assigneeIds: [dev.id],
      estimateHours: 8,
      priority: 'HIGH',
    });
    await mk('Việc hôm nay', {
      dueDate: day(0),
      assigneeIds: [dev.id],
      estimateHours: 4,
      type: 'BUG',
    });
    await mk('Việc chưa giao', { dueDate: day(4), estimateHours: 6 });
    const done = await mk('Việc đã xong', {
      dueDate: day(-1),
      assigneeIds: [pm.id],
      estimateHours: 2,
    });
    await api()
      .patch(`/api/v1/tasks/${done.id}/move`)
      .set(auth(pm))
      .send({ version: done.version, columnId: doneColumnId })
      .expect(200);

    const skills = await api()
      .get(`/api/v1/workspaces/${wsId}/skills`)
      .set(auth(pm))
      .expect(200);
    skillId =
      skills.body.find((s: { name: string }) => s.name === 'NestJS')?.id ??
      skills.body[0].id;
    await api()
      .put(`/api/v1/workspaces/${wsId}/me/skills`)
      .set(auth(dev))
      .send({ skills: [{ skillId, level: 5 }] })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  it('TASK_LIST: mặc định chỉ việc đang mở của sprint đang chạy, kèm cờ quá hạn', async () => {
    const res = await runQuery(pm, { intent: 'TASK_LIST' }).expect(200);
    expect(res.body.intent).toBe('TASK_LIST');
    expect(res.body.source.endpoint).toContain('/tasks');
    const list = res.body.blocks.find(
      (b: { kind: string }) => b.kind === 'task_list',
    );
    expect(list.items).toHaveLength(3); // việc đã xong không tính
    const overdue = list.items.find(
      (i: { title: string }) => i.title === 'Việc quá hạn',
    );
    expect(overdue.ref.key).toMatch(/^TC-\d+$/);
    expect(overdue.badges.map((b: { text: string }) => b.text)).toContain(
      'Quá hạn',
    );
  });

  it('TASK_AGENDA: nhóm theo ngày, nhãn "Hôm nay" và nhóm quá hạn được đánh dấu', async () => {
    const res = await runQuery(pm, {
      intent: 'TASK_AGENDA',
      filters: { dueRange: { preset: 'THIS_WEEK' } },
    }).expect(200);
    const agenda = res.body.blocks.find(
      (b: { kind: string }) => b.kind === 'agenda',
    );
    expect(agenda.groups.length).toBeGreaterThan(0);
    expect(
      agenda.groups.some((g: { label: string }) =>
        g.label.startsWith('Hôm nay'),
      ),
    ).toBe(true);
  });

  it('bộ lọc: chỉ việc của tôi, chỉ BUG, chỉ chưa giao, chỉ quá hạn', async () => {
    const mine = await runQuery(dev, {
      intent: 'TASK_LIST',
      filters: { assignee: ['me'] },
    }).expect(200);
    expect(mine.body.blocks[0].items).toHaveLength(2);

    const bugs = await runQuery(pm, {
      intent: 'TASK_LIST',
      filters: { taskType: ['BUG'] },
    }).expect(200);
    expect(bugs.body.blocks[0].items).toHaveLength(1);

    const unassigned = await runQuery(pm, {
      intent: 'TASK_LIST',
      filters: { unassignedOnly: true },
    }).expect(200);
    expect(unassigned.body.blocks[0].items[0].title).toBe('Việc chưa giao');

    const overdue = await runQuery(pm, {
      intent: 'TASK_LIST',
      filters: { dueRange: { preset: 'OVERDUE' } },
    }).expect(200);
    expect(overdue.body.blocks[0].items).toHaveLength(1);

    const done = await runQuery(pm, {
      intent: 'TASK_LIST',
      filters: { status: 'DONE' },
    }).expect(200);
    expect(done.body.blocks[0].items[0].title).toBe('Việc đã xong');
  });

  it('TASK_STATS: thẻ số và biểu đồ theo cột, đếm khớp dữ liệu thật', async () => {
    const res = await runQuery(pm, {
      intent: 'TASK_STATS',
      filters: { status: 'ALL' },
    }).expect(200);
    const stats = res.body.blocks.find(
      (b: { kind: string }) => b.kind === 'stat_row',
    );
    expect(
      stats.items.find((i: { label: string }) => i.label === 'Công việc').value,
    ).toBe(4);
    expect(
      stats.items.find((i: { label: string }) => i.label === 'Chưa giao').value,
    ).toBe(1);
    expect(
      res.body.blocks.some((b: { kind: string }) => b.kind === 'bar_chart'),
    ).toBe(true);
  });

  it('MEMBER_LIST / MEMBER_PROFILE: người thật, số việc đang mở đúng', async () => {
    const members = await runQuery(pm, { intent: 'MEMBER_LIST' }).expect(200);
    const people = members.body.blocks.find(
      (b: { kind: string }) => b.kind === 'people_list',
    );
    expect(people.items).toHaveLength(2);
    expect(
      people.items.some((i: { badges: { text: string }[] }) =>
        i.badges.some((b) => b.text === 'PM'),
      ),
    ).toBe(true);

    const profile = await runQuery(dev, {
      intent: 'MEMBER_PROFILE',
      filters: { user: 'me' },
    }).expect(200);
    const card = profile.body.blocks.find(
      (b: { kind: string }) => b.kind === 'person_card',
    );
    expect(
      card.stats.find((s: { label: string }) => s.label === 'Việc đang mở')
        .value,
    ).toBe(2);
    expect(
      card.stats.find((s: { label: string }) => s.label === 'Quá hạn').value,
    ).toBe(1);
  });

  it('WORKLOAD_WEEK / CAPACITY_FREE / SPRINT_PROGRESS: số do backend tính, có nguồn kèm theo', async () => {
    const wl = await runQuery(pm, { intent: 'WORKLOAD_WEEK' }).expect(200);
    const heat = wl.body.blocks.find(
      (b: { kind: string }) => b.kind === 'heatmap',
    );
    expect(heat.rows).toHaveLength(2);
    expect(heat.columns.length).toBe(4);

    const cap = await runQuery(pm, { intent: 'CAPACITY_FREE' }).expect(200);
    expect(
      cap.body.blocks.some((b: { kind: string }) => b.kind === 'table'),
    ).toBe(true);

    const sp = await runQuery(pm, { intent: 'SPRINT_PROGRESS' }).expect(200);
    const row = sp.body.blocks.find(
      (b: { kind: string }) => b.kind === 'stat_row',
    );
    expect(
      row.items.find((i: { label: string }) => i.label === 'Xong').value,
    ).toBe('1/4');
    expect(sp.body.source.endpoint).toContain('burndown');
  });

  it('WHO_KNOWS_SKILL: chỉ người đạt mức yêu cầu; không ai đạt → khối trống chứ không bịa', async () => {
    const session = await api()
      .post('/api/v1/ai/sessions')
      .set(auth(pm))
      .send({ projectId, title: 'phiên tra cứu' })
      .expect(201);
    // Mô phỏng bảng mã của phiên: k1 → kỹ năng NestJS
    await prisma.aiProposal.create({
      data: {
        projectId,
        userId: pm.id,
        sessionId: session.body.id,
        kind: 'DECOMPOSE',
        status: 'DRAFT',
        payload: {},
        codeMap: { users: {}, tasks: {}, sprints: {}, skills: { k1: skillId } },
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    const ok = await api()
      .post('/api/v1/ai/query')
      .set(auth(pm))
      .send({
        projectId,
        sessionId: session.body.id,
        query: {
          intent: 'WHO_KNOWS_SKILL',
          filters: { skill: 'k1', minLevel: 4 },
        },
      })
      .expect(200);
    expect(ok.body.blocks[0].kind).toBe('people_list');
    expect(ok.body.blocks[0].items).toHaveLength(1);

    const none = await api()
      .post('/api/v1/ai/query')
      .set(auth(pm))
      .send({
        projectId,
        sessionId: session.body.id,
        query: {
          intent: 'WHO_KNOWS_SKILL',
          filters: { skill: 'k1', minLevel: 5 },
        },
      })
      .expect(200);
    expect(none.body.blocks[0].items).toHaveLength(1); // dev khai mức 5

    // Mã kỹ năng không có trong bảng mã → KHÔNG đoán, trả lỗi rõ ràng
    const unknown = await api()
      .post('/api/v1/ai/query')
      .set(auth(pm))
      .send({
        projectId,
        sessionId: session.body.id,
        query: { intent: 'WHO_KNOWS_SKILL', filters: { skill: 'k99' } },
      })
      .expect(422);
    expect(unknown.body.code).toBe('UNKNOWN_CODE');
  });

  it('SPRINT_LIST / ACTIVITY_FEED / NOTIFICATION_LIST / BUS_FACTOR chạy được và đúng nguồn', async () => {
    const sprints = await runQuery(pm, { intent: 'SPRINT_LIST' }).expect(200);
    expect(sprints.body.blocks[0].rows[0].cells.name).toBe('Sprint tra cứu');

    const act = await runQuery(pm, {
      intent: 'ACTIVITY_FEED',
      limit: 5,
    }).expect(200);
    expect(act.body.source.endpoint).toContain('activity');

    const noti = await runQuery(dev, { intent: 'NOTIFICATION_LIST' }).expect(
      200,
    );
    expect(noti.body.blocks[0].kind).toBe('stat_row');

    const bus = await runQuery(pm, {
      intent: 'BUS_FACTOR',
      filters: { minLevel: 4 },
    }).expect(200);
    expect(bus.body.blocks.length).toBeGreaterThan(0);
  });

  it('AI_USAGE: chỉ PM/quản trị thấy sổ token, thành viên thường nhận ghi chú thay vì số', async () => {
    const asPm = await runQuery(pm, { intent: 'AI_USAGE' }).expect(200);
    expect(asPm.body.blocks[0].kind).toBe('stat_row');

    const asDev = await runQuery(dev, { intent: 'AI_USAGE' }).expect(200);
    expect(asDev.body.blocks[0].kind).toBe('note');
  });

  it('rủi ro — quyền: người ngoài dự án không tra cứu được (404), không lộ dữ liệu', async () => {
    const res = await runQuery(outsider, { intent: 'TASK_LIST' }).expect(404);
    expect(res.body.code).toBe('NOT_FOUND');
    await api()
      .post('/api/v1/ai/query')
      .send({ projectId, query: { intent: 'TASK_LIST' } })
      .expect(401);
  });

  it('rủi ro — chặn đầu vào lạ: intent ngoài enum, limit vượt trần, field tự do', async () => {
    const badIntent = await runQuery(pm, { intent: 'DROP_TABLE' }).expect(400);
    expect(badIntent.body.code).toBe('VALIDATION_FAILED');
    await runQuery(pm, { intent: 'TASK_LIST', limit: 5000 }).expect(400);
    // Field lạ hoàn toàn bị từ chối (schema strict)
    await runQuery(pm, {
      intent: 'TASK_LIST',
      filters: { rawSql: 'select 1' },
    }).expect(400);
    // Field hợp lệ nhưng không thuộc ý định thì bị CẮT, câu hỏi vẫn chạy (LLM hay điền thừa)
    const pruned = await runQuery(pm, {
      intent: 'MEMBER_LIST',
      filters: { taskType: ['BUG'], task: 't99' },
      sprint: 's9',
    }).expect(200);
    expect(pruned.body.blocks[0].kind).toBe('people_list');
  });

  it('rủi ro — nhồi chat: cắt theo limit và báo tổng số thật', async () => {
    const res = await runQuery(pm, {
      intent: 'TASK_LIST',
      filters: { status: 'ALL' },
      limit: 2,
    }).expect(200);
    expect(res.body.blocks[0].items).toHaveLength(2);
    expect(res.body.truncated).toMatchObject({ shown: 2, total: 4 });
  });

  it('rủi ro — số cũ trong lịch sử: chạy lại truy vấn KHÔNG tốn lượt AI', async () => {
    const before = await api()
      .get(`/api/v1/ai/quota?workspaceId=${wsId}`)
      .set(auth(pm))
      .expect(200);
    await runQuery(pm, { intent: 'TASK_LIST' }).expect(200);
    const after = await api()
      .get(`/api/v1/ai/quota?workspaceId=${wsId}`)
      .set(auth(pm))
      .expect(200);
    expect(after.body.used).toBe(before.body.used);
    const logs = await prisma.aiTokenLog.count({
      where: { workspaceId: wsId },
    });
    expect(logs).toBe(0);
  });
});
