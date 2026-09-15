import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, uniqueEmail } from './helpers';

/** Phase 2: workspace → mời → chấp nhận → vai trò → cài đặt → kỹ năng → heatmap → gộp → chuyển chủ. */
describe('Workspace & kỹ năng (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const api = () => request(app.getHttpServer());

  const owner = {
    email: uniqueEmail('owner'),
    password: 'MatKhau@123',
    token: '',
    id: '',
  };
  const member = {
    email: uniqueEmail('member'),
    password: 'MatKhau@123',
    token: '',
    id: '',
  };
  const outsider = {
    email: uniqueEmail('outsider'),
    password: 'MatKhau@123',
    token: '',
    id: '',
  };
  let wsId = '';
  let inviteToken = '';
  let reactId = '';
  let reactJsId = '';

  const register = async (
    u: { email: string; password: string; token: string; id: string },
    fullName: string,
  ) => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ email: u.email, password: u.password, fullName })
      .expect(201);
    u.token = res.body.accessToken;
    u.id = res.body.user.id;
  };
  const auth = (u: { token: string }) => ({
    Authorization: `Bearer ${u.token}`,
  });

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await register(owner, 'Nguyễn Thị Lan');
    await register(member, 'Lê Đức Huy');
    await register(outsider, 'Người Ngoài');
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

  it('POST /workspaces → OWNER, slug tự sinh bỏ dấu, 30 kỹ năng mẫu, cài đặt mặc định', async () => {
    const res = await api()
      .post('/api/v1/workspaces')
      .set(auth(owner))
      .send({ name: 'Nhóm Đồ Án SmartTask' })
      .expect(201);
    wsId = res.body.id;
    expect(res.body.slug).toBe('nhom-do-an-smarttask');
    expect(res.body.role).toBe('OWNER');

    const skills = await api()
      .get(`/api/v1/workspaces/${wsId}/skills`)
      .set(auth(owner))
      .expect(200);
    expect(skills.body.length).toBe(30);
    const react = skills.body.find((s: { name: string }) => s.name === 'React');
    expect(react.aliases).toEqual(expect.arrayContaining(['ReactJS']));
    reactId = react.id;

    const settings = await api()
      .get(`/api/v1/workspaces/${wsId}/settings`)
      .set(auth(owner))
      .expect(200);
    expect(settings.body.defaultCapacityHours).toBe(40);
    expect(settings.body.workload.thresholds.overload).toBe(1.1);
  });

  it('người ngoài không thấy workspace (404, không lộ tồn tại)', async () => {
    await api()
      .get(`/api/v1/workspaces/${wsId}`)
      .set(auth(outsider))
      .expect(404);
    await api()
      .get(`/api/v1/workspaces/${wsId}/skills`)
      .set(auth(outsider))
      .expect(404);
  });

  it('PATCH settings gộp sâu; giá trị sai → 400', async () => {
    const res = await api()
      .patch(`/api/v1/workspaces/${wsId}/settings`)
      .set(auth(owner))
      .send({
        workload: { thresholds: { overload: 1.2 } },
        ai: { dailyLimitPerUser: 5 },
      })
      .expect(200);
    expect(res.body.workload.thresholds).toEqual({
      high: 0.7,
      full: 0.9,
      overload: 1.2,
    });
    expect(res.body.ai.dailyLimitPerUser).toBe(5);
    expect(res.body.workdays).toEqual([1, 2, 3, 4, 5]);
    const bad = await api()
      .patch(`/api/v1/workspaces/${wsId}/settings`)
      .set(auth(owner))
      .send({ workdays: [9] })
      .expect(400);
    expect(bad.body.code).toBe('VALIDATION_FAILED');
  });

  it('lời mời đích danh: xem trước công khai, sai email → 403, đúng email → thành viên MEMBER', async () => {
    const inv = await api()
      .post(`/api/v1/workspaces/${wsId}/invitations`)
      .set(auth(owner))
      .send({ email: member.email, role: 'MEMBER' })
      .expect(201);
    inviteToken = inv.body.token;

    const preview = await api()
      .get(`/api/v1/invitations/${inviteToken}`)
      .expect(200);
    expect(preview.body.workspaceName).toBe('Nhóm Đồ Án SmartTask');

    await api()
      .post(`/api/v1/invitations/${inviteToken}/accept`)
      .set(auth(outsider))
      .expect(403);
    const acc = await api()
      .post(`/api/v1/invitations/${inviteToken}/accept`)
      .set(auth(member))
      .expect(201);
    expect(acc.body.role).toBe('MEMBER');
    // đích danh dùng một lần
    await api()
      .post(`/api/v1/invitations/${inviteToken}/accept`)
      .set(auth(member))
      .expect(410);
    await api().get(`/api/v1/invitations/khong-ton-tai`).expect(410);
  });

  it('MEMBER không sửa được workspace/cài đặt (403); OWNER đổi vai; không gỡ/hạ OWNER', async () => {
    await api()
      .patch(`/api/v1/workspaces/${wsId}`)
      .set(auth(member))
      .send({ name: 'x' })
      .expect(403);
    await api()
      .patch(`/api/v1/workspaces/${wsId}/settings`)
      .set(auth(member))
      .send({})
      .expect(403);

    const members = await api()
      .get(`/api/v1/workspaces/${wsId}/members?q=huy`)
      .set(auth(member))
      .expect(200);
    expect(members.body.map((m: { id: string }) => m.id)).toEqual([member.id]);

    const promoted = await api()
      .patch(`/api/v1/workspaces/${wsId}/members/${member.id}`)
      .set(auth(owner))
      .send({ role: 'ADMIN' })
      .expect(200);
    expect(promoted.body.role).toBe('ADMIN');
    await api()
      .patch(`/api/v1/workspaces/${wsId}/members/${owner.id}`)
      .set(auth(member))
      .send({ role: 'MEMBER' })
      .expect(409);
    await api()
      .delete(`/api/v1/workspaces/${wsId}/members/${owner.id}`)
      .set(auth(member))
      .expect(409);
  });

  it('kỹ năng: thêm (trùng alias → 409), khai kỹ năng cá nhân, xác nhận, heatmap có bus factor', async () => {
    const dup = await api()
      .post(`/api/v1/workspaces/${wsId}/skills`)
      .set(auth(owner))
      .send({ name: 'ReactJS' })
      .expect(409);
    expect(dup.body.code).toBe('CONFLICT');
    const created = await api()
      .post(`/api/v1/workspaces/${wsId}/skills`)
      .set(auth(owner))
      .send({ name: 'React JS', category: 'Frontend', aliases: ['react-js'] })
      .expect(201);
    reactJsId = created.body.id;

    const mine = await api()
      .put(`/api/v1/workspaces/${wsId}/me/skills`)
      .set(auth(member))
      .send({
        skills: [
          { skillId: reactId, level: 4 },
          { skillId: reactJsId, level: 2 },
        ],
      })
      .expect(200);
    expect(mine.body).toHaveLength(2);
    expect(
      mine.body.find((s: { id: string }) => s.id === reactId).verifiedAt,
    ).toBeNull();

    const verified = await api()
      .patch(`/api/v1/users/${member.id}/skills/${reactId}/verify`)
      .set(auth(owner))
      .send({ level: 3 })
      .expect(200);
    expect(verified.body.level).toBe(3);
    expect(verified.body.verifiedAt).toBeTruthy();

    const matrix = await api()
      .get(`/api/v1/workspaces/${wsId}/skill-matrix?minLevel=3`)
      .set(auth(owner))
      .expect(200);
    expect(matrix.body.users.map((u: { id: string }) => u.id).sort()).toEqual(
      [owner.id, member.id].sort(),
    );
    const cell = matrix.body.cells.find(
      (c: { userId: string; skillId: string }) =>
        c.userId === member.id && c.skillId === reactId,
    );
    expect(cell).toMatchObject({ level: 3, verified: true });
    // React chỉ một người đạt ≥ 3 → bus factor
    expect(
      matrix.body.busFactor.find(
        (b: { skillId: string }) => b.skillId === reactId,
      ),
    ).toMatchObject({ holders: 1 });
  });

  it('gộp "React JS" vào "React": user_skills giữ mức cao hơn, tên nguồn thành alias, nguồn bị xoá', async () => {
    await api()
      .post(`/api/v1/skills/${reactJsId}/merge`)
      .set(auth(owner))
      .send({ intoSkillId: reactJsId })
      .expect(400);
    const merged = await api()
      .post(`/api/v1/skills/${reactJsId}/merge`)
      .set(auth(owner))
      .send({ intoSkillId: reactId })
      .expect(201);
    expect(merged.body.aliases).toEqual(
      expect.arrayContaining(['ReactJS', 'React JS', 'react-js']),
    );
    const mine = await api()
      .get(`/api/v1/workspaces/${wsId}/me/skills`)
      .set(auth(member))
      .expect(200);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0]).toMatchObject({ id: reactId, level: 3 });
    await api()
      .patch(`/api/v1/skills/${reactJsId}`)
      .set(auth(owner))
      .send({ name: 'x' })
      .expect(404);
  });

  it('chuyển quyền sở hữu: chủ mới OWNER, chủ cũ ADMIN; lưu trữ chỉ OWNER', async () => {
    await api()
      .post(`/api/v1/workspaces/${wsId}/archive`)
      .set(auth(member))
      .expect(403);
    await api()
      .post(`/api/v1/workspaces/${wsId}/transfer-ownership`)
      .set(auth(owner))
      .send({ userId: member.id })
      .expect(201);
    const list = await api()
      .get(`/api/v1/workspaces/${wsId}/members`)
      .set(auth(owner))
      .expect(200);
    const roles = Object.fromEntries(
      list.body.map((m: { id: string; role: string }) => [m.id, m.role]),
    );
    expect(roles[member.id]).toBe('OWNER');
    expect(roles[owner.id]).toBe('ADMIN');
    await api()
      .post(`/api/v1/workspaces/${wsId}/archive`)
      .set(auth(member))
      .expect(204);
    await api().get(`/api/v1/workspaces/${wsId}`).set(auth(owner)).expect(404);
  });
});
