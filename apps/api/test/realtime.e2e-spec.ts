import type { INestApplication } from '@nestjs/common';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, uniqueEmail } from './helpers';

/** Phase 6: handshake JWT, join phòng theo quyền, presence, task:* / comment:* / notification:new / workload:updated. */
/** YYYY-MM-DD của ngày thứ `offset` (0 = Thứ Hai) trong tuần hiện tại, theo UTC. */
function weekDay(offset: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + offset);
  return d.toISOString().slice(0, 10);
}

describe('Realtime Socket.io (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl = '';
  const api = () => request(app.getHttpServer());
  type U = { email: string; token: string; id: string };
  const pm: U = { email: uniqueEmail('pm'), token: '', id: '' };
  const dev: U = { email: uniqueEmail('dev'), token: '', id: '' };
  const outsider: U = { email: uniqueEmail('out'), token: '', id: '' };
  const auth = (u: U) => ({ Authorization: `Bearer ${u.token}` });
  let wsId = '';
  let projectId = '';
  const sockets: Socket[] = [];

  const connect = (token: string): Promise<Socket> =>
    new Promise((resolve, reject) => {
      const s = io(baseUrl, {
        auth: { token },
        transports: ['websocket'],
        reconnection: false,
      });
      sockets.push(s);
      s.once('connected', () => resolve(s));
      s.once('error', (e: unknown) => reject(new Error(JSON.stringify(e))));
      s.once('connect_error', (e: Error) => reject(e));
      setTimeout(() => reject(new Error('timeout connect')), 3000);
    });
  const waitEvent = <T>(s: Socket, event: string, ms = 3000): Promise<T> =>
    new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`timeout ${event}`)), ms);
      s.once(event, (p: T) => {
        clearTimeout(t);
        resolve(p);
      });
    });
  const emitAck = <T>(s: Socket, event: string, body: unknown): Promise<T> =>
    new Promise((resolve) => s.emit(event, body, (ack: T) => resolve(ack)));

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await app.listen(0);
    const address = app.getHttpServer().address() as { port: number };
    baseUrl = `http://127.0.0.1:${address.port}`;
    for (const [u, name] of [
      [pm, 'PM Lan'],
      [dev, 'Dev Huy'],
      [outsider, 'Người ngoài'],
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
      .set(auth(pm))
      .send({ name: 'WS Realtime' })
      .expect(201);
    wsId = ws.body.id;
    const inv = await api()
      .post(`/api/v1/workspaces/${wsId}/invitations`)
      .set(auth(pm))
      .send({ email: dev.email })
      .expect(201);
    await api()
      .post(`/api/v1/invitations/${inv.body.token}/accept`)
      .set(auth(dev))
      .expect(201);
    const p = await api()
      .post(`/api/v1/workspaces/${wsId}/projects`)
      .set(auth(pm))
      .send({ key: 'RT', name: 'Realtime', pmUserId: pm.id })
      .expect(201);
    projectId = p.body.id;
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
  });

  afterAll(async () => {
    for (const s of sockets) s.disconnect();
    await prisma.workspace.deleteMany({
      where: { owner: { email: { endsWith: '@e2e.test' } } },
    });
    await prisma.user.deleteMany({
      where: { email: { endsWith: '@e2e.test' } },
    });
    await app.close();
  });

  it('token sai → bị ngắt; người ngoài join dự án → FORBIDDEN qua ack', async () => {
    await expect(connect('token-sai')).rejects.toBeTruthy();
    const s = await connect(outsider.token);
    const ack = await emitAck<{ error?: { code: string } }>(s, 'project:join', {
      projectId,
    });
    expect(ack.error?.code).toBe('FORBIDDEN');
  });

  it('join phòng: nhận presence; hai client cùng dự án thấy nhau', async () => {
    const a = await connect(pm.token);
    const b = await connect(dev.token);
    const ackA = await emitAck<{
      ok: boolean;
      presence: Array<{ userId: string }>;
    }>(a, 'project:join', { projectId, view: 'board' });
    expect(ackA.ok).toBe(true);
    expect(ackA.presence.map((p) => p.userId)).toEqual([pm.id]);
    const presenceForA = waitEvent<{
      users: Array<{ userId: string; view: string }>;
    }>(a, 'presence:update');
    const ackB = await emitAck<{ presence: Array<{ userId: string }> }>(
      b,
      'project:join',
      { projectId, view: 'gantt' },
    );
    expect(ackB.presence.map((p) => p.userId).sort()).toEqual(
      [pm.id, dev.id].sort(),
    );
    const upd = await presenceForA;
    expect(upd.users.find((u) => u.userId === dev.id)?.view).toBe('gantt');
    a.disconnect();
    b.disconnect();
  });

  it('REST tạo/kéo task → cả hai client trong phòng nhận task:created / task:moved kèm version; người ngoài phòng không nhận', async () => {
    const a = await connect(pm.token);
    const b = await connect(dev.token);
    const c = await connect(outsider.token);
    await emitAck(a, 'project:join', { projectId });
    await emitAck(b, 'project:join', { projectId });
    let leaked = false;
    c.on('task:created', () => {
      leaked = true;
    });

    const createdA = waitEvent<{
      task: { id: string; version: number; number: number };
      actorId: string;
    }>(a, 'task:created');
    const createdB = waitEvent<{ task: { id: string } }>(b, 'task:created');
    const t = await api()
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set(auth(dev))
      .send({ title: 'Việc realtime', estimateHours: 3 })
      .expect(201);
    const [ea, eb] = await Promise.all([createdA, createdB]);
    expect(ea.task.id).toBe(t.body.id);
    expect(ea.task.version).toBe(1);
    expect(ea.actorId).toBe(dev.id);
    expect(eb.task.id).toBe(t.body.id);

    const cols = await api()
      .get(`/api/v1/projects/${projectId}/columns`)
      .set(auth(pm))
      .expect(200);
    const doing = cols.body.find(
      (x: { statusKey: string }) => x.statusKey === 'IN_PROGRESS',
    );
    const movedB = waitEvent<{
      task: { columnId: string; version: number; startedAt: string | null };
      diffKeys: string[];
    }>(b, 'task:moved');
    await api()
      .patch(`/api/v1/tasks/${t.body.id}/move`)
      .set(auth(pm))
      .send({ version: 1, columnId: doing.id })
      .expect(200);
    const mv = await movedB;
    expect(mv.task.columnId).toBe(doing.id);
    expect(mv.task.version).toBe(2);
    expect(mv.diffKeys).toContain('columnId');
    await new Promise((r) => setTimeout(r, 100));
    expect(leaked).toBe(false);

    // bình luận @dev → phòng dự án nhận comment:created; dev nhận notification:new ở phòng cá nhân
    const commentA = waitEvent<{
      commentId: string;
      mentionedUserIds: string[];
    }>(a, 'comment:created');
    const notifB = waitEvent<{ notification: { type: string } }>(
      b,
      'notification:new',
    );
    await api()
      .post(`/api/v1/tasks/${t.body.id}/comments`)
      .set(auth(pm))
      .send({ body: 'Huy xem giúp', mentionUserIds: [dev.id] })
      .expect(201);
    const [cm, nt] = await Promise.all([commentA, notifB]);
    expect(cm.mentionedUserIds).toEqual([dev.id]);
    expect(nt.notification.type).toBe('MENTIONED');

    // xoá → task:deleted chỉ có id
    const delB = waitEvent<{ taskId: string }>(b, 'task:deleted');
    await api().delete(`/api/v1/tasks/${t.body.id}`).set(auth(pm)).expect(204);
    expect((await delB).taskId).toBe(t.body.id);
    a.disconnect();
    b.disconnect();
    c.disconnect();
  });

  it('workload:updated tới phòng cá nhân sau khi giao việc (listener tải gộp 500 ms)', async () => {
    const b = await connect(dev.token);
    const wl = waitEvent<{ userId: string; level: string }>(
      b,
      'workload:updated',
      4000,
    );
    await api()
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set(auth(pm))
      // Đặt hẳn khung Thứ Hai–Chủ nhật tuần này để 60 h rơi trọn vào tuần hiện tại dù test chạy ngày nào
      // (không ghi ngày thì start* = hôm nay, due* = +5 ngày làm việc → chạy ngày Thứ Sáu chỉ còn 1/6 tải trong tuần)
      .send({
        title: 'Việc nặng',
        estimateHours: 60,
        startDate: weekDay(0),
        dueDate: weekDay(6),
        assigneeIds: [dev.id],
      })
      .expect(201);
    const p = await wl;
    expect(p.userId).toBe(dev.id);
    expect(['HIGH', 'FULL', 'OVERLOAD']).toContain(p.level);
    b.disconnect();
  });
});
