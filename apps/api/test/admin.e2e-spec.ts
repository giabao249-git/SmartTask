import type { INestApplication } from '@nestjs/common';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, uniqueEmail } from './helpers';

/**
 * Quản trị Nền tảng (UC-41): chỉ Platform Admin vào được `/admin`; đình chỉ workspace và bảo trì
 * phải CHẶN THẬT ở API (không chỉ hiển thị); mọi thao tác nhạy cảm ghi nhật ký kiểm toán HMAC.
 */
describe('Quản trị nền tảng (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl = '';
  const sockets: Socket[] = [];
  const api = () => request(app.getHttpServer());

  const admin = { email: uniqueEmail('root'), token: '', id: '' };
  const owner = { email: uniqueEmail('owner'), token: '', id: '' };
  const member = { email: uniqueEmail('member'), token: '', id: '' };
  const support = { email: uniqueEmail('cskh'), token: '', id: '' };
  let wsId = '';
  let projectId = '';
  let todoColumnId = '';

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

  const connectSocket = (token: string): Promise<Socket> =>
    new Promise((resolve, reject) => {
      const s = io(baseUrl, {
        auth: { token },
        transports: ['websocket'],
        reconnection: false,
      });
      sockets.push(s);
      s.once('connected', () => resolve(s));
      s.once('connect_error', (e: Error) => reject(e));
      setTimeout(() => reject(new Error('timeout connect')), 4000);
    });

  const emitAck = <T>(s: Socket, event: string, body: unknown): Promise<T> =>
    new Promise((resolve) => s.emit(event, body, (ack: T) => resolve(ack)));

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await app.listen(0);
    const address = app.getHttpServer().address() as { port: number };
    baseUrl = `http://127.0.0.1:${address.port}`;

    await register(admin, 'Quản trị Nền tảng');
    await register(owner, 'Chủ Workspace');
    await register(member, 'Thành viên');
    await register(support, 'Chăm sóc Khách hàng');
    await prisma.user.update({
      where: { id: admin.id },
      data: { isSuperAdmin: true, platformRole: 'ROOT_ADMIN' },
    });
    await prisma.user.update({
      where: { id: support.id },
      data: { platformRole: 'CUSTOMER_SUPPORT' },
    });

    const ws = await api()
      .post('/api/v1/workspaces')
      .set(auth(owner))
      .send({ name: 'WS Quản trị', slug: `ws-admin-${Date.now()}` })
      .expect(201);
    wsId = ws.body.id;
    const inv = await api()
      .post(`/api/v1/workspaces/${wsId}/invitations`)
      .set(auth(owner))
      .send({ email: member.email, role: 'MEMBER' })
      .expect(201);
    await api()
      .post(`/api/v1/invitations/${inv.body.token}/accept`)
      .set(auth(member))
      .expect(201);

    const project = await api()
      .post(`/api/v1/workspaces/${wsId}/projects`)
      .set(auth(owner))
      .send({ key: 'QT', name: 'Dự án quản trị', pmUserId: owner.id })
      .expect(201);
    projectId = project.body.id;
    const detail = await api()
      .get(`/api/v1/projects/${projectId}`)
      .set(auth(owner))
      .expect(200);
    todoColumnId = detail.body.columns[0].id;
    await api()
      .put(`/api/v1/projects/${projectId}/members`)
      .set(auth(owner))
      .send({
        members: [
          { userId: owner.id, role: 'PM' },
          { userId: member.id, role: 'MEMBER' },
        ],
      })
      .expect(200);
  });

  afterAll(async () => {
    for (const s of sockets) {
      if (s.connected) s.disconnect();
      s.close();
    }
    await app.close();
  });

  const createTask = (token: string, title: string) =>
    api()
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set({ Authorization: `Bearer ${token}` })
      .send({ title, columnId: todoColumnId });

  it('chỉ Platform Admin vào được /admin: owner/member 403, ẩn danh 401', async () => {
    for (const path of ['stats', 'workspaces', 'users', 'audit-logs']) {
      await api().get(`/api/v1/admin/${path}`).set(auth(admin)).expect(200);
      await api().get(`/api/v1/admin/${path}`).set(auth(owner)).expect(403);
      await api().get(`/api/v1/admin/${path}`).set(auth(member)).expect(403);
      await api().get(`/api/v1/admin/${path}`).expect(401);
    }
  });

  it('vai nền tảng hẹp: CSKH không đổi được vòng đời workspace, ROOT_ADMIN thì được', async () => {
    const denied = await api()
      .patch(`/api/v1/admin/workspaces/${wsId}/status`)
      .set(auth(support))
      .send({ status: 'SOFT_SUSPENDED', reason: 'thử vượt quyền' })
      .expect(403);
    expect(denied.body.code).toBe('FORBIDDEN');
    await api()
      .post('/api/v1/admin/system/maintenance')
      .set(auth(support))
      .send({ mode: 'FULL', reason: 'thử vượt quyền' })
      .expect(403);
  });

  it('READ_ONLY_ENFORCED: vẫn đọc được, mọi ghi bị chặn 403 WORKSPACE_READ_ONLY', async () => {
    await api()
      .patch(`/api/v1/admin/workspaces/${wsId}/status`)
      .set(auth(admin))
      .send({ status: 'READ_ONLY_ENFORCED', reason: 'quá hạn thanh toán' })
      .expect(200);

    await api()
      .get(`/api/v1/projects/${projectId}/tasks`)
      .set(auth(member))
      .expect(200);
    const write = await createTask(member.token, 'Không được tạo').expect(403);
    expect(write.body.code).toBe('WORKSPACE_READ_ONLY');
    const settings = await api()
      .patch(`/api/v1/workspaces/${wsId}/settings`)
      .set(auth(owner))
      .send({ ai: { dailyLimitPerUser: 5 } })
      .expect(403);
    expect(settings.body.code).toBe('WORKSPACE_READ_ONLY');
  });

  it('TC-ADMIN-01: Đình chỉ Workspace (Cascade Suspension) - ngắt WebSocket mã 4403 và chặn API 403 WORKSPACE_SUSPENDED', async () => {
    // 1. Client Member kết nối Socket.io và tham gia phòng workspace
    const memberSocket = await connectSocket(member.token);
    await emitAck(memberSocket, 'workspace:join', { workspaceId: wsId });

    let suspendedPayload: any = null;
    let isDisconnected = false;

    memberSocket.on('workspace:suspended', (payload: any) => {
      suspendedPayload = payload;
    });

    memberSocket.on('disconnect', () => {
      isDisconnected = true;
    });

    // 2. Super Admin đình chỉ workspace
    await api()
      .patch(`/api/v1/admin/workspaces/${wsId}/status`)
      .set(auth(admin))
      .send({ status: 'SOFT_SUSPENDED', reason: 'vi phạm điều khoản' })
      .expect(200);

    // Chờ socket xử lý sự kiện
    await new Promise((r) => setTimeout(r, 100));

    expect(suspendedPayload).toMatchObject({
      workspaceId: wsId,
      code: 'WORKSPACE_SUSPENDED',
      disconnectCode: 4403,
    });
    expect(isDisconnected).toBe(true);

    // 3. API chặn cả đọc lẫn ghi với mã WORKSPACE_SUSPENDED
    const read = await api()
      .get(`/api/v1/projects/${projectId}/tasks`)
      .set(auth(member))
      .expect(403);
    expect(read.body.code).toBe('WORKSPACE_SUSPENDED');
    const write = await createTask(owner.token, 'Không được tạo').expect(403);
    expect(write.body.code).toBe('WORKSPACE_SUSPENDED');

    // 4. Mở lại workspace
    await api()
      .patch(`/api/v1/admin/workspaces/${wsId}/status`)
      .set(auth(admin))
      .send({ status: 'ACTIVE', reason: 'đã xử lý xong' })
      .expect(200);
    await createTask(owner.token, 'Tạo lại sau khi mở').expect(201);
    memberSocket.disconnect();
  });

  it('TC-ADMIN-02: Bật Chế độ Bảo trì (Maintenance Mode) - chặn 503 MAINTENANCE_MODE, whitelist Super Admin', async () => {
    await api()
      .post('/api/v1/admin/system/maintenance')
      .set(auth(admin))
      .send({ mode: 'READ_ONLY', reason: 'nâng cấp CSDL' })
      .expect(201);
    await api()
      .get(`/api/v1/projects/${projectId}/tasks`)
      .set(auth(member))
      .expect(200);
    const blocked = await createTask(member.token, 'Ghi lúc bảo trì').expect(
      503,
    );
    expect(blocked.body.code).toBe('MAINTENANCE_MODE');
    expect(blocked.body.details).toMatchObject({ mode: 'READ_ONLY' });

    await api()
      .post('/api/v1/admin/system/maintenance')
      .set(auth(admin))
      .send({ mode: 'FULL', reason: 'chuyển cụm' })
      .expect(201);
    const read = await api()
      .get(`/api/v1/projects/${projectId}/tasks`)
      .set(auth(member))
      .expect(503);
    expect(read.body.code).toBe('MAINTENANCE_MODE');
    // Đăng nhập, /me và cổng quản trị luôn mở để còn vào tắt bảo trì
    await api()
      .post('/api/v1/auth/login')
      .send({ email: member.email, password: 'MatKhau@123' })
      .expect(200);
    await api().get('/api/v1/me').set(auth(member)).expect(200);
    await api().get('/api/v1/admin/stats').set(auth(admin)).expect(200);

    const saved = await prisma.platformSetting.findUnique({
      where: { key: 'maintenance' },
    });
    expect(saved?.value).toMatchObject({ mode: 'FULL' });

    await api()
      .post('/api/v1/admin/system/maintenance')
      .set(auth(admin))
      .send({ mode: 'DISABLED', reason: 'xong' })
      .expect(201);
    await api()
      .get(`/api/v1/projects/${projectId}/tasks`)
      .set(auth(member))
      .expect(200);
  });

  it('TC-ADMIN-05: Tính Bất biến của Nhật ký Kiểm toán (System Audit Trail) - HMAC Chain và cấm API sửa/xóa', async () => {
    const logs = await api()
      .get('/api/v1/admin/audit-logs?limit=50')
      .set(auth(admin))
      .expect(200);
    const actions = logs.body.items.map((i: { action: string }) => i.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'WORKSPACE_STATUS_READ_ONLY_ENFORCED',
        'WORKSPACE_STATUS_SOFT_SUSPENDED',
        'WORKSPACE_STATUS_ACTIVE',
        'MAINTENANCE_MODE_FULL',
        'MAINTENANCE_MODE_DISABLED',
      ]),
    );
    expect(logs.body.integrityCheck.isCompromised).toBe(false);

    // Kiểm tra không tồn tại endpoint sửa hoặc xóa audit log
    await api()
      .patch('/api/v1/admin/audit-logs/fake-log-id')
      .set(auth(admin))
      .send({ action: 'TAMPERED' })
      .expect(404);

    await api()
      .delete('/api/v1/admin/audit-logs/fake-log-id')
      .set(auth(admin))
      .expect(404);
  });

  it('TC-ADMIN-03: Thu hồi phiên (401 SESSION_REVOKED) và Global Ban (403 ACCOUNT_LOCKED)', async () => {
    const victim = { email: uniqueEmail('victim'), token: '', id: '' };
    await register(victim, 'Người dùng bị thu hồi');

    // Token hiện tại hoạt động bình thường
    await api().get('/api/v1/me').set(auth(victim)).expect(200);

    // 1. Thu hồi toàn bộ phiên của người dùng
    await api()
      .post(`/api/v1/admin/users/${victim.id}/revoke-sessions`)
      .set(auth(admin))
      .expect(201);

    // Đợi 50ms để thời điểm iat < revokedAt
    await new Promise((r) => setTimeout(r, 50));

    // Token cũ bị chặn ngay với 401 SESSION_REVOKED
    const revokedRes = await api()
      .get('/api/v1/me')
      .set(auth(victim))
      .expect(401);
    expect(revokedRes.body.code).toBe('SESSION_REVOKED');

    // Chờ qua giây tiếp theo để token mới có iat > revokedAtSec
    await new Promise((r) => setTimeout(r, 1100));

    // Đăng nhập lại để được cấp token mới
    const loginRes = await api()
      .post('/api/v1/auth/login')
      .send({ email: victim.email, password: 'MatKhau@123' })
      .expect(200);
    const newToken = loginRes.body.accessToken;

    await api()
      .get('/api/v1/me')
      .set({ Authorization: `Bearer ${newToken}` })
      .expect(200);

    // 2. Khóa tài khoản toàn cục (Global Ban)
    await api()
      .patch(`/api/v1/admin/users/${victim.id}/status`)
      .set(auth(admin))
      .send({ isActive: false, reason: 'Vi phạm điều khoản dịch vụ' })
      .expect(200);

    // Mọi request với token mới bị chặn 403 ACCOUNT_LOCKED
    const banRes = await api()
      .get('/api/v1/me')
      .set({ Authorization: `Bearer ${newToken}` })
      .expect(403);
    expect(banRes.body.code).toBe('ACCOUNT_LOCKED');
  });

  it('TC-ADMIN-04: Ngắt mạch AI FinOps toàn sàn khi vượt ngưỡng $100/ngày', async () => {
    // 1. Kiểm tra trạng thái mạch hiện tại
    const initial = await api()
      .get('/api/v1/admin/ai/circuit-breaker')
      .set(auth(admin))
      .expect(200);
    expect(initial.body.isOpen).toBe(false);
    expect(initial.body.budgetLimit).toBe(100);

    // 2. Mô phỏng kích hoạt ngắt mạch khẩn cấp
    await api()
      .post('/api/v1/admin/ai/circuit-breaker')
      .set(auth(admin))
      .send({ simulateTrip: true, reason: 'Kiểm thử e2e vượt ngân sách' })
      .expect(201);

    const tripped = await api()
      .get('/api/v1/admin/ai/circuit-breaker')
      .set(auth(admin))
      .expect(200);
    expect(tripped.body.isOpen).toBe(true);

    // 3. Gọi AI bị ngắt mạch chặn 503 AI_PROVIDER_UNAVAILABLE
    const aiRes = await api()
      .post('/api/v1/ai/chat')
      .set(auth(owner))
      .send({ projectId, text: 'Tạo công việc mới' });
    expect(aiRes.status).toBe(503);
    expect(aiRes.body.code).toBe('AI_PROVIDER_UNAVAILABLE');

    // 4. Khôi phục lại mạch AI
    await api()
      .post('/api/v1/admin/ai/circuit-breaker')
      .set(auth(admin))
      .send({ simulateTrip: false })
      .expect(201);

    const restored = await api()
      .get('/api/v1/admin/ai/circuit-breaker')
      .set(auth(admin))
      .expect(200);
    expect(restored.body.isOpen).toBe(false);
  });
});
