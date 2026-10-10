import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, uniqueEmail } from './helpers';
import { trimQueryResult } from '../src/ai/query/query.service';

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
    // Mức tự khai không còn là bằng chứng (docs 02/08) — chủ workspace xác nhận thì mới tính
    await api()
      .patch(`/api/v1/users/${dev.id}/skills/${skillId}/verify`)
      .set(auth(pm))
      .send({ level: 5 })
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

  it('TASK_AGENDA "hôm nay tôi làm gì": gồm cả việc chưa xong đã quá hạn; TASK_LIST "hạn hôm nay" thì không', async () => {
    const agenda = await runQuery(dev, {
      intent: 'TASK_AGENDA',
      filters: { assignee: ['me'], dueRange: { preset: 'TODAY' } },
    }).expect(200);
    const labels = agenda.body.blocks
      .find((b: { kind: string }) => b.kind === 'agenda')
      .groups.map((g: { label: string }) => g.label);
    expect(labels.some((l: string) => l.startsWith('Quá hạn'))).toBe(true);
    expect(labels.some((l: string) => l.startsWith('Hôm nay'))).toBe(true);

    const list = await runQuery(dev, {
      intent: 'TASK_LIST',
      filters: { assignee: ['me'], dueRange: { preset: 'TODAY' } },
    }).expect(200);
    expect(list.body.blocks[0].items).toHaveLength(1);
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

  it('TASK_CANDIDATES: bảng ứng viên cho task thật và cho bản nháp trong phiên', async () => {
    const session = await api()
      .post('/api/v1/ai/sessions')
      .set(auth(pm))
      .send({ projectId, title: 'ai làm được việc này' })
      .expect(201);
    // Bảng mã của phiên: t1 → task chưa giao, k1 → kỹ năng; kèm một bản nháp d1 chưa ghi
    await prisma.aiProposal.create({
      data: {
        projectId,
        userId: pm.id,
        sessionId: session.body.id,
        kind: 'DECOMPOSE',
        status: 'DRAFT',
        payload: {
          action: {
            type: 'DECOMPOSE_PROPOSAL',
            schemaVersion: 1,
            reply: '',
            assumptions: [],
            tasks: [
              {
                draftKey: 'd1',
                title: 'Dựng màn báo cáo',
                estimateHours: 8,
                difficulty: 3,
                requiredSkills: [{ skill: 'k1', minLevel: 3 }],
                subtasks: [],
                dependsOn: [],
              },
            ],
          },
        },
        codeMap: {
          users: {},
          tasks: { t1: taskIds[2] },
          sprints: {},
          skills: { k1: skillId },
        },
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const ask = (query: Record<string, unknown>) =>
      api()
        .post('/api/v1/ai/query')
        .set(auth(pm))
        .send({ projectId, sessionId: session.body.id, query });

    const real = await ask({
      intent: 'TASK_CANDIDATES',
      filters: { task: 't1' },
    }).expect(200);
    const table = real.body.blocks.find(
      (b: { kind: string }) => b.kind === 'table',
    );
    expect(table.rows.length).toBeGreaterThan(0);
    expect(Object.keys(table.rows[0].cells)).toEqual(
      expect.arrayContaining(['member', 'match', 'effort', 'free', 'util']),
    );

    const draft = await ask({
      intent: 'TASK_CANDIDATES',
      filters: { draft: 'd1' },
    }).expect(200);
    expect(
      draft.body.blocks.find((b: { kind: string }) => b.kind === 'note').text,
    ).toContain('Dựng màn báo cáo');

    // Mã không có trong bảng mã → báo lỗi, không đoán
    const unknown = await ask({
      intent: 'TASK_CANDIDATES',
      filters: { task: 't99' },
    }).expect(422);
    expect(unknown.body.code).toBe('UNKNOWN_CODE');

    // Thành viên thường không được xem bảng giờ trống của cả nhóm → ghi chú, KHÔNG có số
    const member = await api()
      .post('/api/v1/ai/query')
      .set(auth(dev))
      .send({
        projectId,
        sessionId: session.body.id,
        query: { intent: 'TASK_CANDIDATES', filters: { task: 't1' } },
      })
      .expect(200);
    expect(member.body.blocks).toHaveLength(1);
    expect(member.body.blocks[0]).toMatchObject({
      kind: 'note',
      tone: 'warning',
    });
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

  it('rủi ro — quyền theo từng ý định: thành viên thường KHÔNG xem được bảng năng lực qua chat', async () => {
    // GET /projects/:id/capacity-table yêu cầu PM — hỏi qua trợ lý cũng phải chặn như vậy
    const direct = await api()
      .get(`/api/v1/projects/${projectId}/capacity-table`)
      .set(auth(dev))
      .expect(403);
    expect(direct.body.code).toBe('FORBIDDEN');

    const viaChat = await runQuery(dev, { intent: 'CAPACITY_FREE' }).expect(
      200,
    );
    expect(viaChat.body.blocks).toHaveLength(1);
    expect(viaChat.body.blocks[0].kind).toBe('note');
    expect(viaChat.body.source.rowCount).toBe(0);

    const asPm = await runQuery(pm, { intent: 'CAPACITY_FREE' }).expect(200);
    expect(
      asPm.body.blocks.some((b: { kind: string }) => b.kind === 'table'),
    ).toBe(true);
  });

  it('rủi ro — workspace bị đình chỉ / chỉ đọc: tra cứu tuân theo vòng đời như mọi API khác', async () => {
    const admin = { email: uniqueEmail('root'), token: '', id: '' };
    await register(admin, 'Quản trị nền tảng');
    await prisma.user.update({
      where: { id: admin.id },
      data: { isSuperAdmin: true, platformRole: 'ROOT_ADMIN' },
    });
    const setStatus = (status: string) =>
      api()
        .patch(`/api/v1/admin/workspaces/${wsId}/status`)
        .set(auth(admin))
        .send({ status, reason: 'kiểm thử tra cứu' })
        .expect(200);

    await setStatus('READ_ONLY_ENFORCED');
    await runQuery(pm, { intent: 'TASK_LIST' }).expect(200); // chỉ đọc vẫn tra cứu được

    await setStatus('SOFT_SUSPENDED');
    const blocked = await runQuery(pm, { intent: 'TASK_LIST' }).expect(403);
    expect(blocked.body.code).toBe('WORKSPACE_SUSPENDED');

    await setStatus('ACTIVE');
    await runQuery(pm, { intent: 'TASK_LIST' }).expect(200);
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

  it('rủi ro — hammer nút Làm mới: vượt trần thì bị chặn 429', async () => {
    // Dựng app riêng với trần thấp để kiểm chính cơ chế chặn (app chính đặt trần cao cho e2e)
    process.env.AI_QUERY_RATE_LIMIT_PER_MINUTE = '3';
    const { app: limited } = await createTestApp();
    try {
      const codes: number[] = [];
      for (let i = 0; i < 5; i++) {
        const r = await request(limited.getHttpServer())
          .post('/api/v1/ai/query')
          .set(auth(pm))
          .send({ projectId, query: { intent: 'TASK_LIST' } });
        codes.push(r.status);
      }
      expect(codes.filter((c) => c === 200).length).toBeLessThanOrEqual(3);
      expect(codes).toContain(429);
    } finally {
      await limited.close();
      process.env.AI_QUERY_RATE_LIMIT_PER_MINUTE = '500';
    }
  });

  it('rủi ro — phình lịch sử chat: kết quả quá dài bị rút gọn kèm ghi chú', () => {
    const many = Array.from({ length: 400 }, (_, i) => ({
      ref: { type: 'task' as const, id: `id-${i}`, key: `TC-${i}` },
      title: `Công việc số ${i} với tiêu đề dài để đẩy payload vượt trần lưu trữ`,
      badges: [{ text: 'Trung bình' }, { text: 'Task' }],
      meta: [{ icon: 'user' as const, text: 'Đỗ Lập Trình' }],
    }));
    const big = {
      intent: 'TASK_LIST' as const,
      generatedAt: new Date().toISOString(),
      source: {
        endpoint: 'GET /projects/:id/tasks',
        params: {},
        rowCount: 400,
      },
      blocks: [{ kind: 'task_list' as const, items: many }],
    };
    const before = Buffer.byteLength(JSON.stringify(big), 'utf8');
    const after = trimQueryResult(big);
    const size = Buffer.byteLength(JSON.stringify(after), 'utf8');
    expect(before).toBeGreaterThan(48_000);
    expect(size).toBeLessThanOrEqual(48_000);
    expect(after.blocks.at(-1)).toMatchObject({ kind: 'note' });
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

  it('một câu hỏi, một số: tra cứu sprint khớp tab Sprint và forecast, kể cả khi có việc con', async () => {
    // Việc con làm lệch số nếu nơi nào đó tự đếm lại mà quên lọc parentId
    const sub = await api()
      .post(`/api/v1/tasks/${taskIds[0]}/subtasks`)
      .set(auth(pm))
      .send({ title: 'Việc con kiểm số', estimateHours: 5 })
      .expect(201);
    const stat = (
      body: {
        blocks: { kind: string; items?: { label: string; value: unknown }[] }[];
      },
      label: string,
    ) =>
      body.blocks
        .find((b) => b.kind === 'stat_row')!
        .items!.find((i) => i.label === label)?.value;

    const sprints = await api()
      .get(`/api/v1/projects/${projectId}/sprints`)
      .set(auth(pm))
      .expect(200);
    const mine = sprints.body.find((x: { id: string }) => x.id === sprintId);
    const fc = await api()
      .get(`/api/v1/sprints/${sprintId}/forecast`)
      .set(auth(pm))
      .expect(200);

    const list = await runQuery(pm, { intent: 'SPRINT_LIST' }).expect(200);
    const row = list.body.blocks[0].rows.find(
      (r: { ref: { id: string } }) => r.ref.id === sprintId,
    );
    expect(row.cells.tasks).toBe(`${mine.doneCount}/${mine.taskCount}`);
    expect(row.cells.status).toBe('Đang chạy');

    const sp = await runQuery(pm, { intent: 'SPRINT_PROGRESS' }).expect(200);
    expect(stat(sp.body, 'Xong')).toBe(`${mine.doneCount}/${mine.taskCount}`);
    expect(stat(sp.body, 'Giờ còn lại')).toBe(
      Math.round(fc.body.remainingHours * 10) / 10,
    );
    expect(stat(sp.body, 'Vận tốc')).toBe(fc.body.velocity);
    expect(stat(sp.body, 'Còn')).toBe(fc.body.workdaysLeft);
    const chart = sp.body.blocks.find(
      (b: { kind: string }) => b.kind === 'line_chart',
    );
    const labels = chart.points.map((p: { label: string }) => p.label);
    expect(labels).toEqual([...labels].sort()); // đúng thứ tự ngày
    for (const p of chart.points as { value: unknown; compare: unknown }[]) {
      expect(p.value === null || typeof p.value === 'number').toBe(true); // không còn chuỗi "28"
      expect(p.compare === null || typeof p.compare === 'number').toBe(true);
    }

    const all = await runQuery(pm, {
      intent: 'SPRINT_PROGRESS',
      sprint: '__all',
    }).expect(200);
    expect(all.body.blocks[0].kind).toBe('note'); // không lặng lẽ trả sprint đang chạy

    // Thống kê không được cộng trên `limit` dòng đầu
    const full = await runQuery(pm, { intent: 'TASK_STATS' }).expect(200);
    const cut = await runQuery(pm, { intent: 'TASK_STATS', limit: 1 }).expect(
      200,
    );
    for (const label of ['Công việc', 'Quá hạn', 'Chưa giao', 'Giờ còn lại'])
      expect(stat(cut.body, label)).toBe(stat(full.body, label));

    await api()
      .delete(`/api/v1/tasks/${sub.body.id}`)
      .set(auth(pm))
      .expect(204);
  });

  it('ACTIVITY_FEED: nhãn tiếng Việt như màn hình, giờ địa phương, dòng sprint có tên và số việc thêm giữa sprint', async () => {
    const t = await api()
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set(auth(pm))
      .send({ title: 'Việc thêm giữa sprint', estimateHours: 2 })
      .expect(201);
    await api()
      .post(`/api/v1/sprints/${sprintId}/tasks`)
      .set(auth(pm))
      .send({ taskIds: [t.body.id] })
      .expect(201);
    // Listener ghi nhật ký bất đồng bộ — chờ tới khi dòng xuất hiện
    let item:
      | { title: string; subtitle?: string; meta: { text: string }[] }
      | undefined;
    for (let i = 0; i < 20 && !item; i++) {
      const act = await runQuery(pm, {
        intent: 'ACTIVITY_FEED',
        limit: 5,
      }).expect(200);
      item = act.body.blocks[0].items?.find((x: { title: string }) =>
        x.title.includes('đưa việc vào sprint'),
      );
      if (!item) await new Promise((r) => setTimeout(r, 100));
    }
    expect(item).toBeDefined();
    expect(item!.title).not.toMatch(/sprint\.|task\./); // không còn mã máy
    expect(item!.subtitle).toContain('Sprint tra cứu');
    expect(item!.subtitle).toContain('thêm sau khi sprint đã bắt đầu');
    expect(item!.meta[0].text).toMatch(/^\d{2}\/\d{2} \d{2}:\d{2}$/);
    await api().delete(`/api/v1/tasks/${t.body.id}`).set(auth(pm)).expect(204);
  });

  it('SPRINT_PROGRESS theo người: tổng giờ khớp forecast, lọc "của tôi", không có cột điểm', async () => {
    const sp = await runQuery(pm, { intent: 'SPRINT_PROGRESS' }).expect(200);
    const table = sp.body.blocks.find(
      (b: { kind: string }) => b.kind === 'table',
    );
    expect(table.title).toContain('Theo người');
    expect(table.columns.map((c: { key: string }) => c.key)).not.toContain(
      'score',
    );
    const fc = await api()
      .get(`/api/v1/sprints/${sprintId}/forecast`)
      .set(auth(pm))
      .expect(200);
    const total = table.rows.reduce(
      (x: number, r: { cells: { remaining: string } }) =>
        x + parseFloat(String(r.cells.remaining).replace(',', '.')),
      0,
    );
    expect(total).toBeCloseTo(fc.body.remainingHours, 0);

    const mine = await runQuery(dev, {
      intent: 'SPRINT_PROGRESS',
      filters: { assignee: ['me'] },
    }).expect(200);
    const rows = mine.body.blocks.find(
      (b: { kind: string }) => b.kind === 'table',
    ).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].ref.id).toBe(dev.id);
  });

  it('SPRINT_REPORT: chưa có sprint đóng → khối trống; đóng xong → việc bị chuyển đi khớp movedTaskIds', async () => {
    const none = await runQuery(pm, { intent: 'SPRINT_REPORT' }).expect(200);
    expect(none.body.blocks[0]).toMatchObject({ kind: 'empty' });

    const closed = await api()
      .post(`/api/v1/sprints/${sprintId}/close`)
      .set(auth(pm))
      .send({ moveOpenTo: 'backlog' })
      .expect(201);
    // Nhật ký sprint.closed (nguồn "bị chuyển đi") ghi bất đồng bộ
    let body: {
      blocks: {
        kind: string;
        title?: string;
        items?: { ref: { id: string } }[];
      }[];
    } = { blocks: [] };
    for (let i = 0; i < 20; i++) {
      body = (await runQuery(dev, { intent: 'SPRINT_REPORT' }).expect(200))
        .body;
      if (body.blocks.some((b) => b.title?.startsWith('Bị chuyển đi'))) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    const out = body.blocks.find((b) => b.title?.startsWith('Bị chuyển đi'))!;
    const rootMoved = (closed.body.movedTaskIds as string[]).filter((id) =>
      taskIds.includes(id),
    );
    expect(out.items!.map((i) => i.ref.id).sort()).toEqual(rootMoved.sort());
    expect(body.blocks.some((b) => b.title?.startsWith('Đã xong'))).toBe(true);
  });

  it('SPRINT_VELOCITY: cam kết/hoàn thành khớp danh sách sprint; lastN ngoài 1–10 bị từ chối', async () => {
    const list = await api()
      .get(`/api/v1/projects/${projectId}/sprints`)
      .set(auth(pm))
      .expect(200);
    const closed = list.body.find((x: { id: string }) => x.id === sprintId);
    expect(closed.status).toBe('CLOSED'); // đóng ở ca SPRINT_REPORT
    const v = await runQuery(pm, {
      intent: 'SPRINT_VELOCITY',
      filters: { lastN: 5 },
    }).expect(200);
    const table = v.body.blocks.find(
      (b: { kind: string }) => b.kind === 'table',
    );
    expect(table.rows).toHaveLength(1);
    // Chữ hiển thị theo kiểu Việt: 30.6 → "30,6 h"
    const vi = (n: number) =>
      `${n.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} h`;
    expect(table.rows[0].cells.committed).toBe(
      vi(Number(closed.scopeHoursInitial)),
    );
    expect(table.rows[0].cells.completed).toBe(vi(closed.completedHours));
    const chart = v.body.blocks.find(
      (b: { kind: string }) => b.kind === 'bar_chart',
    );
    expect(chart.series[0].compare).toBe(Number(closed.scopeHoursInitial));
    await runQuery(pm, {
      intent: 'SPRINT_VELOCITY',
      filters: { lastN: 11 },
    }).expect(400);
  });

  it('bộ lọc không lặng lẽ: cắt bộ lọc có nghĩa thì có ghi chú, mã rác thì cắt im; ACTIVITY_FEED lọc người và khoảng ngày', async () => {
    const withNote = await runQuery(pm, {
      intent: 'SPRINT_LIST',
      filters: { assignee: ['me'] },
    }).expect(200);
    const last = withNote.body.blocks.at(-1);
    expect(last.kind).toBe('note');
    expect(last.text).toContain('người thực hiện');

    const junk = await runQuery(pm, {
      intent: 'MEMBER_LIST',
      filters: { task: 't1' }, // LLM hay điền mã giả cho field không dùng
    }).expect(200);
    expect(
      junk.body.blocks.some((b: { kind: string }) => b.kind === 'note'),
    ).toBe(false);

    const mine = await runQuery(pm, {
      intent: 'ACTIVITY_FEED',
      filters: { user: 'me', range: 'TODAY' },
    }).expect(200);
    const items = mine.body.blocks[0].items as { title: string }[];
    expect(items.length).toBeGreaterThan(0);
    for (const it of items)
      expect(it.title.startsWith('Phạm Quản Lý')).toBe(true);
    expect(mine.body.source.params.range).toBe('TODAY');

    const yesterday = await runQuery(pm, {
      intent: 'ACTIVITY_FEED',
      filters: { range: 'YESTERDAY' },
    }).expect(200);
    expect(yesterday.body.blocks[0].kind).toBe('empty'); // mọi hoạt động của bộ test đều tạo hôm nay
  });

  it('TASK_BLOCKED: việc chờ việc chưa xong hiện kèm "chờ ST-x"; xong việc chặn thì hết bị chặn', async () => {
    const mk = async (title: string) =>
      (
        await api()
          .post(`/api/v1/projects/${projectId}/tasks`)
          .set(auth(pm))
          .send({ title, estimateHours: 2 })
          .expect(201)
      ).body as { id: string; number: number; version: number };
    const a = await mk('Chặn thử A');
    const b = await mk('Chặn thử B');
    await api()
      .put(`/api/v1/tasks/${b.id}/dependencies`)
      .set(auth(pm))
      .send({ version: b.version, dependsOnIds: [a.id] })
      .expect(200);
    const blocked = await runQuery(pm, {
      intent: 'TASK_BLOCKED',
      sprint: '__all',
      filters: { q: 'Chặn thử' },
    }).expect(200);
    const items = blocked.body.blocks[0].items as {
      ref: { id: string };
      meta: { text: string }[];
    }[];
    expect(items.map((i) => i.ref.id)).toEqual([b.id]);
    expect(items[0].meta.map((m) => m.text)).toContain(`chờ TC-${a.number}`);

    await prisma.task.update({
      where: { id: a.id },
      data: { completedAt: new Date() },
    });
    const free = await runQuery(pm, {
      intent: 'TASK_BLOCKED',
      sprint: '__all',
      filters: { q: 'Chặn thử' },
    }).expect(200);
    expect(free.body.blocks[0].kind).toBe('empty');
    for (const t of [a, b])
      await api().delete(`/api/v1/tasks/${t.id}`).set(auth(pm)).expect(204);
  });
});
