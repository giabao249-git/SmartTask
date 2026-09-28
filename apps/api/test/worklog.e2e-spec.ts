import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, uniqueEmail } from './helpers';

/**
 * Nguồn bằng chứng cho hồ sơ kỹ năng (docs 02/08): ghi giờ (UC-35), đánh giá việc đã xong (UC-36),
 * bug → việc gốc. Kiểm quyền theo docs 11 §3.6: giờ = người được giao · PM; đánh giá = PM; rating chỉ
 * người được giao và PM thấy.
 */
describe('Ghi giờ, đánh giá việc, bug → việc gốc (e2e)', () => {
  let app: INestApplication;
  const api = () => request(app.getHttpServer());
  type U = { email: string; token: string; id: string };
  const pm: U = { email: uniqueEmail('wl-pm'), token: '', id: '' };
  const dev: U = { email: uniqueEmail('wl-dev'), token: '', id: '' };
  const other: U = { email: uniqueEmail('wl-other'), token: '', id: '' };
  let projectId = '';
  let otherProjectId = '';
  let columnId = '';
  let doneColumnId = '';
  let featureId = '';
  const auth = (u: U) => ({ Authorization: `Bearer ${u.token}` });
  const day = (offset: number) =>
    new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

  const register = async (u: U, name: string) => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ email: u.email, password: 'MatKhau@123', fullName: name })
      .expect(201);
    u.token = res.body.accessToken;
    u.id = res.body.user.id;
  };
  const task = (id: string) =>
    api().get(`/api/v1/tasks/${id}`).set(auth(pm)).expect(200);

  beforeAll(async () => {
    ({ app } = await createTestApp());
    await register(pm, 'Quản Lý Giờ');
    await register(dev, 'Người Làm');
    await register(other, 'Người Khác');
    const ws = await api()
      .post('/api/v1/workspaces')
      .set(auth(pm))
      .send({ name: 'WS giờ', slug: `ws-worklog-${Date.now()}` })
      .expect(201);
    for (const u of [dev, other]) {
      const inv = await api()
        .post(`/api/v1/workspaces/${ws.body.id}/invitations`)
        .set(auth(pm))
        .send({ email: u.email, role: 'MEMBER' })
        .expect(201);
      await api()
        .post(`/api/v1/invitations/${inv.body.token}/accept`)
        .set(auth(u))
        .expect(201);
    }
    const mkProject = async (key: string) => {
      const p = await api()
        .post(`/api/v1/workspaces/${ws.body.id}/projects`)
        .set(auth(pm))
        .send({ key, name: `Dự án ${key}`, pmUserId: pm.id })
        .expect(201);
      await api()
        .put(`/api/v1/projects/${p.body.id}/members`)
        .set(auth(pm))
        .send({
          members: [
            { userId: pm.id, role: 'PM' },
            { userId: dev.id, role: 'MEMBER' },
            { userId: other.id, role: 'MEMBER' },
          ],
        })
        .expect(200);
      return p.body.id as string;
    };
    projectId = await mkProject('WL');
    otherProjectId = await mkProject('WX');
    const detail = await api()
      .get(`/api/v1/projects/${projectId}`)
      .set(auth(pm))
      .expect(200);
    columnId = detail.body.columns[0].id;
    doneColumnId = detail.body.columns.find(
      (c: { isDone: boolean }) => c.isDone,
    ).id;
    const t = await api()
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set(auth(pm))
      .send({
        title: 'Tính năng đăng nhập',
        columnId,
        assigneeIds: [dev.id],
        estimateHours: 8,
      })
      .expect(201);
    featureId = t.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('ghi giờ: người được giao ghi cho mình; không ghi ngày tương lai; tổng ngày ≤ 24 h', async () => {
    const r = await api()
      .post(`/api/v1/tasks/${featureId}/time-entries`)
      .set(auth(dev))
      .send({ workDate: day(0), hours: 2.5, note: 'dựng form' })
      .expect(201);
    expect(r.body.totalHours).toBe(2.5);
    expect(r.body.estimateHours).toBe(8);
    expect(r.body.entries[0]).toMatchObject({
      userId: dev.id,
      hours: 2.5,
      canEdit: true,
    });

    await api()
      .post(`/api/v1/tasks/${featureId}/time-entries`)
      .set(auth(dev))
      .send({ workDate: day(1), hours: 1 })
      .expect(422);
    await api()
      .post(`/api/v1/tasks/${featureId}/time-entries`)
      .set(auth(dev))
      .send({ workDate: day(0), hours: 22 })
      .expect(422);
  });

  it('ghi giờ: thành viên không được giao → 403; PM ghi được (đứng tên PM); chỉ người ghi hoặc PM sửa/xoá', async () => {
    await api()
      .post(`/api/v1/tasks/${featureId}/time-entries`)
      .set(auth(other))
      .send({ workDate: day(0), hours: 1 })
      .expect(403);
    const byPm = await api()
      .post(`/api/v1/tasks/${featureId}/time-entries`)
      .set(auth(pm))
      .send({ workDate: day(-1), hours: 1 })
      .expect(201);
    expect(byPm.body.totalHours).toBe(3.5);
    const mine = byPm.body.entries.find(
      (e: { userId: string }) => e.userId === dev.id,
    );

    const seenByOther = await api()
      .get(`/api/v1/tasks/${featureId}/time-entries`)
      .set(auth(other))
      .expect(200);
    expect(
      seenByOther.body.entries.every((e: { canEdit: boolean }) => !e.canEdit),
    ).toBe(true);
    await api()
      .delete(`/api/v1/time-entries/${mine.id}`)
      .set(auth(other))
      .expect(403);
    const edited = await api()
      .patch(`/api/v1/time-entries/${mine.id}`)
      .set(auth(dev))
      .send({ hours: 3 })
      .expect(200);
    expect(edited.body.totalHours).toBe(4);
    const left = await api()
      .delete(`/api/v1/time-entries/${byPm.body.id}`)
      .set(auth(pm))
      .expect(200);
    expect(left.body.totalHours).toBe(3);
  });

  it('đánh giá: chỉ PM, chỉ việc đã xong; nội dung chỉ người được giao và PM thấy', async () => {
    const body = {
      rating: 4,
      difficultyActual: 3,
      actualHoursConfirmed: 7.5,
      comment: 'ổn',
    };
    await api()
      .put(`/api/v1/tasks/${featureId}/review`)
      .set(auth(pm))
      .send(body)
      .expect(422);
    const cur = await task(featureId);
    await api()
      .patch(`/api/v1/tasks/${featureId}/move`)
      .set(auth(pm))
      .send({ version: cur.body.version, columnId: doneColumnId })
      .expect(200);
    await api()
      .put(`/api/v1/tasks/${featureId}/review`)
      .set(auth(dev))
      .send(body)
      .expect(403);
    const r = await api()
      .put(`/api/v1/tasks/${featureId}/review`)
      .set(auth(pm))
      .send(body)
      .expect(200);
    expect(r.body.review).toMatchObject({
      rating: 4,
      difficultyActual: 3,
      actualHoursConfirmed: 7.5,
      selfReview: false,
    });

    const asAssignee = await api()
      .get(`/api/v1/tasks/${featureId}/review`)
      .set(auth(dev))
      .expect(200);
    expect(asAssignee.body).toMatchObject({
      visible: true,
      canReview: false,
      done: true,
    });
    expect(asAssignee.body.review.rating).toBe(4);
    const asOther = await api()
      .get(`/api/v1/tasks/${featureId}/review`)
      .set(auth(other))
      .expect(200);
    expect(asOther.body).toMatchObject({ visible: false, review: null });

    // Sửa lại đánh giá = ghi đè (một việc một đánh giá)
    const again = await api()
      .put(`/api/v1/tasks/${featureId}/review`)
      .set(auth(pm))
      .send({ rating: 2, difficultyActual: 4 })
      .expect(200);
    expect(again.body.review).toMatchObject({
      rating: 2,
      difficultyActual: 4,
      actualHoursConfirmed: null,
    });
  });

  it('bug → việc gốc: chỉ task BUG, cùng dự án; việc gốc liệt kê bug; đổi khỏi BUG thì gỡ liên kết', async () => {
    const mk = (extra: Record<string, unknown>, project = projectId) =>
      api()
        .post(`/api/v1/projects/${project}/tasks`)
        .set(auth(dev))
        .send({
          title: 'Lỗi đăng nhập sai mật khẩu vẫn vào',
          columnId,
          ...extra,
        });
    await mk({ type: 'TASK', originTaskId: featureId }).expect(422);
    const foreign = await api()
      .get(`/api/v1/projects/${otherProjectId}`)
      .set(auth(pm))
      .expect(200);
    await mk(
      {
        type: 'BUG',
        originTaskId: featureId,
        columnId: foreign.body.columns[0].id,
      },
      otherProjectId,
    ).expect(404);

    const bug = await mk({ type: 'BUG', originTaskId: featureId }).expect(201);
    expect(bug.body.origin).toMatchObject({ id: featureId, key: 'WL-1' });
    const origin = await task(featureId);
    expect(origin.body.derivedBugs).toEqual([
      expect.objectContaining({ id: bug.body.id, done: false }),
    ]);

    const asTask = await api()
      .patch(`/api/v1/tasks/${bug.body.id}`)
      .set(auth(dev))
      .send({ version: bug.body.version, type: 'TASK' })
      .expect(200);
    expect(asTask.body.origin).toBeNull();
    await api()
      .patch(`/api/v1/tasks/${bug.body.id}`)
      .set(auth(dev))
      .send({
        version: asTask.body.version,
        type: 'BUG',
        originTaskId: bug.body.id,
      })
      .expect(422);
  });
});
