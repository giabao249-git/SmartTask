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
  let wsId = '';
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
    wsId = ws.body.id;
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

  it('hồ sơ kỹ năng TỪ BẰNG CHỨNG: tự khai không tính; xong + PM đánh giá → lên mức; bug gốc → tụt; hiệu suất chỉ bản thân/PM thấy', async () => {
    const skills = await api()
      .get(`/api/v1/workspaces/${wsId}/skills`)
      .set(auth(pm))
      .expect(200);
    const nest =
      skills.body.find((s: { name: string }) => s.name === 'NestJS') ??
      skills.body[0];
    // Tự khai mức 5 → hồ sơ vẫn "chưa có bằng chứng"
    await api()
      .put(`/api/v1/workspaces/${wsId}/me/skills`)
      .set(auth(dev))
      .send({ skills: [{ skillId: nest.id, level: 5 }] })
      .expect(200);
    const skillOf = async (viewer: U) => {
      const r = await api()
        .get(`/api/v1/projects/${projectId}/skill-profiles`)
        .set(auth(viewer))
        .expect(200);
      const me = r.body.find((m: { id: string }) => m.id === dev.id);
      return {
        me,
        row: me.skills.find((s: { skillId: string }) => s.skillId === nest.id),
      };
    };
    let { row } = await skillOf(pm);
    expect(row).toMatchObject({
      level: 0,
      confidence: 'none',
      declared: 5,
      evidence: 'chưa có bằng chứng',
    });

    // Việc cần NestJS ≥ 3, dev làm xong, PM đánh giá 4 → mức 3
    const t = await api()
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set(auth(pm))
      .send({
        title: 'API refresh token',
        columnId,
        assigneeIds: [dev.id],
        estimateHours: 6,
        difficulty: 3,
        requiredSkills: [{ skillId: nest.id, minLevel: 3 }],
      })
      .expect(201);
    await api()
      .patch(`/api/v1/tasks/${t.body.id}/move`)
      .set(auth(pm))
      .send({ version: t.body.version, columnId: doneColumnId })
      .expect(200);
    await api()
      .put(`/api/v1/tasks/${t.body.id}/review`)
      .set(auth(pm))
      .send({ rating: 4, difficultyActual: 3 })
      .expect(200);
    ({ row } = await skillOf(pm));
    expect(row).toMatchObject({
      level: 3,
      confidence: 'low',
      tasks: 1,
      passed: 1,
      reviewed: 1,
      declared: 5,
    });

    // Hiệu suất: PM và chính dev thấy; người khác không
    expect((await skillOf(pm)).me.performance).not.toBeNull();
    expect((await skillOf(dev)).me.performance).not.toBeNull();
    expect((await skillOf(other)).me.performance).toBeNull();

    // Bug gắn việc gốc → việc đó thành "phải làm lại" → mức rơi về 0 (còn bằng chứng, không phải "chưa biết")
    await api()
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set(auth(pm))
      .send({
        title: 'Refresh token không hết hạn',
        columnId,
        type: 'BUG',
        originTaskId: t.body.id,
      })
      .expect(201);
    ({ row } = await skillOf(pm));
    expect(row).toMatchObject({
      level: 0,
      confidence: 'low',
      tasks: 1,
      failed: 1,
    });
    expect(row.evidence).toContain('1 phải làm lại');

    const detail = await api()
      .get(
        `/api/v1/projects/${projectId}/skill-profiles/${dev.id}/evidence?skillId=${nest.id}`,
      )
      .set(auth(other))
      .expect(200);
    expect(detail.body).toEqual([
      expect.objectContaining({
        task: expect.objectContaining({ id: t.body.id }),
        passed: false,
        bugs: 1,
        rating: null,
      }),
    ]);
  });

  it('tab Nhân sự: PM dự án xác nhận được kỹ năng thành viên; Viewer không là ứng viên; danh sách chờ đánh giá', async () => {
    const skills = await api()
      .get(`/api/v1/workspaces/${wsId}/skills`)
      .set(auth(pm))
      .expect(200);
    const react =
      skills.body.find((s: { name: string }) => s.name === 'React') ??
      skills.body[1];
    // `other` là MEMBER của workspace nhưng làm PM một dự án có `dev` → được xác nhận kỹ năng của dev
    const p = await api()
      .post(`/api/v1/workspaces/${wsId}/projects`)
      .set(auth(pm))
      .send({ key: 'WV', name: 'Dự án do Khác quản lý', pmUserId: other.id })
      .expect(201);
    await api()
      .put(`/api/v1/projects/${p.body.id}/members`)
      .set(auth(pm))
      .send({
        members: [
          { userId: other.id, role: 'PM' },
          { userId: dev.id, role: 'MEMBER' },
        ],
      })
      .expect(200);
    await api()
      .patch(`/api/v1/users/${dev.id}/skills/${react.id}/verify`)
      .set(auth(other))
      .send({ level: 3 })
      .expect(200);
    // dev không là PM dự án nào có `other` → không được xác nhận
    await api()
      .patch(`/api/v1/users/${other.id}/skills/${react.id}/verify`)
      .set(auth(dev))
      .send({ level: 3 })
      .expect(403);

    // Viewer của workspace còn trong dự án nhưng không nằm trong bảng năng lực
    const viewer: U = { email: uniqueEmail('wl-viewer'), token: '', id: '' };
    await register(viewer, 'Người Xem');
    const inv = await api()
      .post(`/api/v1/workspaces/${wsId}/invitations`)
      .set(auth(pm))
      .send({ email: viewer.email, role: 'MEMBER' })
      .expect(201);
    await api()
      .post(`/api/v1/invitations/${inv.body.token}/accept`)
      .set(auth(viewer))
      .expect(201);
    await api()
      .put(`/api/v1/projects/${projectId}/members`)
      .set(auth(pm))
      .send({
        members: [
          { userId: pm.id, role: 'PM' },
          { userId: dev.id, role: 'MEMBER' },
          { userId: other.id, role: 'MEMBER' },
          { userId: viewer.id, role: 'MEMBER' },
        ],
      })
      .expect(200);
    // Hạ xuống VIEWER sau khi đã vào dự án (như Mai trong seed): vẫn là thành viên dự án nhưng không nhận việc
    await api()
      .patch(`/api/v1/workspaces/${wsId}/members/${viewer.id}`)
      .set(auth(pm))
      .send({ role: 'VIEWER' })
      .expect(200);
    const cap = await api()
      .get(`/api/v1/projects/${projectId}/capacity-table`)
      .set(auth(pm))
      .expect(200);
    const ids = cap.body.members.map((m: { userId: string }) => m.userId);
    expect(ids).toContain(dev.id);
    expect(ids).not.toContain(viewer.id);

    // Việc đã xong chưa đánh giá: có "Tính năng đăng nhập"? — đã đánh giá ở ca trước nên KHÔNG có; thêm một việc xong mới
    const t = await api()
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set(auth(pm))
      .send({
        title: 'Việc xong chờ chấm',
        columnId: doneColumnId,
        assigneeIds: [dev.id],
      })
      .expect(201);
    const pending = await api()
      .get(`/api/v1/projects/${projectId}/reviews/pending`)
      .set(auth(pm))
      .expect(200);
    expect(pending.body.map((x: { id: string }) => x.id)).toContain(t.body.id);
    expect(pending.body.map((x: { id: string }) => x.id)).not.toContain(
      featureId,
    );
    expect(
      pending.body.find((x: { id: string }) => x.id === t.body.id),
    ).toMatchObject({
      selfAssigned: false,
      assignees: [expect.objectContaining({ id: dev.id })],
    });
    await api()
      .get(`/api/v1/projects/${projectId}/reviews/pending`)
      .set(auth(dev))
      .expect(403);
  });
});
