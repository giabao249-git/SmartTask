import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, uniqueEmail } from './helpers';

/** Phase 4: bình luận + @mention (gợi ý mờ) → thông báo; giao việc → thông báo; nhật ký; đính kèm ký URL → PUT → xác nhận → tải → xoá. */
describe('Cộng tác (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const api = () => request(app.getHttpServer());
  type U = { email: string; token: string; id: string };
  const pm: U = { email: uniqueEmail('pm'), token: '', id: '' };
  const huy: U = { email: uniqueEmail('huy'), token: '', id: '' };
  const thu: U = { email: uniqueEmail('thu'), token: '', id: '' };
  const auth = (u: U) => ({ Authorization: `Bearer ${u.token}` });
  let wsId = '';
  let projectId = '';
  let task = { id: '', version: 0 };
  let commentId = '';
  let attachmentId = '';

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    for (const [u, name] of [
      [pm, 'Nguyễn Thị Lan'],
      [huy, 'Lê Đức Huy'],
      [thu, 'Phạm Minh Thu'],
    ] as const) {
      const res = await api()
        .post('/api/v1/auth/register')
        .send({ email: u.email, password: 'MatKhau@123', fullName: name })
        .expect(201);
      u.token = res.body.accessToken;
      u.id = res.body.user.id;
    }
    await api()
      .patch('/api/v1/me')
      .set(auth(huy))
      .send({ shortName: 'Huy' })
      .expect(200);
    const ws = await api()
      .post('/api/v1/workspaces')
      .set(auth(pm))
      .send({ name: 'WS Phase 4' })
      .expect(201);
    wsId = ws.body.id;
    for (const u of [huy, thu]) {
      const inv = await api()
        .post(`/api/v1/workspaces/${wsId}/invitations`)
        .set(auth(pm))
        .send({ email: u.email })
        .expect(201);
      await api()
        .post(`/api/v1/invitations/${inv.body.token}/accept`)
        .set(auth(u))
        .expect(201);
    }
    const p = await api()
      .post(`/api/v1/workspaces/${wsId}/projects`)
      .set(auth(pm))
      .send({ key: 'CL', name: 'Collab', pmUserId: pm.id })
      .expect(201);
    projectId = p.body.id;
    await api()
      .put(`/api/v1/projects/${projectId}/members`)
      .set(auth(pm))
      .send({
        members: [
          { userId: pm.id, role: 'PM' },
          { userId: huy.id, role: 'MEMBER' },
          { userId: thu.id, role: 'MEMBER' },
        ],
      })
      .expect(200);
    const t = await api()
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set(auth(pm))
      .send({ title: 'Viết tài liệu API', estimateHours: 4 })
      .expect(201);
    task = { id: t.body.id, version: t.body.version };
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

  const waitFor = async <T>(
    fn: () => Promise<T>,
    ok: (v: T) => boolean,
    tries = 20,
  ): Promise<T> => {
    let v = await fn();
    for (let i = 0; i < tries && !ok(v); i += 1) {
      await new Promise((r) => setTimeout(r, 50));
      v = await fn();
    }
    return v;
  };

  it('gợi ý @mention: không dấu, gõ thiếu, sai ký tự, email; trống = tất cả', async () => {
    const all = await api()
      .get(`/api/v1/projects/${projectId}/members/suggest`)
      .set(auth(pm))
      .expect(200);
    expect(all.body.items).toHaveLength(3);
    expect(['elasticsearch', 'pg_trgm']).toContain(all.body.provider);

    const cases: Array<[string, string]> = [
      ['hu', huy.id],
      ['duc hy', huy.id],
      ['Đức Huy', huy.id],
      ['thu', thu.id],
      ['pham', thu.id],
      [huy.email.slice(0, 6), huy.id],
    ];
    for (const [q, expected] of cases) {
      const res = await api()
        .get(
          `/api/v1/projects/${projectId}/members/suggest?q=${encodeURIComponent(q)}`,
        )
        .set(auth(huy))
        .expect(200);
      expect({ q, first: res.body.items[0]?.id }).toEqual({
        q,
        first: expected,
      });
    }
  });

  it('bình luận có @mention → người được nhắc nhận thông báo MENTIONED; tác giả không nhận; nhắc người ngoài dự án → 422', async () => {
    await api()
      .post(`/api/v1/tasks/${task.id}/comments`)
      .set(auth(pm))
      .send({
        body: 'x',
        mentionUserIds: ['00000000-0000-4000-8000-000000000000'],
      })
      .expect(422);
    const c = await api()
      .post(`/api/v1/tasks/${task.id}/comments`)
      .set(auth(pm))
      .send({ body: 'Huy review giúp nhé', mentionUserIds: [huy.id, pm.id] })
      .expect(201);
    commentId = c.body.id;
    expect(c.body.mentions.map((m: { id: string }) => m.id).sort()).toEqual(
      [huy.id, pm.id].sort(),
    );

    const huyN = await waitFor(
      async () =>
        (await api().get('/api/v1/notifications?unread=true').set(auth(huy)))
          .body,
      (b) => b.items.length >= 1,
    );
    expect(huyN.items[0].type).toBe('MENTIONED');
    expect(huyN.items[0].title).toContain('CL-1');
    const pmN = await api()
      .get('/api/v1/notifications/unread-count')
      .set(auth(pm))
      .expect(200);
    expect(pmN.body.count).toBe(0);

    await api()
      .patch(`/api/v1/notifications/${huyN.items[0].id}/read`)
      .set(auth(huy))
      .expect(204);
    const after = await api()
      .get('/api/v1/notifications/unread-count')
      .set(auth(huy))
      .expect(200);
    expect(after.body.count).toBe(0);
  });

  it('sửa/xoá bình luận: người khác 403, tác giả sửa được, PM xoá được', async () => {
    await api()
      .patch(`/api/v1/comments/${commentId}`)
      .set(auth(huy))
      .send({ body: 'hack' })
      .expect(403);
    const edited = await api()
      .patch(`/api/v1/comments/${commentId}`)
      .set(auth(pm))
      .send({
        body: 'Huy và Thu review giúp nhé',
        mentionUserIds: [huy.id, thu.id],
      })
      .expect(200);
    expect(edited.body.editedAt).toBeTruthy();
    const thuN = await waitFor(
      async () =>
        (await api().get('/api/v1/notifications?unread=true').set(auth(thu)))
          .body,
      (b) => b.items.length >= 1,
    );
    expect(thuN.items[0].type).toBe('MENTIONED');
    const reply = await api()
      .post(`/api/v1/tasks/${task.id}/comments`)
      .set(auth(huy))
      .send({ body: 'Ok', parentId: commentId })
      .expect(201);
    await api()
      .post(`/api/v1/tasks/${task.id}/comments`)
      .set(auth(huy))
      .send({ body: 'cháu', parentId: reply.body.id })
      .expect(422);
    await api()
      .delete(`/api/v1/comments/${reply.body.id}`)
      .set(auth(pm))
      .expect(204);
    const list = await api()
      .get(`/api/v1/tasks/${task.id}/comments`)
      .set(auth(thu))
      .expect(200);
    expect(list.body.total).toBe(1);
  });

  it('giao việc → người được giao nhận TASK_ASSIGNED; tắt tuỳ chọn thì không nhận', async () => {
    await api()
      .put('/api/v1/me/notification-prefs')
      .set(auth(thu))
      .send({ inApp: { taskAssigned: false } })
      .expect(200);
    await api()
      .post('/api/v1/notifications/read-all')
      .set(auth(thu))
      .expect(204);
    const t = await api()
      .get(`/api/v1/tasks/${task.id}`)
      .set(auth(pm))
      .expect(200);
    await api()
      .put(`/api/v1/tasks/${task.id}/assignees`)
      .set(auth(pm))
      .send({ version: t.body.version, userIds: [huy.id, thu.id] })
      .expect(200);
    const huyN = await waitFor(
      async () =>
        (await api().get('/api/v1/notifications?unread=true').set(auth(huy)))
          .body,
      (b) => b.items.some((n: { type: string }) => n.type === 'TASK_ASSIGNED'),
    );
    expect(
      huyN.items.some((n: { type: string }) => n.type === 'TASK_ASSIGNED'),
    ).toBe(true);
    await new Promise((r) => setTimeout(r, 150));
    const thuN = await api()
      .get('/api/v1/notifications?unread=true')
      .set(auth(thu))
      .expect(200);
    expect(
      thuN.body.items.some((n: { type: string }) => n.type === 'TASK_ASSIGNED'),
    ).toBe(false);
  });

  it('nhật ký hoạt động ghi từ sự kiện: tạo, giao việc, bình luận', async () => {
    const act = await waitFor(
      async () =>
        (await api().get(`/api/v1/tasks/${task.id}/activity`).set(auth(thu)))
          .body,
      (b) => b.length >= 3,
    );
    const actions = act.map((a: { action: string }) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'task.created',
        'task.assigned',
        'comment.created',
      ]),
    );
    const assigned = act.find(
      (a: { action: string }) => a.action === 'task.assigned',
    );
    expect(assigned.diff.assignees.to.sort()).toEqual([huy.id, thu.id].sort());
    const proj = await api()
      .get(`/api/v1/projects/${projectId}/activity?limit=5`)
      .set(auth(pm))
      .expect(200);
    expect(proj.body.total).toBeGreaterThanOrEqual(3);
    expect(proj.body.items[0].taskKey).toBe('CL-1');
  });

  it('đính kèm: ký URL → PUT nội dung → xác nhận → liệt kê → URL tải → GET → xoá; sai chữ ký 403; quá 10 MB 422', async () => {
    await api()
      .post(`/api/v1/tasks/${task.id}/attachments/sign`)
      .set(auth(huy))
      .send({
        fileName: 'a.bin',
        mime: 'application/octet-stream',
        sizeBytes: 11 * 1024 * 1024,
      })
      .expect(400);
    const signed = await api()
      .post(`/api/v1/tasks/${task.id}/attachments/sign`)
      .set(auth(huy))
      .send({ fileName: 'Thiết kế.png', mime: 'image/png', sizeBytes: 5 })
      .expect(201);
    expect(signed.body.provider).toBe('local');
    expect(signed.body.storagePath).toMatch(
      new RegExp(`^${wsId}/${projectId}/${task.id}/.+-Thiet-ke.png$`),
    );
    const uploadPath =
      new URL(signed.body.uploadUrl).pathname +
      new URL(signed.body.uploadUrl).search;

    await api()
      .put(uploadPath.replace(/sig=[^&]+/, 'sig=sai'))
      .set('Content-Type', 'image/png')
      .send(Buffer.from('hello'))
      .expect(403);
    await api()
      .put(uploadPath)
      .set('Content-Type', 'image/png')
      .send(Buffer.from('hello'))
      .expect(200);

    await api()
      .post(`/api/v1/tasks/${task.id}/attachments`)
      .set(auth(huy))
      .send({
        storagePath: 'khac/duong/dan.png',
        fileName: 'x.png',
        mime: 'image/png',
        sizeBytes: 5,
      })
      .expect(403);
    const created = await api()
      .post(`/api/v1/tasks/${task.id}/attachments`)
      .set(auth(huy))
      .send({
        storagePath: signed.body.storagePath,
        fileName: 'Thiết kế.png',
        mime: 'image/png',
        sizeBytes: 5,
      })
      .expect(201);
    attachmentId = created.body.id;
    const list = await api()
      .get(`/api/v1/tasks/${task.id}/attachments`)
      .set(auth(thu))
      .expect(200);
    expect(list.body).toHaveLength(1);
    const detail = await api()
      .get(`/api/v1/tasks/${task.id}`)
      .set(auth(pm))
      .expect(200);
    expect(detail.body.attachmentCount).toBe(1);

    const dl = await api()
      .get(`/api/v1/attachments/${attachmentId}/download-url`)
      .set(auth(thu))
      .expect(200);
    const dlPath = new URL(dl.body.url).pathname + new URL(dl.body.url).search;
    const file = await api().get(dlPath).expect(200);
    expect(file.text ?? file.body.toString()).toBe('hello');

    await api()
      .delete(`/api/v1/attachments/${attachmentId}`)
      .set(auth(thu))
      .expect(403);
    await api()
      .delete(`/api/v1/attachments/${attachmentId}`)
      .set(auth(huy))
      .expect(204);
    await api().get(dlPath).expect(404);
  });
});
