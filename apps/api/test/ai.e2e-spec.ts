import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, uniqueEmail } from './helpers';

/**
 * Phase 7 — AI MVP với nhà cung cấp giả (AI_PROVIDER=fake, docs 05): phân rã → DRAFT (validator kiểm trên dữ liệu
 * sống) → PM sửa/áp dụng → task nguồn AI qua TasksService + thông báo; các nhánh lỗi (mã lạ tự sửa khi gọi lại,
 * vòng phụ thuộc, JSON hỏng, hỏi lại); hạn mức; giải thích rủi ro (mức từ backend, cache 6 h); quản trị cấu hình.
 */
describe('AI MVP (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const api = () => request(app.getHttpServer());
  type U = { email: string; token: string; id: string };
  const pm: U = { email: uniqueEmail('pm'), token: '', id: '' };
  const lan: U = { email: uniqueEmail('lan'), token: '', id: '' };
  const minh: U = { email: uniqueEmail('minh'), token: '', id: '' };
  const auth = (u: U) => ({ Authorization: `Bearer ${u.token}` });
  let wsId = '';
  let projectId = '';
  let plannedSprintId = '';
  let activeSprintId = '';
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const plus = (base: Date, days: number) =>
    new Date(base.getTime() + days * 86_400_000);
  const monday = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    d.setUTCHours(0, 0, 0, 0);
    return d;
  })();
  const REQ =
    'Xây dựng chức năng quên mật khẩu qua email: nhập email, gửi link 15 phút, đặt mật khẩu mới.';

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    for (const [u, name] of [
      [pm, 'Phạm Quản Lý'],
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
      .set(auth(pm))
      .send({ name: 'WS Phase 7' })
      .expect(201);
    wsId = ws.body.id;
    for (const u of [lan, minh]) {
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
      .send({ key: 'AI', name: 'Dự án AI', pmUserId: pm.id })
      .expect(201);
    projectId = p.body.id;
    await api()
      .put(`/api/v1/projects/${projectId}/members`)
      .set(auth(pm))
      .send({
        members: [
          { userId: pm.id, role: 'PM' },
          { userId: lan.id, role: 'MEMBER' },
          { userId: minh.id, role: 'MEMBER' },
        ],
      })
      .expect(200);
    // Lan khai mọi kỹ năng mức 5 → chắc chắn có kỹ năng k1 mà fake provider chọn
    const skills = await api()
      .get(`/api/v1/workspaces/${wsId}/skills`)
      .set(auth(pm))
      .expect(200);
    await api()
      .put(`/api/v1/workspaces/${wsId}/me/skills`)
      .set(auth(lan))
      .send({
        skills: skills.body.map((s: { id: string }) => ({
          skillId: s.id,
          level: 5,
        })),
      })
      .expect(200);
    // Sprint kế hoạch (tuần tới, 2 tuần) cho phân rã; sprint đang chạy (tuần này) có việc quá hạn cho giải thích rủi ro
    const planned = await api()
      .post(`/api/v1/projects/${projectId}/sprints`)
      .set(auth(pm))
      .send({
        name: 'Sprint 2',
        startDate: iso(plus(monday, 7)),
        endDate: iso(plus(monday, 18)),
      })
      .expect(201);
    plannedSprintId = planned.body.id;
    const active = await api()
      .post(`/api/v1/projects/${projectId}/sprints`)
      .set(auth(pm))
      .send({
        name: 'Sprint 1',
        startDate: iso(plus(monday, -7)),
        endDate: iso(plus(monday, 4)),
      })
      .expect(201);
    activeSprintId = active.body.id;
    await api()
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set(auth(pm))
      .send({
        title: 'Việc quá hạn',
        estimateHours: 16,
        sprintId: activeSprintId,
        startDate: iso(plus(monday, -7)),
        dueDate: iso(plus(monday, -3)),
        assigneeIds: [minh.id],
      })
      .expect(201);
    await api()
      .post(`/api/v1/sprints/${activeSprintId}/start`)
      .set(auth(pm))
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Phân rã yêu cầu (UC-28)', () => {
    let proposalId = '';

    it('thành viên thường không được gọi (pj:PM)', async () => {
      await api()
        .post(`/api/v1/projects/${projectId}/ai/decompose`)
        .set(auth(lan))
        .send({ requirement: REQ })
        .expect(403);
    });

    it('yêu cầu quá ngắn → 400', async () => {
      await api()
        .post(`/api/v1/projects/${projectId}/ai/decompose`)
        .set(auth(pm))
        .send({ requirement: 'ngắn' })
        .expect(400);
    });

    it('PM phân rã → DRAFT qua Validator, mã ngắn, số backend tính trong facts', async () => {
      const res = await api()
        .post(`/api/v1/projects/${projectId}/ai/decompose`)
        .set(auth(pm))
        .send({ requirement: REQ, sprintId: plannedSprintId, detail: 'normal' })
        .expect(200);
      expect(res.body.cached).toBe(false);
      expect(res.body.action.type).toBe('DECOMPOSE_PROPOSAL');
      expect(res.body.action.tasks).toHaveLength(3);
      expect(res.body.action.tasks[0].suggestedAssignee).toMatch(/^u\d+$/);
      expect(res.body.validation.ok).toBe(true);
      expect(res.body.validation.facts.totalHours).toBe(18);
      expect(
        res.body.validation.warnings.map((w: { code: string }) => w.code),
      ).toContain('SKILL_UNKNOWN');
      expect(res.body.usage).toMatchObject({ attempts: 1 });
      expect(['fake', 'mock']).toContain(res.body.usage.model);
      proposalId = res.body.proposalId;

      const row = await prisma.aiProposal.findUniqueOrThrow({
        where: { id: proposalId },
      });
      expect(row.status).toBe('DRAFT');
      expect(row.codeMap).toHaveProperty('users');
      const log = await prisma.aiTokenLog.findFirst({
        where: { proposalId },
        orderBy: { createdAt: 'desc' },
      });
      expect(log).toMatchObject({
        purpose: 'DECOMPOSE',
        status: 'SUCCESS',
        userId: pm.id,
        workspaceId: wsId,
      });
      expect(log!.userMessage).toContain('quên mật khẩu');
      expect(log!.promptHash).toHaveLength(32);
    });

    it('bấm trùng cùng yêu cầu → trả lại DRAFT đang mở, không gọi AI', async () => {
      const before = await prisma.aiTokenLog.count({
        where: { userId: pm.id },
      });
      const res = await api()
        .post(`/api/v1/projects/${projectId}/ai/decompose`)
        .set(auth(pm))
        .send({ requirement: REQ, sprintId: plannedSprintId, detail: 'normal' })
        .expect(200);
      expect(res.body).toMatchObject({ proposalId, cached: true });
      expect(await prisma.aiTokenLog.count({ where: { userId: pm.id } })).toBe(
        before,
      );
    });

    it('GET đề xuất: PM xem được, thành viên thường 403', async () => {
      const res = await api()
        .get(`/api/v1/ai/proposals/${proposalId}`)
        .set(auth(pm))
        .expect(200);
      expect(res.body).toMatchObject({
        status: 'DRAFT',
        kind: 'DECOMPOSE',
        request: { detail: 'normal', sprintId: plannedSprintId },
      });
      expect(res.body.codeMap.sprints).toBeDefined();
      await api()
        .get(`/api/v1/ai/proposals/${proposalId}`)
        .set(auth(lan))
        .expect(403);
    });

    it('áp dụng kèm sửa (giờ d2, bỏ d3) → task nguồn AI, subtask, phụ thuộc, feedback, thông báo, idempotent', async () => {
      const res = await api()
        .post(`/api/v1/ai/proposals/${proposalId}/apply`)
        .set(auth(pm))
        .set('Idempotency-Key', 'k-1')
        .send({
          edits: {
            tasks: [
              { draftKey: 'd2', estimateHours: 10 },
              { draftKey: 'd3', remove: true },
            ],
          },
        })
        .expect(201);
      expect(res.body.createdTaskIds).toHaveLength(2);
      expect(
        res.body.tasks.map((t: { draftKey: string }) => t.draftKey).sort(),
      ).toEqual(['d1', 'd2']);

      const tasks = await api()
        .get(`/api/v1/projects/${projectId}/tasks?sprintId=${plannedSprintId}`)
        .set(auth(pm))
        .expect(200);
      const d1 = tasks.body.items.find(
        (t: { title: string }) => t.title === 'Thiết kế màn hình đăng nhập',
      );
      const d2 = tasks.body.items.find(
        (t: { title: string }) => t.title === 'API xác thực',
      );
      expect(d1).toMatchObject({ source: 'AI', estimateHours: 8 });
      expect(d1.assignees.map((a: { id: string }) => a.id)).toEqual([lan.id]);
      expect(d1.subtaskCount).toBe(1);
      expect(d2).toMatchObject({ source: 'AI', estimateHours: 10 });
      expect(d2.dependsOnIds).toEqual([d1.id]);
      expect(d1.requiredSkills.length).toBeGreaterThan(0);

      const row = await prisma.aiProposal.findUniqueOrThrow({
        where: { id: proposalId },
      });
      expect(row.status).toBe('APPLIED');
      expect(row.appliedById).toBe(pm.id);
      const fb = await prisma.aiFeedback.findMany({ where: { proposalId } });
      expect(fb.map((f) => f.editKind).sort()).toEqual([
        'ACCEPTED',
        'CHANGED_HOURS',
        'REJECTED',
      ]);
      const dbTasks = await prisma.task.findMany({
        where: { aiProposalId: proposalId },
      });
      expect(dbTasks).toHaveLength(2);

      // Thông báo AI_PROPOSAL_APPLIED cho thành viên (không phải người áp dụng); Lan còn có TASK_ASSIGNED
      await new Promise((r) => setTimeout(r, 300));
      const notif = await api()
        .get('/api/v1/notifications')
        .set(auth(minh))
        .expect(200);
      expect(
        notif.body.items.some(
          (n: { type: string }) => n.type === 'AI_PROPOSAL_APPLIED',
        ),
      ).toBe(true);
      const notifLan = await api()
        .get('/api/v1/notifications')
        .set(auth(lan))
        .expect(200);
      expect(
        notifLan.body.items.some(
          (n: { type: string }) => n.type === 'TASK_ASSIGNED',
        ),
      ).toBe(true);

      // Lặp cùng Idempotency-Key → kết quả cũ; không khoá → 409
      const again = await api()
        .post(`/api/v1/ai/proposals/${proposalId}/apply`)
        .set(auth(pm))
        .set('Idempotency-Key', 'k-1')
        .send({})
        .expect(201);
      expect(again.body).toMatchObject({
        idempotent: true,
        createdTaskIds: res.body.createdTaskIds,
      });
      const dup = await api()
        .post(`/api/v1/ai/proposals/${proposalId}/apply`)
        .set(auth(pm))
        .send({})
        .expect(409);
      expect(dup.body.code).toBe('PROPOSAL_ALREADY_APPLIED');
    });

    it('vòng phụ thuộc LLM không tự sửa → DRAFT có lỗi; áp dụng 422; PM sửa phụ thuộc → áp dụng được', async () => {
      const res = await api()
        .post(`/api/v1/projects/${projectId}/ai/decompose`)
        .set(auth(pm))
        .send({
          requirement: `${REQ} [[fake:cycle-persist]]`,
          sprintId: plannedSprintId,
        })
        .expect(200);
      expect(res.body.validation.ok).toBe(false);
      expect(
        res.body.validation.errors.map((e: { code: string }) => e.code),
      ).toContain('DEPENDENCY_CYCLE');
      expect(res.body.usage.attempts).toBe(2);
      const id = res.body.proposalId;
      const bad = await api()
        .post(`/api/v1/ai/proposals/${id}/apply`)
        .set(auth(pm))
        .send({})
        .expect(422);
      expect(bad.body.code).toBe('PROPOSAL_VALIDATION_FAILED');
      expect(bad.body.details.errors[0].code).toBe('DEPENDENCY_CYCLE');
      const ok = await api()
        .post(`/api/v1/ai/proposals/${id}/apply`)
        .set(auth(pm))
        .send({
          edits: {
            tasks: [
              { draftKey: 'd1', dependsOn: [] },
              { draftKey: 'd3', remove: true },
            ],
          },
        })
        .expect(201);
      expect(ok.body.createdTaskIds).toHaveLength(2);
    });

    it('mã lạ (u999/k999) → gọi lại một lần kèm lỗi, LLM tự sửa → ok với attempts = 2', async () => {
      const res = await api()
        .post(`/api/v1/projects/${projectId}/ai/decompose`)
        .set(auth(pm))
        .send({
          requirement: `${REQ} [[fake:unknown-code]]`,
          sprintId: plannedSprintId,
        })
        .expect(200);
      expect(res.body.validation.ok).toBe(true);
      expect(res.body.usage.attempts).toBe(2);
      // DRAFT cũ cùng (dự án, người, loại) bị EXPIRED — chỉ một DRAFT mở
      const drafts = await prisma.aiProposal.count({
        where: { projectId, userId: pm.id, kind: 'DECOMPOSE', status: 'DRAFT' },
      });
      expect(drafts).toBe(1);
    });

    it('mã lạ giữ nguyên sau khi gọi lại → DRAFT có lỗi UNKNOWN_CODE + ASSIGN_*', async () => {
      const res = await api()
        .post(`/api/v1/projects/${projectId}/ai/decompose`)
        .set(auth(pm))
        .send({ requirement: `${REQ} [[fake:unknown-code-persist]]` })
        .expect(200);
      expect(res.body.validation.ok).toBe(false);
      expect(
        res.body.validation.errors.map((e: { code: string }) => e.code),
      ).toContain('UNKNOWN_CODE');
    });

    it('giao 400 h cho một người → ASSIGN_CAPACITY_EXCEEDED kèm số giờ trống', async () => {
      const res = await api()
        .post(`/api/v1/projects/${projectId}/ai/decompose`)
        .set(auth(pm))
        .send({
          requirement: `${REQ} [[fake:overload-persist]]`,
          sprintId: plannedSprintId,
        })
        .expect(200);
      const e = res.body.validation.errors.find(
        (x: { code: string }) => x.code === 'ASSIGN_CAPACITY_EXCEEDED',
      );
      expect(e).toBeDefined();
      expect(e.data.addedHours).toBe(400);
      expect(e.data.freeHours).toBeLessThan(400);
    });

    it('yêu cầu mơ hồ → ASK_CLARIFICATION, không tạo đề xuất', async () => {
      const res = await api()
        .post(`/api/v1/projects/${projectId}/ai/decompose`)
        .set(auth(pm))
        .send({ requirement: `${REQ} [[fake:ask]]` })
        .expect(200);
      expect(res.body.proposalId).toBeNull();
      expect(res.body.action).toMatchObject({
        type: 'ASK_CLARIFICATION',
        options: [{ code: 'google' }, { code: 'email' }],
      });
    });

    it('JSON hỏng cả hai lần → 503 AI_RESPONSE_INVALID, log INVALID_OUTPUT có raw_response', async () => {
      const res = await api()
        .post(`/api/v1/projects/${projectId}/ai/decompose`)
        .set(auth(pm))
        .send({ requirement: `${REQ} [[fake:invalid-json-persist]]` })
        .expect(503);
      expect(res.body.code).toBe('AI_RESPONSE_INVALID');
      const log = await prisma.aiTokenLog.findFirst({
        where: { userId: pm.id, status: 'INVALID_OUTPUT' },
      });
      expect(log?.rawResponse).toContain('Xin lỗi');
    });

    it('từ chối đề xuất → REJECTED + ai_feedback; từ chối lần nữa 409', async () => {
      const res = await api()
        .post(`/api/v1/projects/${projectId}/ai/decompose`)
        .set(auth(pm))
        .send({ requirement: `${REQ} phiên bản để từ chối` })
        .expect(200);
      const id = res.body.proposalId;
      await api()
        .post(`/api/v1/ai/proposals/${id}/reject`)
        .set(auth(pm))
        .send({ reason: 'Quá chi tiết' })
        .expect(204);
      const row = await prisma.aiProposal.findUniqueOrThrow({ where: { id } });
      expect(row.status).toBe('REJECTED');
      const fb = await prisma.aiFeedback.findFirst({
        where: { proposalId: id },
      });
      expect(fb?.editKind).toBe('REJECTED');
      expect(fb?.final).toEqual({ reason: 'Quá chi tiết' });
      await api()
        .post(`/api/v1/ai/proposals/${id}/reject`)
        .set(auth(pm))
        .send({})
        .expect(409);
      await api()
        .post(`/api/v1/ai/proposals/${id}/apply`)
        .set(auth(pm))
        .send({})
        .expect(409);
    });
  });

  describe('Hạn mức & tính năng bật/tắt', () => {
    it('GET /ai/quota đếm lượt hôm nay; đặt limit = used → 429 kèm resetsAt; tắt EXPLAIN → 403', async () => {
      const q = await api()
        .get(`/api/v1/ai/quota?workspaceId=${wsId}`)
        .set(auth(pm))
        .expect(200);
      expect(q.body.limit).toBe(20);
      expect(q.body.used).toBeGreaterThan(0);
      await api()
        .patch(`/api/v1/workspaces/${wsId}/settings`)
        .set(auth(pm))
        .send({ ai: { dailyLimitPerUser: q.body.used } })
        .expect(200);
      const res = await api()
        .post(`/api/v1/projects/${projectId}/ai/decompose`)
        .set(auth(pm))
        .send({ requirement: `${REQ} lượt vượt hạn mức` })
        .expect(429);
      expect(res.body.code).toBe('AI_QUOTA_EXCEEDED');
      expect(res.body.details).toMatchObject({
        used: q.body.used,
        limit: q.body.used,
      });
      expect(res.body.details.resetsAt).toBeDefined();
      const quotaRow = await prisma.aiTokenLog.findFirst({
        where: { userId: pm.id, status: 'QUOTA' },
      });
      expect(quotaRow).not.toBeNull();
      // Dòng QUOTA không tính vào used
      const q2 = await api()
        .get(`/api/v1/ai/quota?workspaceId=${wsId}`)
        .set(auth(pm))
        .expect(200);
      expect(q2.body.used).toBe(q.body.used);

      await api()
        .patch(`/api/v1/workspaces/${wsId}/settings`)
        .set(auth(pm))
        .send({
          ai: {
            dailyLimitPerUser: 100,
            enabledPurposes: ['DECOMPOSE', 'ASSIGN', 'CHAT'],
          },
        })
        .expect(200);
      const off = await api()
        .post(`/api/v1/sprints/${activeSprintId}/forecast/explain`)
        .set(auth(pm))
        .expect(403);
      expect(off.body.code).toBe('AI_PURPOSE_DISABLED');
      await api()
        .patch(`/api/v1/workspaces/${wsId}/settings`)
        .set(auth(pm))
        .send({
          ai: { enabledPurposes: ['DECOMPOSE', 'ASSIGN', 'EXPLAIN', 'CHAT'] },
        })
        .expect(200);
    });
  });

  describe('Giải thích rủi ro (UC-31)', () => {
    it('mức và nguyên nhân từ backend, AI chỉ diễn giải; lần hai lấy từ cache 6 h', async () => {
      const fc = await api()
        .get(`/api/v1/sprints/${activeSprintId}/forecast`)
        .set(auth(pm))
        .expect(200);
      expect(
        fc.body.causes.some((c: { code: string }) => c.code === 'OVERDUE'),
      ).toBe(true);
      const res = await api()
        .post(`/api/v1/sprints/${activeSprintId}/forecast/explain`)
        .set(auth(pm))
        .expect(200);
      expect(res.body.action.type).toBe('RISK_EXPLANATION');
      expect(res.body.action.riskLevel).toBe(fc.body.riskLevel);
      expect(
        res.body.action.causes.map((c: { code: string }) => c.code),
      ).toContain('OVERDUE');
      expect(res.body.validation.ok).toBe(true);
      expect(res.body.cached).toBe(false);
      expect(res.body.forecast.riskLevel).toBe(fc.body.riskLevel);
      const again = await api()
        .post(`/api/v1/sprints/${activeSprintId}/forecast/explain`)
        .set(auth(pm))
        .expect(200);
      expect(again.body.cached).toBe(true);
      expect(again.body.cachedUntil).toBe(res.body.cachedUntil);
      await api()
        .post(`/api/v1/sprints/${activeSprintId}/forecast/explain`)
        .set(auth(lan))
        .expect(403);
    });
  });

  describe('Quản trị AI (UC-40, 32)', () => {
    let configId = '';

    it('danh mục model từ DB; sửa danh mục cần SYSTEM_ADMIN_EMAILS', async () => {
      const res = await api()
        .get('/api/v1/ai-config/models')
        .set(auth(pm))
        .expect(200);
      expect(res.body.map((m: { model: string }) => m.model)).toEqual(
        expect.arrayContaining(['gemini-2.5-flash', 'qwen2.5:7b']),
      );
      const gemini = res.body.find(
        (m: { model: string }) => m.model === 'gemini-2.5-flash',
      );
      expect(gemini).toMatchObject({
        provider: 'GEMINI',
        supportsStructuredOutput: true,
        cacheMode: 'GEMINI_CACHED_CONTENTS',
      });
      await api()
        .patch(`/api/v1/ai-config/models/${gemini.id}`)
        .set(auth(pm))
        .send({ inputPrice: 1 })
        .expect(403);
    });

    it('tạo cấu hình workspace: khoá mã hoá, không trả lại; MEMBER 403; một mặc định mỗi mục đích', async () => {
      const models = await api()
        .get('/api/v1/ai-config/models')
        .set(auth(pm))
        .expect(200);
      const qwen = models.body.find(
        (m: { model: string }) => m.model === 'qwen2.5:7b',
      );
      await api()
        .post(`/api/v1/workspaces/${wsId}/ai-configs`)
        .set(auth(lan))
        .send({ name: 'x', catalogId: qwen.id })
        .expect(403);
      const c1 = await api()
        .post(`/api/v1/workspaces/${wsId}/ai-configs`)
        .set(auth(pm))
        .send({
          name: 'Ollama cục bộ',
          catalogId: qwen.id,
          purpose: 'ASSIGN',
          apiKey: 'khoa-bi-mat-1234',
          baseUrl: 'http://127.0.0.1:1',
          timeoutMs: 1000,
          isDefault: true,
        })
        .expect(201);
      configId = c1.body.id;
      expect(c1.body).toMatchObject({
        purpose: 'ASSIGN',
        isDefault: true,
        hasApiKey: true,
        apiKeyMasked: '••••1234',
      });
      expect(c1.body).not.toHaveProperty('apiKeyEncrypted');
      const dbRow = await prisma.aiConfig.findUniqueOrThrow({
        where: { id: configId },
      });
      expect(dbRow.apiKeyEncrypted).not.toContain('khoa-bi-mat');
      expect(dbRow.apiKeyEncrypted!.split(':')).toHaveLength(3);

      const c2 = await api()
        .post(`/api/v1/workspaces/${wsId}/ai-configs`)
        .set(auth(pm))
        .send({
          name: 'Ollama 2',
          catalogId: qwen.id,
          purpose: 'ASSIGN',
          isDefault: true,
        })
        .expect(201);
      const list = await api()
        .get(`/api/v1/workspaces/${wsId}/ai-configs`)
        .set(auth(pm))
        .expect(200);
      expect(
        list.body
          .filter((c: { isDefault: boolean }) => c.isDefault)
          .map((c: { id: string }) => c.id),
      ).toEqual([c2.body.id]);

      // Bật cache cho model NONE → 422 (guard hợp nhà cung cấp)
      const bad = await api()
        .patch(`/api/v1/ai-configs/${configId}`)
        .set(auth(pm))
        .send({ advancedParams: { promptCache: { enabled: true } } })
        .expect(422);
      expect(bad.body.code).toBe('AI_CONFIG_INVALID');
      await api()
        .delete(`/api/v1/ai-configs/${c2.body.id}`)
        .set(auth(pm))
        .expect(204);
    });

    it('gọi thử cấu hình không kết nối được → { ok: false, error } và log ERROR', async () => {
      const res = await api()
        .post(`/api/v1/ai-configs/${configId}/test`)
        .set(auth(pm))
        .expect(200);
      expect(res.body.ok).toBe(false);
      expect(res.body.model).toBe('qwen2.5:7b');
      const log = await prisma.aiTokenLog.findFirst({
        where: { configId },
        orderBy: { createdAt: 'desc' },
      });
      expect(['ERROR', 'TIMEOUT']).toContain(log?.status);
    }, 20_000);

    it('prompt có phiên bản: MASTER chỉ đọc, WORKSPACE tăng version mỗi lần PUT', async () => {
      const master = await api()
        .get(`/api/v1/workspaces/${wsId}/ai-prompts/MASTER`)
        .set(auth(pm))
        .expect(200);
      expect(master.body).toMatchObject({ readOnly: true, version: 0 });
      expect(master.body.content).toContain('QUY TẮC TUYỆT ĐỐI');
      await api()
        .put(`/api/v1/workspaces/${wsId}/ai-prompts/MASTER`)
        .set(auth(pm))
        .send({ content: 'x' })
        .expect(403);
      const v1 = await api()
        .put(`/api/v1/workspaces/${wsId}/ai-prompts/WORKSPACE`)
        .set(auth(pm))
        .send({
          content: 'Sprint 2 tuần, không giao quá 90%.',
          changeNote: 'lần đầu',
        })
        .expect(200);
      expect(v1.body.version).toBe(1);
      const v2 = await api()
        .put(`/api/v1/workspaces/${wsId}/ai-prompts/WORKSPACE`)
        .set(auth(pm))
        .send({ content: 'Sprint 2 tuần.' })
        .expect(200);
      expect(v2.body.version).toBe(2);
      const cur = await api()
        .get(`/api/v1/workspaces/${wsId}/ai-prompts/WORKSPACE`)
        .set(auth(pm))
        .expect(200);
      expect(cur.body).toMatchObject({ version: 2, content: 'Sprint 2 tuần.' });
      // Lượt AI tiếp theo ghi workspace_prompt_version = 2
      await api()
        .post(`/api/v1/projects/${projectId}/ai/decompose`)
        .set(auth(pm))
        .send({ requirement: `${REQ} sau khi đổi prompt` })
        .expect(200);
      const log = await prisma.aiTokenLog.findFirst({
        where: { userId: pm.id, purpose: 'DECOMPOSE' },
        orderBy: { createdAt: 'desc' },
      });
      expect(log?.workspacePromptVersion).toBe(2);
    });

    it('sổ token theo mục đích/người/ngày', async () => {
      const byPurpose = await api()
        .get(`/api/v1/workspaces/${wsId}/ai-usage?groupBy=purpose`)
        .set(auth(pm))
        .expect(200);
      const dec = byPurpose.body.rows.find(
        (r: { key: string }) => r.key === 'DECOMPOSE',
      );
      expect(dec.calls).toBeGreaterThan(3);
      expect(byPurpose.body.totals.calls).toBeGreaterThan(dec.calls);
      expect(byPurpose.body.totals).toHaveProperty('costVnd');
      const byUser = await api()
        .get(`/api/v1/workspaces/${wsId}/ai-usage?groupBy=user`)
        .set(auth(pm))
        .expect(200);
      expect(byUser.body.rows[0].label).toBe('Phạm Quản Lý');
      await api()
        .get(`/api/v1/workspaces/${wsId}/ai-usage`)
        .set(auth(lan))
        .expect(403);
    });
  });
});
