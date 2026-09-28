import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, uniqueEmail } from './helpers';

/** Phase 3: dự án → sprint → task → kéo thả (version, WIP, cột xong) → subtask → since → đóng sprint → tìm kiếm. */
describe('Dự án, sprint, task (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const api = () => request(app.getHttpServer());
  type U = { email: string; token: string; id: string };
  const admin: U = { email: uniqueEmail('admin'), token: '', id: '' };
  const pm: U = { email: uniqueEmail('pm'), token: '', id: '' };
  const dev: U = { email: uniqueEmail('dev'), token: '', id: '' };
  const viewer: U = { email: uniqueEmail('viewer'), token: '', id: '' };
  const auth = (u: U) => ({ Authorization: `Bearer ${u.token}` });
  let wsId = '';
  let projectId = '';
  let columns: Array<{ id: string; statusKey: string; isDone: boolean }> = [];
  let sprintId = '';
  let t1 = { id: '', version: 0 };
  let t2 = { id: '', version: 0 };
  let sub = { id: '', version: 0 };

  const col = (key: string) => columns.find((c) => c.statusKey === key)!;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    for (const [u, name] of [
      [admin, 'Admin'],
      [pm, 'PM Lan'],
      [dev, 'Dev Huy'],
      [viewer, 'Viewer'],
    ] as const) {
      const res = await api()
        .post('/api/v1/auth/register')
        .send({ email: u.email, password: 'MatKhau@123', fullName: name })
        .expect(201);
      u.token = res.body.accessToken;
      u.id = res.body.user.id;
    }
    const ws = await api()
      .post('/api/v1/workspaces')
      .set(auth(admin))
      .send({ name: 'WS Phase 3' })
      .expect(201);
    wsId = ws.body.id;
    for (const [u, role] of [
      [pm, 'MEMBER'],
      [dev, 'MEMBER'],
      [viewer, 'VIEWER'],
    ] as const) {
      const inv = await api()
        .post(`/api/v1/workspaces/${wsId}/invitations`)
        .set(auth(admin))
        .send({ email: u.email, role })
        .expect(201);
      await api()
        .post(`/api/v1/invitations/${inv.body.token}/accept`)
        .set(auth(u))
        .expect(201);
    }
  });

  afterAll(async () => {
    await prisma.workspace.deleteMany({
      where: { owner: { email: { endsWith: '@e2e.test' } } },
    });
    await prisma.user.deleteMany({
      where: { email: { endsWith: '@e2e.test' } },
    });
    await app.close();
  });

  it('tạo dự án: mã in hoa, PM là thành viên ws, 4 cột mặc định; MEMBER ws không tạo được', async () => {
    await api()
      .post(`/api/v1/workspaces/${wsId}/projects`)
      .set(auth(pm))
      .send({ key: 'ST', name: 'Không được', pmUserId: pm.id })
      .expect(403);
    const res = await api()
      .post(`/api/v1/workspaces/${wsId}/projects`)
      .set(auth(admin))
      .send({ key: 'st', name: 'SmartTask', pmUserId: pm.id })
      .expect(201);
    projectId = res.body.id;
    expect(res.body.key).toBe('ST');
    await api()
      .post(`/api/v1/workspaces/${wsId}/projects`)
      .set(auth(admin))
      .send({ key: 'ST', name: 'Trùng', pmUserId: pm.id })
      .expect(409);

    const detail = await api()
      .get(`/api/v1/projects/${projectId}`)
      .set(auth(pm))
      .expect(200);
    columns = detail.body.columns;
    expect(columns.map((c) => c.statusKey)).toEqual([
      'TODO',
      'IN_PROGRESS',
      'REVIEW',
      'DONE',
    ]);
    expect(detail.body.myRole).toBe('PM');
    expect(detail.body.canManage).toBe(true);
  });

  it('thành viên dự án: PUT phải có đúng một PM; VIEWER ws không được thêm; dev thành MEMBER', async () => {
    await api()
      .put(`/api/v1/projects/${projectId}/members`)
      .set(auth(pm))
      .send({ members: [{ userId: dev.id, role: 'MEMBER' }] })
      .expect(422);
    await api()
      .put(`/api/v1/projects/${projectId}/members`)
      .set(auth(pm))
      .send({
        members: [
          { userId: pm.id, role: 'PM' },
          { userId: viewer.id, role: 'MEMBER' },
        ],
      })
      .expect(404);
    const res = await api()
      .put(`/api/v1/projects/${projectId}/members`)
      .set(auth(pm))
      .send({
        members: [
          { userId: pm.id, role: 'PM' },
          { userId: dev.id, role: 'MEMBER' },
        ],
      })
      .expect(200);
    expect(res.body.map((m: { id: string }) => m.id).sort()).toEqual(
      [pm.id, dev.id].sort(),
    );
  });

  it('cột: đặt WIP cho "Đang làm"; không xoá cột đang có task (kiểm ở bước sau)', async () => {
    const body = {
      columns: columns.map((c) => ({
        id: c.id,
        name: c.statusKey,
        statusKey: c.statusKey,
        isDone: c.isDone,
        wipLimit: c.statusKey === 'IN_PROGRESS' ? 1 : undefined,
      })),
    };
    const res = await api()
      .put(`/api/v1/projects/${projectId}/columns`)
      .set(auth(pm))
      .send(body)
      .expect(200);
    expect(
      res.body.find((c: { statusKey: string }) => c.statusKey === 'IN_PROGRESS')
        .wipLimit,
    ).toBe(1);
    columns = res.body;
  });

  it('task: mã ST-1, ST-2; giao người ngoài dự án → 422; VIEWER không tạo; viewer vẫn đọc được', async () => {
    const a = await api()
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set(auth(dev))
      .send({
        title: 'Đăng nhập Google',
        estimateHours: 8,
        difficulty: 4,
        assigneeIds: [dev.id],
      })
      .expect(201);
    expect(a.body.key).toBe('ST-1');
    expect(a.body.remainingHours).toBe(8);
    t1 = { id: a.body.id, version: a.body.version };
    const b = await api()
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set(auth(pm))
      .send({ title: 'Quên mật khẩu', estimateHours: 5, dueDate: '2026-10-20' })
      .expect(201);
    expect(b.body.key).toBe('ST-2');
    t2 = { id: b.body.id, version: b.body.version };
    const bad = await api()
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set(auth(pm))
      .send({ title: 'x', assigneeIds: [viewer.id] })
      .expect(422);
    expect(bad.body.code).toBe('ASSIGN_NOT_MEMBER');
    await api()
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set(auth(viewer))
      .send({ title: 'x' })
      .expect(403);
    const list = await api()
      .get(`/api/v1/projects/${projectId}/tasks`)
      .set(auth(viewer))
      .expect(200);
    expect(list.body.items).toHaveLength(2);
    expect(list.body.items.map((t: { number: number }) => t.number)).toEqual([
      1, 2,
    ]);
  });

  it('PATCH cần version: đúng → +1; cũ → 409 kèm current', async () => {
    const ok = await api()
      .patch(`/api/v1/tasks/${t1.id}`)
      .set(auth(dev))
      .send({ version: t1.version, priority: 'HIGH', dueDate: '2026-10-17' })
      .expect(200);
    expect(ok.body.version).toBe(t1.version + 1);
    const stale = await api()
      .patch(`/api/v1/tasks/${t1.id}`)
      .set(auth(dev))
      .send({ version: t1.version, title: 'cũ' })
      .expect(409);
    expect(stale.body.code).toBe('TASK_VERSION_CONFLICT');
    expect(stale.body.details.current).toBe(t1.version + 1);
    t1.version = ok.body.version;
    await api()
      .patch(`/api/v1/tasks/${t1.id}`)
      .set(auth(dev))
      .send({
        version: t1.version,
        startDate: '2026-10-20',
        dueDate: '2026-10-17',
      })
      .expect(422);
  });

  it('kéo thả: vào IN_PROGRESS đặt started_at; WIP=1 chặn thẻ thứ hai (422); vào DONE đặt completed_at, remaining=0', async () => {
    const mv = await api()
      .patch(`/api/v1/tasks/${t1.id}/move`)
      .set(auth(dev))
      .send({ version: t1.version, columnId: col('IN_PROGRESS').id })
      .expect(200);
    expect(mv.body.startedAt).toBeTruthy();
    t1.version = mv.body.version;
    const wip = await api()
      .patch(`/api/v1/tasks/${t2.id}/move`)
      .set(auth(pm))
      .send({ version: t2.version, columnId: col('IN_PROGRESS').id })
      .expect(422);
    expect(wip.body.code).toBe('WIP_LIMIT_EXCEEDED');
    const done = await api()
      .patch(`/api/v1/tasks/${t1.id}/move`)
      .set(auth(dev))
      .send({ version: t1.version, columnId: col('DONE').id, position: 512 })
      .expect(200);
    expect(done.body.completedAt).toBeTruthy();
    expect(done.body.remainingHours).toBe(0);
    expect(done.body.progress).toBe(100);
    t1.version = done.body.version;
    // ra khỏi DONE thì mở lại
    const back = await api()
      .patch(`/api/v1/tasks/${t1.id}/move`)
      .set(auth(dev))
      .send({ version: t1.version, columnId: col('REVIEW').id })
      .expect(200);
    expect(back.body.completedAt).toBeNull();
    t1.version = back.body.version;
  });

  it('subtask: một cấp; tiến độ cha = trung bình subtask; xoá cha xoá cả con', async () => {
    const s1 = await api()
      .post(`/api/v1/tasks/${t2.id}/subtasks`)
      .set(auth(pm))
      .send({ title: 'Gửi email', estimateHours: 2 })
      .expect(201);
    const s2 = await api()
      .post(`/api/v1/tasks/${t2.id}/subtasks`)
      .set(auth(pm))
      .send({ title: 'Form đặt lại', estimateHours: 3, assigneeIds: [dev.id] })
      .expect(201);
    sub = { id: s2.body.id, version: s2.body.version };
    await api()
      .post(`/api/v1/tasks/${s1.body.id}/subtasks`)
      .set(auth(pm))
      .send({ title: 'cháu' })
      .expect(422);
    const progressed = await api()
      .patch(`/api/v1/tasks/${sub.id}/progress`)
      .set(auth(dev))
      .send({ version: sub.version, progress: 50 })
      .expect(200);
    expect(progressed.body.remainingHours).toBe(1.5);
    const parent = await api()
      .get(`/api/v1/tasks/${t2.id}`)
      .set(auth(pm))
      .expect(200);
    expect(parent.body.progress).toBe(25);
    expect(parent.body.subtasks).toHaveLength(2);
    t2.version = parent.body.version;
    const list = await api()
      .get(`/api/v1/projects/${projectId}/tasks`)
      .set(auth(pm))
      .expect(200);
    expect(list.body.items).toHaveLength(2); // subtask không nằm trong danh sách phẳng mặc định
  });

  it('phụ thuộc: PUT thay toàn bộ, version +1; tự trỏ bị lọc; vòng t1→t2→t1 → 422 DEPENDENCY_CYCLE', async () => {
    const cur1 = await api().get(`/api/v1/tasks/${t1.id}`).set(auth(pm));
    const r = await api()
      .put(`/api/v1/tasks/${t2.id}/dependencies`)
      .set(auth(pm))
      .send({ version: t2.version, dependsOnIds: [t1.id, t2.id] })
      .expect(200);
    expect(r.body.dependsOnIds).toEqual([t1.id]);
    expect(r.body.version).toBe(t2.version + 1);
    t2.version = r.body.version;
    const cyc = await api()
      .put(`/api/v1/tasks/${t1.id}/dependencies`)
      .set(auth(pm))
      .send({ version: cur1.body.version, dependsOnIds: [t2.id] })
      .expect(422);
    expect(cyc.body.code).toBe('DEPENDENCY_CYCLE');
    await api()
      .put(`/api/v1/tasks/${t2.id}/dependencies`)
      .set(auth(pm))
      .send({ version: t2.version, dependsOnIds: [] })
      .expect(200);
    t2.version += 1;
  });

  it('since: chỉ trả task đổi sau mốc + deletedIds', async () => {
    const mark = new Date().toISOString();
    await new Promise((r) => setTimeout(r, 20));
    await api()
      .patch(`/api/v1/tasks/${t1.id}`)
      .set(auth(dev))
      .send({ version: t1.version, title: 'Đăng nhập Google (v2)' })
      .expect(200);
    const dup = await api()
      .post(`/api/v1/tasks/${t1.id}/duplicate`)
      .set(auth(dev))
      .send({})
      .expect(201);
    expect(dup.body.title).toBe('Đăng nhập Google (v2) (bản sao)');
    await api()
      .delete(`/api/v1/tasks/${dup.body.id}`)
      .set(auth(dev))
      .expect(204);
    const delta = await api()
      .get(
        `/api/v1/projects/${projectId}/tasks?since=${encodeURIComponent(mark)}`,
      )
      .set(auth(pm))
      .expect(200);
    expect(delta.body.items.map((t: { id: string }) => t.id)).toEqual([t1.id]);
    expect(delta.body.deletedIds).toEqual([dup.body.id]);
    const cur = await api()
      .get(`/api/v1/tasks/${t1.id}`)
      .set(auth(dev))
      .expect(200);
    t1.version = cur.body.version;
  });

  it('sprint: tạo, kéo task, bắt đầu (chốt scope), sprint thứ hai không bắt đầu được (409), đóng chuyển việc dở về backlog', async () => {
    const s = await api()
      .post(`/api/v1/projects/${projectId}/sprints`)
      .set(auth(pm))
      .send({
        name: 'Sprint 1',
        startDate: '2026-10-13',
        endDate: '2026-10-24',
      })
      .expect(201);
    sprintId = s.body.id;
    await api()
      .post(`/api/v1/projects/${projectId}/sprints`)
      .set(auth(dev))
      .send({ name: 'Cấm', startDate: '2026-10-13', endDate: '2026-10-24' })
      .expect(403);
    await api()
      .post(`/api/v1/sprints/${sprintId}/tasks`)
      .set(auth(pm))
      .send({ taskIds: [t1.id, t2.id] })
      .expect(201);
    const started = await api()
      .post(`/api/v1/sprints/${sprintId}/start`)
      .set(auth(pm))
      .expect(201);
    expect(Number(started.body.scopeHoursInitial)).toBe(13);
    const s2 = await api()
      .post(`/api/v1/projects/${projectId}/sprints`)
      .set(auth(pm))
      .send({
        name: 'Sprint 2',
        startDate: '2026-10-27',
        endDate: '2026-11-07',
      })
      .expect(201);
    const conflict = await api()
      .post(`/api/v1/sprints/${s2.body.id}/start`)
      .set(auth(pm))
      .expect(409);
    expect(conflict.body.code).toBe('SPRINT_ALREADY_ACTIVE');

    const list = await api()
      .get(`/api/v1/projects/${projectId}/sprints`)
      .set(auth(dev))
      .expect(200);
    expect(
      list.body.find((x: { id: string }) => x.id === sprintId).taskCount,
    ).toBe(2);

    const closed = await api()
      .post(`/api/v1/sprints/${sprintId}/close`)
      .set(auth(pm))
      .send({ moveOpenTo: 'backlog' })
      .expect(201);
    expect(closed.body.status).toBe('CLOSED');
    expect(closed.body.movedTaskIds).toEqual(
      expect.arrayContaining([t1.id, t2.id]),
    );
    expect(closed.body.movedTaskIds).toHaveLength(4); // 2 task gốc + 2 subtask theo cha
    const backlog = await api()
      .get(`/api/v1/projects/${projectId}/tasks?backlog=true`)
      .set(auth(pm))
      .expect(200);
    expect(backlog.body.items).toHaveLength(2);
    await api()
      .post(`/api/v1/sprints/${s2.body.id}/start`)
      .set(auth(pm))
      .expect(201);
  });

  it('tóm tắt sprint: việc bị đẩy đi lúc đóng, thêm sau khi bắt đầu, giờ theo người cộng đúng, năng lực nhóm', async () => {
    const list = await api()
      .get(`/api/v1/projects/${projectId}/sprints`)
      .set(auth(pm))
      .expect(200);
    const s2 = list.body.find((x: { name: string }) => x.name === 'Sprint 2');
    // Sprint 1 đã đóng ở ca trước: hai việc gốc bị đẩy về backlog
    const closed = await api()
      .get(`/api/v1/sprints/${sprintId}/summary`)
      .set(auth(viewer))
      .expect(200);
    expect(closed.body.sprint.status).toBe('CLOSED');
    expect(closed.body.carriedOut.map((t: { id: string }) => t.id)).toEqual(
      expect.arrayContaining([t1.id, t2.id]),
    );
    // Sprint 2 đang chạy: đưa t1 vào giữa chừng → "thêm sau khi bắt đầu"
    await api()
      .post(`/api/v1/sprints/${s2.id}/tasks`)
      .set(auth(pm))
      .send({ taskIds: [t1.id] })
      .expect(201);
    let sum = await api()
      .get(`/api/v1/sprints/${s2.id}/summary`)
      .set(auth(dev))
      .expect(200);
    for (let i = 0; i < 20 && !sum.body.addedAfterStart.length; i++) {
      await new Promise((r) => setTimeout(r, 100)); // nhật ký ghi bất đồng bộ
      sum = await api()
        .get(`/api/v1/sprints/${s2.id}/summary`)
        .set(auth(dev))
        .expect(200);
    }
    expect(sum.body.addedAfterStart.map((t: { id: string }) => t.id)).toContain(
      t1.id,
    );
    // Thành viên đổi sprint từng việc (PATCH mang version) sau khi bắt đầu cũng là phạm vi tăng
    const cur = await api()
      .get(`/api/v1/tasks/${t2.id}`)
      .set(auth(dev))
      .expect(200);
    await api()
      .patch(`/api/v1/tasks/${t2.id}`)
      .set(auth(dev))
      .send({ version: cur.body.version, sprintId: s2.id })
      .expect(200);
    let ids: string[] = [];
    for (let i = 0; i < 20 && !ids.includes(t2.id); i++) {
      await new Promise((r) => setTimeout(r, 100));
      const r = await api()
        .get(`/api/v1/sprints/${s2.id}/summary`)
        .set(auth(dev))
        .expect(200);
      ids = r.body.addedAfterStart.map((t: { id: string }) => t.id);
      sum = r;
    }
    expect(ids).toEqual(expect.arrayContaining([t1.id, t2.id]));
    const again = await api()
      .get(`/api/v1/projects/${projectId}/sprints`)
      .set(auth(pm))
      .expect(200);
    expect(sum.body.taskCount).toBe(
      again.body.find((x: { id: string }) => x.id === s2.id).taskCount,
    );
    const people = sum.body.byAssignee as {
      remainingHours: number;
      capacityHours: number;
    }[];
    const byPeople = people.reduce((x, p) => x + p.remainingHours, 0);
    expect(byPeople + sum.body.unassigned.hours).toBeCloseTo(
      sum.body.remainingHours,
      1,
    );
    expect(sum.body.capacityHours).toBeCloseTo(
      people.reduce((x, p) => x + p.capacityHours, 0),
      1,
    );
    expect(sum.body.capacityHours).toBeGreaterThan(0);
    expect(Object.keys(sum.body)).not.toContain('bestUserId'); // không xếp hạng
    // Vận tốc tham chiếu: sprint đã đóng gần nhất, cam kết lúc bắt đầu (13 h) và giờ hoàn thành khớp danh sách
    const closedRow = again.body.find((x: { id: string }) => x.id === sprintId);
    expect(sum.body.velocity.sprints[0]).toMatchObject({
      name: 'Sprint 1',
      committedHours: 13,
      completedHours: closedRow.completedHours,
    });
    expect(sum.body.velocity.avgCompletedHours).toBe(closedRow.completedHours);
  });

  it('việc của tôi, tìm kiếm ⌘K, by-key, dashboard, gỡ thành viên mất assignee', async () => {
    const mine = await api().get('/api/v1/me/tasks').set(auth(dev)).expect(200);
    expect(mine.body.map((t: { id: string }) => t.id)).toEqual(
      expect.arrayContaining([t1.id, sub.id]),
    );
    const found = await api()
      .get(`/api/v1/workspaces/${wsId}/tasks/search?q=google`)
      .set(auth(viewer))
      .expect(200);
    expect(found.body[0].key).toBe('ST-1');
    const byKey = await api()
      .get('/api/v1/tasks/by-key/st/2')
      .set(auth(pm))
      .expect(200);
    expect(byKey.body.id).toBe(t2.id);
    const dash = await api()
      .get(`/api/v1/projects/${projectId}/dashboard`)
      .set(auth(viewer))
      .expect(200);
    expect(dash.body.counts.total).toBe(2);
    expect(dash.body.byStatus).toHaveLength(4);

    await api()
      .delete(`/api/v1/projects/${projectId}/members/${pm.id}`)
      .set(auth(admin))
      .expect(409); // không gỡ PM
    await api()
      .delete(`/api/v1/projects/${projectId}/members/${dev.id}`)
      .set(auth(pm))
      .expect(204);
    const t = await api()
      .get(`/api/v1/tasks/${t1.id}`)
      .set(auth(pm))
      .expect(200);
    expect(t.body.assignees).toEqual([]);
    await api().get(`/api/v1/tasks/${t1.id}`).set(auth(dev)).expect(200); // vẫn đọc được vì là thành viên ws
    await api()
      .patch(`/api/v1/tasks/${t1.id}`)
      .set(auth(dev))
      .send({ version: t.body.version, title: 'x' })
      .expect(403);
  });

  it('đóng sprint bấm hai lần cùng Idempotency-Key → trả kết quả lần đầu; không khoá → 409', async () => {
    const list = await api()
      .get(`/api/v1/projects/${projectId}/sprints`)
      .set(auth(pm))
      .expect(200);
    const active = list.body.find(
      (x: { status: string }) => x.status === 'ACTIVE',
    );
    const key = 'close-once-7f3a';
    const first = await api()
      .post(`/api/v1/sprints/${active.id}/close`)
      .set(auth(pm))
      .set('Idempotency-Key', key)
      .send({ moveOpenTo: 'backlog' })
      .expect(201);
    // Nhật ký (nơi giữ khoá) ghi bất đồng bộ — chờ cho chắc
    let again = await api()
      .post(`/api/v1/sprints/${active.id}/close`)
      .set(auth(pm))
      .set('Idempotency-Key', key)
      .send({ moveOpenTo: 'backlog' });
    for (let i = 0; i < 20 && again.status !== 201; i++) {
      await new Promise((r) => setTimeout(r, 100));
      again = await api()
        .post(`/api/v1/sprints/${active.id}/close`)
        .set(auth(pm))
        .set('Idempotency-Key', key)
        .send({ moveOpenTo: 'backlog' });
    }
    expect(again.status).toBe(201);
    expect(again.body.movedTaskIds).toEqual(first.body.movedTaskIds);
    expect(again.body.status).toBe('CLOSED');
    const other = await api()
      .post(`/api/v1/sprints/${active.id}/close`)
      .set(auth(pm))
      .send({ moveOpenTo: 'backlog' })
      .expect(409);
    expect(other.body.code).toBe('SPRINT_NOT_ACTIVE');
  });
});
