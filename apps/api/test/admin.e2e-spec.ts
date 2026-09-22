import type { INestApplication } from '@nestjs/common';
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

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
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

  it('SOFT_SUSPENDED: chặn cả đọc lẫn ghi với mã WORKSPACE_SUSPENDED', async () => {
    await api()
      .patch(`/api/v1/admin/workspaces/${wsId}/status`)
      .set(auth(admin))
      .send({ status: 'SOFT_SUSPENDED', reason: 'vi phạm điều khoản' })
      .expect(200);
    const read = await api()
      .get(`/api/v1/projects/${projectId}/tasks`)
      .set(auth(member))
      .expect(403);
    expect(read.body.code).toBe('WORKSPACE_SUSPENDED');
    const write = await createTask(owner.token, 'Không được tạo').expect(403);
    expect(write.body.code).toBe('WORKSPACE_SUSPENDED');

    await api()
      .patch(`/api/v1/admin/workspaces/${wsId}/status`)
      .set(auth(admin))
      .send({ status: 'ACTIVE', reason: 'đã xử lý xong' })
      .expect(200);
    await createTask(owner.token, 'Tạo lại sau khi mở').expect(201);
  });

  it('bảo trì READ_ONLY chặn ghi, FULL chặn cả đọc; admin và /auth vẫn vào được; trạng thái lưu DB', async () => {
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

  it('nhật ký kiểm toán ghi đủ thao tác nhạy cảm và chuỗi HMAC không bị phá', async () => {
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
  });
});
