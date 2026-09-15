import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, uniqueEmail } from './helpers';

/**
 * Phase 5: hai người cùng 32 giờ việc tuần này — Lan có 3 dự án + 11 h họp + nghỉ → Quá tải & cảnh báo;
 * Minh 1 dự án ít họp → Cao. Burn-down/forecast của sprint đang chạy; capacity-table là sự thật, không xếp hạng.
 */
describe('Tải nhân sự & dự báo (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const api = () => request(app.getHttpServer());
  type U = { email: string; token: string; id: string };
  const admin: U = { email: uniqueEmail('admin'), token: '', id: '' };
  const lan: U = { email: uniqueEmail('lan'), token: '', id: '' };
  const minh: U = { email: uniqueEmail('minh'), token: '', id: '' };
  const auth = (u: U) => ({ Authorization: `Bearer ${u.token}` });
  let wsId = '';
  const projects: string[] = [];
  let sprintId = '';
  const monday = (() => {
    const d = new Date();
    const day = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - day);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  })();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const plus = (base: Date, days: number) =>
    new Date(base.getTime() + days * 86_400_000);
  // Tuần tới để không dính cuối tuần/quá hạn dù chạy test ngày nào
  const nextMon = plus(monday, 7);
  const nextFri = plus(monday, 11);

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    for (const [u, name] of [
      [admin, 'Admin'],
      [lan, 'Nguyễn Thị Lan'],
      [minh, 'Trần Quang Minh'],
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
      .send({ name: 'WS Phase 5' })
      .expect(201);
    wsId = ws.body.id;
    for (const u of [lan, minh]) {
      const inv = await api()
        .post(`/api/v1/workspaces/${wsId}/invitations`)
        .set(auth(admin))
        .send({ email: u.email })
        .expect(201);
      await api()
        .post(`/api/v1/invitations/${inv.body.token}/accept`)
        .set(auth(u))
        .expect(201);
    }
    for (const key of ['P1', 'P2', 'P3']) {
      const p = await api()
        .post(`/api/v1/workspaces/${wsId}/projects`)
        .set(auth(admin))
        .send({ key, name: `Dự án ${key}`, pmUserId: admin.id })
        .expect(201);
      projects.push(p.body.id);
      await api()
        .put(`/api/v1/projects/${p.body.id}/members`)
        .set(auth(admin))
        .send({
          members: [
            { userId: admin.id, role: 'PM' },
            { userId: lan.id, role: 'MEMBER' },
            { userId: minh.id, role: 'MEMBER' },
          ],
        })
        .expect(200);
    }
    // Lan: 32 h chia 3 dự án, khó 4; Minh: 32 h một dự án, khó 3 — đều trong tuần tới
    for (const [pid, hours] of [
      [projects[0], 12],
      [projects[1], 12],
      [projects[2], 8],
    ] as const) {
      await api()
        .post(`/api/v1/projects/${pid}/tasks`)
        .set(auth(admin))
        .send({
          title: `Việc của Lan ${hours}h`,
          estimateHours: hours,
          difficulty: 4,
          startDate: iso(nextMon),
          dueDate: iso(nextFri),
          assigneeIds: [lan.id],
        })
        .expect(201);
    }
    await api()
      .post(`/api/v1/projects/${projects[0]}/tasks`)
      .set(auth(admin))
      .send({
        title: 'Việc của Minh 32h',
        estimateHours: 32,
        difficulty: 3,
        startDate: iso(nextMon),
        dueDate: iso(nextFri),
        assigneeIds: [minh.id],
      })
      .expect(201);
    // Lịch bận của Lan tuần tới: 11 h họp + nghỉ nửa ngày; Minh 3 h họp
    const conn = await prisma.calendarConnection.create({
      data: { userId: lan.id, source: 'MANUAL' },
    });
    const connM = await prisma.calendarConnection.create({
      data: { userId: minh.id, source: 'MANUAL' },
    });
    const ev = (
      uid: string,
      cid: string,
      dayOffset: number,
      h1: number,
      h2: number,
    ) => ({
      userId: uid,
      connectionId: cid,
      startAt: new Date(plus(nextMon, dayOffset).getTime() + h1 * 3_600_000),
      endAt: new Date(plus(nextMon, dayOffset).getTime() + h2 * 3_600_000),
      isBusy: true,
    });
    await prisma.calendarEvent.createMany({
      data: [
        ev(lan.id, conn.id, 0, 9, 12),
        ev(lan.id, conn.id, 1, 9, 12),
        ev(lan.id, conn.id, 2, 9, 12),
        ev(lan.id, conn.id, 3, 14, 16),
        ev(minh.id, connM.id, 0, 9, 12),
      ],
    });
    await prisma.userTimeOff.create({
      data: {
        userId: lan.id,
        fromDate: plus(nextMon, 4),
        toDate: plus(nextMon, 4),
        kind: 'PARTIAL',
        hoursPerDay: 4,
      },
    });
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

  it('GET /workspaces/:id/workload: Lan quá tải (3 dự án, họp, nghỉ, khó 4), Minh chỉ Cao; thành viên thường 403', async () => {
    await api()
      .get(`/api/v1/workspaces/${wsId}/workload`)
      .set(auth(lan))
      .expect(403);
    const res = await api()
      .get(`/api/v1/workspaces/${wsId}/workload?from=${iso(nextMon)}&weeks=1`)
      .set(auth(admin))
      .expect(200);
    const L = res.body.users.find(
      (u: { userId: string }) => u.userId === lan.id,
    ).weeks[0];
    const M = res.body.users.find(
      (u: { userId: string }) => u.userId === minh.id,
    ).weeks[0];
    expect(L.loadHours).toBe(32);
    expect(L.projectsOpen).toBe(3);
    expect(L.switchPenalty).toBeCloseTo(1.1);
    expect(L.meetingHours).toBe(11);
    expect(L.timeOffHours).toBe(4);
    expect(L.effCapacityHours).toBe(21); // 40 − 11 − 4 − 4
    expect(L.effLoadHours).toBeCloseTo(32 * 1.1 * 1.1, 1); // EAR 1 (chưa lịch sử), khó 4 → 1.1, 3 dự án → 1.1
    expect(L.level).toBe('OVERLOAD');
    expect(M.loadHours).toBe(32);
    expect(M.effCapacityHours).toBe(33); // 40 − 3 − 4
    expect(M.level).toBe('FULL'); // 32/33 ≈ 0.97
    expect(res.body.spread).toBeGreaterThan(0.5);
    expect(res.body.users[0].userId).toBe(lan.id); // sắp theo mức sử dụng giảm dần — chỉ để hiển thị
  });

  it('chi tiết tuần của Lan: task cấu thành, hệ số, breakdown; người khác không xem được', async () => {
    await api()
      .get(
        `/api/v1/users/${lan.id}/workload/details?week=${iso(nextMon)}&workspaceId=${wsId}`,
      )
      .set(auth(minh))
      .expect(403);
    const res = await api()
      .get(
        `/api/v1/users/${lan.id}/workload/details?week=${iso(nextMon)}&workspaceId=${wsId}`,
      )
      .set(auth(lan))
      .expect(200);
    expect(res.body.tasks).toHaveLength(3);
    expect(res.body.tasks[0].factors).toEqual({
      ear: 1,
      difficulty: 1.1,
      skillGap: 1,
    });
    expect(res.body.freeByDay).toHaveLength(7);
    const fri = res.body.freeByDay.find(
      (d: { date: string }) => d.date === iso(nextFri),
    );
    expect(fri.isWorkday).toBe(true);
    expect(
      res.body.freeByDay.find(
        (d: { date: string }) => d.date === iso(plus(nextMon, 5)),
      ).freeHours,
    ).toBe(0); // thứ Bảy
  });

  it('POST recompute → snapshot + cảnh báo OVERLOAD cho Lan → thông báo cho Lan và PM; ack', async () => {
    // tuần "hiện tại" của cron là tuần này; đẩy việc của Lan về tuần này để cảnh báo bắn
    await prisma.task.updateMany({
      where: { assignees: { some: { userId: lan.id } } },
      data: { startDate: monday, dueDate: plus(monday, 4) },
    });
    await prisma.calendarEvent.updateMany({
      where: { userId: lan.id },
      data: {
        startAt: new Date(monday.getTime() + 9 * 3_600_000),
        endAt: new Date(monday.getTime() + 12 * 3_600_000),
      },
    });
    const res = await api()
      .post(`/api/v1/projects/${projects[0]}/workload/recompute`)
      .set(auth(admin))
      .expect(202);
    expect(res.body.users).toBe(3);
    const alerts = await api()
      .get(`/api/v1/workspaces/${wsId}/workload/alerts`)
      .set(auth(admin))
      .expect(200);
    const lanAlert = alerts.body.find(
      (a: { userId: string; kind: string }) =>
        a.userId === lan.id && a.kind === 'OVERLOAD',
    );
    expect(lanAlert).toBeTruthy();
    const snap = await prisma.workloadSnapshot.findFirst({
      where: { userId: lan.id, weekStart: monday },
    });
    expect(snap?.level).toBe('OVERLOAD');
    await new Promise((r) => setTimeout(r, 300));
    const notif = (
      await api()
        .get('/api/v1/notifications?unread=true')
        .set(auth(lan))
        .expect(200)
    ).body as { items: Array<{ type: string }> };
    expect(notif.items.some((n) => n.type === 'WORKLOAD_ALERT')).toBe(true);
    const pmNotif = await api()
      .get('/api/v1/notifications?unread=true')
      .set(auth(admin))
      .expect(200);
    expect(
      pmNotif.body.items.some(
        (n: { type: string }) => n.type === 'WORKLOAD_ALERT',
      ),
    ).toBe(true);
    await api()
      .post(`/api/v1/workload/alerts/${lanAlert.id}/ack`)
      .set(auth(lan))
      .expect(403);
    const acked = await api()
      .post(`/api/v1/workload/alerts/${lanAlert.id}/ack`)
      .set(auth(admin))
      .send({ note: 'Chuyển bớt sang Minh' })
      .expect(201);
    expect(acked.body.ackedAt).toBeTruthy();
    const open = await api()
      .get(`/api/v1/workspaces/${wsId}/workload/alerts`)
      .set(auth(admin))
      .expect(200);
    expect(
      open.body.find((a: { id: string }) => a.id === lanAlert.id),
    ).toBeUndefined();
  });

  it('dashboard có workloadWeek và openAlerts; capacity-table là bảng sự thật không xếp hạng', async () => {
    const dash = await api()
      .get(`/api/v1/projects/${projects[0]}/dashboard`)
      .set(auth(minh))
      .expect(200);
    expect(
      dash.body.workloadWeek.find(
        (w: { userId: string }) => w.userId === lan.id,
      ).level,
    ).toBe('OVERLOAD');
    const unassigned = await api()
      .post(`/api/v1/projects/${projects[0]}/tasks`)
      .set(auth(admin))
      .send({
        title: 'Chưa giao',
        estimateHours: 6,
        difficulty: 2,
        dueDate: iso(nextFri),
      })
      .expect(201);
    const table = await api()
      .get(`/api/v1/projects/${projects[0]}/capacity-table`)
      .set(auth(admin))
      .expect(200);
    expect(table.body.members).toHaveLength(3);
    expect(table.body.tasks.map((t: { taskId: string }) => t.taskId)).toEqual([
      unassigned.body.id,
    ]);
    const t = table.body.tasks[0];
    expect(t.perUser).toHaveLength(3);
    expect(
      t.perUser.every((p: { hoursEff: number }) => p.hoursEff === 6 * 0.9),
    ).toBe(true); // khó 2 → 0.9, EAR 1
    expect(Object.keys(t.perUser[0])).toEqual(
      expect.arrayContaining([
        'userId',
        'hoursEff',
        'skillMatch',
        'freeBeforeDue',
      ]),
    );
    expect(Object.keys(t)).not.toContain('bestUserId'); // không có "người tốt nhất"
    await api()
      .get(`/api/v1/projects/${projects[0]}/capacity-table`)
      .set(auth(minh))
      .expect(403);
  });

  it('sprint đang chạy: burndown có lý tưởng/thực tế, forecast có ETA/rủi ro/nguyên nhân', async () => {
    const s = await api()
      .post(`/api/v1/projects/${projects[0]}/sprints`)
      .set(auth(admin))
      .send({
        name: 'Sprint A',
        startDate: iso(monday),
        endDate: iso(plus(monday, 11)),
      })
      .expect(201);
    sprintId = s.body.id;
    const tasks = await api()
      .get(`/api/v1/projects/${projects[0]}/tasks`)
      .set(auth(admin))
      .expect(200);
    await api()
      .post(`/api/v1/sprints/${sprintId}/tasks`)
      .set(auth(admin))
      .send({ taskIds: tasks.body.items.map((t: { id: string }) => t.id) })
      .expect(201);
    await api()
      .post(`/api/v1/sprints/${sprintId}/start`)
      .set(auth(admin))
      .expect(201);
    const bd = await api()
      .get(`/api/v1/sprints/${sprintId}/burndown`)
      .set(auth(minh))
      .expect(200);
    expect(bd.body.scopeInitial).toBe(50); // 12 + 32 + 6
    expect(bd.body.ideal[0].ideal).toBeLessThan(50);
    expect(bd.body.ideal[bd.body.ideal.length - 1].ideal).toBe(0);
    expect(bd.body.actual).toHaveLength(1); // điểm live hôm nay
    expect(bd.body.actual[0].remaining).toBe(50);
    const fc = await api()
      .get(`/api/v1/sprints/${sprintId}/forecast`)
      .set(auth(minh))
      .expect(200);
    expect(fc.body.remainingHours).toBe(50);
    expect(fc.body.riskLevel).toBe('UNKNOWN'); // sprint < 3 ngày làm việc
    expect(fc.body.causes.map((c: { code: string }) => c.code)).toEqual(
      expect.arrayContaining([
        'UNASSIGNED',
        'OVERLOADED_MEMBER',
        'BIG_NOT_STARTED',
      ]),
    );
  });
});
