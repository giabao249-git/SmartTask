import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AiMockQueue } from '../src/ai/provider/mock-provider';
import type { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, uniqueEmail } from './helpers';

/**
 * Phase 8 — chat theo phiên với bản nháp sửa nhiều lượt (docs 12), provider MOCK trả sẵn action:
 * decompose → "cái thứ hai đổi 6 giờ" → "bỏ d3" → duyệt d1,d2 → task tạo, proposal APPLIED, applied_map đúng;
 * mở lại GET /ai/sessions/:id; lượt chồng → 409; key phiên khác → UNKNOWN_DRAFT_KEY; sửa task thật; sửa tay + version;
 * quản trị danh tính (alias/chức danh/prompt workspace).
 */
describe('AI chat theo phiên (e2e)', () => {
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
  let sprintId = '';
  let sessionId = '';
  let proposalId = '';
  let lanCode = '';
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const plus = (base: Date, days: number) =>
    new Date(base.getTime() + days * 86_400_000);
  const monday = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    d.setUTCHours(0, 0, 0, 0);
    return d;
  })();
  /** Mã ngắn của một người/task đọc từ prompt lượt gần nhất (bảng `mã | …`). */
  const codeOf = (prefix: 'u' | 't', needle: string): string => {
    const text = AiMockQueue.lastPrompt?.userText ?? '';
    const m = new RegExp(`^(${prefix}\\d+) \\| [^\\n]*${needle}`, 'm').exec(
      text,
    );
    if (!m) throw new Error(`Không thấy ${needle} trong prompt`);
    return m[1];
  };
  const chat = (u: U, text: string, extra: Record<string, unknown> = {}) =>
    api()
      .post('/api/v1/ai/chat')
      .set(auth(u))
      .send({ projectId, sessionId: sessionId || undefined, text, ...extra });

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
      .send({ name: 'WS Phase 8' })
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
      .send({ key: 'CH', name: 'Dự án chat', pmUserId: pm.id })
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
    const sprint = await api()
      .post(`/api/v1/projects/${projectId}/sprints`)
      .set(auth(pm))
      .send({
        name: 'Sprint 2',
        startDate: iso(plus(monday, 7)),
        endDate: iso(plus(monday, 18)),
      })
      .expect(201);
    sprintId = sprint.body.id;
    // Danh tính: chức danh/phòng ban/quản lý + alias (admin)
    await api()
      .patch(`/api/v1/workspaces/${wsId}/members/${lan.id}/identity`)
      .set(auth(pm))
      .send({
        department: 'Phòng Phát triển',
        title: 'Frontend',
        managerUserId: pm.id,
      })
      .expect(200);
    await api()
      .post(`/api/v1/workspaces/${wsId}/member-aliases`)
      .set(auth(pm))
      .send({ userId: lan.id, alias: 'chị Lan' })
      .expect(201);
    AiMockQueue.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lượt 1 — phân rã qua chat: tạo phiên lười, key server d1..d3, proposal DRAFT, ngữ cảnh có DANH TÍNH + BẢN NHÁP', async () => {
    AiMockQueue.push((userText) => {
      const u = /^(u\d+) \| Nguyễn Thị Lan/m.exec(userText)![1];
      const k = /^(k\d+) \| /m.exec(userText)![1];
      return {
        type: 'DECOMPOSE_PROPOSAL',
        reply: 'Đề xuất 3 việc.',
        sprint: /Sprint đang chọn trên giao diện: (s\d+)/.exec(userText)?.[1],
        tasks: [
          {
            draftKey: 'd1',
            title: 'Thiết kế schema',
            estimateHours: 8,
            requiredSkills: [{ skill: k, minLevel: 2 }],
            suggestedAssignee: u,
          },
          {
            draftKey: 'd2',
            title: 'API đăng nhập',
            estimateHours: 4,
            dependsOn: ['d1'],
          },
          {
            draftKey: 'd3',
            title: 'Kiểm thử',
            estimateHours: 3,
            dependsOn: ['d2'],
          },
        ],
      };
    });
    const res = await chat(minh, 'Phân rã yêu cầu đăng nhập bằng email', {
      sprintId,
    }).expect(200);
    sessionId = res.body.sessionId;
    lanCode = codeOf('u', 'Nguyễn Thị Lan');
    expect(res.body.action.type).toBe('DECOMPOSE_PROPOSAL');
    expect(
      res.body.action.tasks.map((t: { draftKey: string }) => t.draftKey),
    ).toEqual(['d1', 'd2', 'd3']);
    expect(res.body.validation.ok).toBe(true);
    expect(res.body.proposals).toHaveLength(1);
    proposalId = res.body.proposals[0].id;
    expect(res.body.proposals[0]).toMatchObject({
      kind: 'DECOMPOSE',
      status: 'DRAFT',
      version: 1,
      sessionId,
    });
    expect(
      res.body.proposals[0].items.map((i: { status: string }) => i.status),
    ).toEqual(['DRAFT', 'DRAFT', 'DRAFT']);
    expect(res.body.proposals[0].codeMap.drafts).toEqual({
      d1: 'd1',
      d2: 'd2',
      d3: 'd3',
    });
    const prompt = AiMockQueue.lastPrompt!.userText;
    expect(prompt).toContain('DANH TÍNH');
    expect(prompt).toContain('"chị Lan"');
    expect(prompt).toContain('Frontend | Phòng Phát triển');
    expect(prompt).toContain('BẢN NHÁP ĐANG MỞ TRONG PHIÊN');
    expect(prompt).toContain('next = d1');
    expect(AiMockQueue.lastPrompt!.system).toContain('tên gần giống');
    const session = await prisma.chatSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    expect(session).toMatchObject({
      userId: minh.id,
      projectId,
      nextDraftSeq: 4,
    });
    expect(session.title).toContain('Phân rã');
    expect(await prisma.chatMessage.count({ where: { sessionId } })).toBe(2);
  });

  it('lượt 2 — "cái thứ hai đổi 6 giờ, giao Lan": vá vào d2 của proposal đang mở, version +1, không tạo dòng mới', async () => {
    AiMockQueue.push({
      type: 'UPDATE_TASK_DRAFT',
      reply: 'Đã sửa d2.',
      targetDraftKeys: ['d2'],
      patch: { estimateHours: 6, suggestedAssignee: lanCode },
      resolutionReason: 'cái thứ hai = d2',
    });
    const res = await chat(minh, 'cái thứ hai đổi 6 giờ, giao Lan').expect(200);
    expect(res.body.action.type).toBe('UPDATE_TASK_DRAFT');
    expect(res.body.validation.ok).toBe(true);
    expect(res.body.proposals).toHaveLength(1);
    const p = res.body.proposals[0];
    expect(p.version).toBe(2);
    expect(p.items[1]).toMatchObject({
      draftKey: 'd2',
      estimateHours: 6,
      assignee: lanCode,
      status: 'DRAFT',
    });
    expect(p.items[0]).toMatchObject({ draftKey: 'd1', estimateHours: 8 });
    const prompt = AiMockQueue.lastPrompt!.userText;
    expect(prompt).toMatch(
      /\[p1 · DECOMPOSE · DRAFT · version 1\] d1 Thiết kế schema/,
    );
    expect(prompt).toContain('next = d4');
    expect(prompt).toContain('LỊCH SỬ PHIÊN');
    expect(prompt).toContain('"type":"DECOMPOSE_PROPOSAL"');
  });

  it('lượt 3 — "bỏ d3": item DISCARDED, proposal vẫn DRAFT, feedback REJECTED', async () => {
    AiMockQueue.push({
      type: 'DISCARD_DRAFT',
      reply: 'Đã bỏ d3.',
      targetDraftKeys: ['d3'],
    });
    const res = await chat(minh, 'bỏ cái thứ ba').expect(200);
    const p = res.body.proposals[0];
    expect(p.status).toBe('DRAFT');
    expect(p.itemStatus).toEqual({ d1: 'DRAFT', d2: 'DRAFT', d3: 'DISCARDED' });
    expect(p.version).toBe(3);
    const fb = await prisma.aiFeedback.findMany({ where: { proposalId } });
    expect(fb.map((f) => f.editKind)).toEqual(['REJECTED']);
  });

  it('key không thuộc phiên (d9) → UNKNOWN_DRAFT_KEY cả sau khi LLM được gọi lại; nháp không đổi', async () => {
    AiMockQueue.push(
      {
        type: 'UPDATE_TASK_DRAFT',
        reply: 'sửa d9',
        targetDraftKeys: ['d9'],
        patch: { estimateHours: 1 },
      },
      {
        type: 'UPDATE_TASK_DRAFT',
        reply: 'vẫn d9',
        targetDraftKeys: ['d9'],
        patch: { estimateHours: 1 },
      },
    );
    const res = await chat(minh, 'd9 đổi 1 giờ').expect(200);
    expect(res.body.validation.ok).toBe(false);
    expect(res.body.validation.errors[0].code).toBe('UNKNOWN_DRAFT_KEY');
    expect(res.body.usage.attempts).toBe(2);
    expect(AiMockQueue.lastPrompt!.userText).toContain(
      'LỖI KIỂM TRA LƯỢT TRƯỚC',
    );
    expect(res.body.proposals[0].version).toBe(3);
    expect(AiMockQueue.size()).toBe(0);
  });

  it('hai lượt chồng nhau trong cùng phiên → lượt sau 409 AI_TURN_IN_PROGRESS', async () => {
    AiMockQueue.push(async () => {
      await new Promise((r) => setTimeout(r, 400));
      return { type: 'CHAT_RESPONSE', reply: 'chậm' };
    });
    const first = chat(minh, 'lượt chậm').then((r) => r); // supertest chỉ gửi khi được await/then
    await new Promise((r) => setTimeout(r, 100));
    const second = await chat(minh, 'lượt chen ngang').expect(409);
    expect(second.body.code).toBe('AI_TURN_IN_PROGRESS');
    const ok = await first;
    expect(ok.status).toBe(200);
    expect(ok.body.action.type).toBe('CHAT_RESPONSE');
    expect(ok.body.proposals).toHaveLength(1);
  });

  it('"duyệt đi" → CHAT_RESPONSE suggestApply, KHÔNG tạo task', async () => {
    AiMockQueue.push({
      type: 'CHAT_RESPONSE',
      reply: 'Bấm Duyệt trên panel nhé.',
      suggestApply: true,
    });
    const before = await prisma.task.count({ where: { projectId } });
    const res = await chat(minh, 'ok duyệt đi').expect(200);
    expect(res.body.action).toMatchObject({
      type: 'CHAT_RESPONSE',
      suggestApply: true,
    });
    expect(await prisma.task.count({ where: { projectId } })).toBe(before);
  });

  it('duyệt d1,d2 kèm version: sai version → 409; đúng → task tạo, applied_map, proposal APPLIED, feedback', async () => {
    const wrong = await api()
      .post(`/api/v1/ai/proposals/${proposalId}/apply`)
      .set(auth(minh))
      .send({ draftKeys: ['d1', 'd2'], version: 1 })
      .expect(409);
    expect(wrong.body.code).toBe('PROPOSAL_VERSION_CONFLICT');
    const res = await api()
      .post(`/api/v1/ai/proposals/${proposalId}/apply`)
      .set(auth(minh))
      .send({ draftKeys: ['d1', 'd2'], version: 3 })
      .expect(201);
    expect(
      res.body.createdTasks.map((t: { draftKey: string }) => t.draftKey),
    ).toEqual(['d1', 'd2']);
    expect(res.body.proposal).toMatchObject({
      status: 'APPLIED',
      version: 4,
      itemStatus: { d1: 'APPLIED', d2: 'APPLIED', d3: 'DISCARDED' },
    });
    const map = res.body.proposal.appliedMap;
    expect(Object.keys(map).sort()).toEqual(['d1', 'd2']);
    const t1 = await prisma.task.findUniqueOrThrow({
      where: { id: map.d1 },
      include: { assignees: true },
    });
    const t2 = await prisma.task.findUniqueOrThrow({
      where: { id: map.d2 },
      include: { assignees: true, dependsOn: true },
    });
    expect(t1).toMatchObject({
      source: 'AI',
      aiProposalId: proposalId,
      sprintId,
    });
    expect(Number(t2.estimateHours)).toBe(6);
    expect(t2.assignees.map((a) => a.userId)).toEqual([lan.id]);
    expect(t2.dependsOn.map((d) => d.dependsOnId)).toEqual([map.d1]);
    const fb = await prisma.aiFeedback.findMany({
      where: { proposalId },
      orderBy: { createdAt: 'asc' },
    });
    expect(fb.map((f) => f.editKind).sort()).toEqual([
      'ACCEPTED',
      'CHANGED_USER',
      'REJECTED',
    ]);
    // duyệt lại item đã APPLIED → 409
    const again = await api()
      .post(`/api/v1/ai/proposals/${proposalId}/apply`)
      .set(auth(minh))
      .send({ draftKeys: ['d1'], version: 4 })
      .expect(409);
    expect(again.body.code).toBe('PROPOSAL_ALREADY_APPLIED');
  });

  it('mở lại phiên: GET /ai/sessions/:id trả session + messages + proposals đủ; người khác 404', async () => {
    const res = await api()
      .get(`/api/v1/ai/sessions/${sessionId}`)
      .set(auth(minh))
      .expect(200);
    expect(res.body.session).toMatchObject({ id: sessionId, nextDraftSeq: 4 });
    expect(res.body.messages.length).toBe(12);
    expect(res.body.messages[1]).toMatchObject({
      role: 'ASSISTANT',
      structuredData: { type: 'DECOMPOSE_PROPOSAL' },
    });
    expect(res.body.proposals).toHaveLength(1);
    expect(
      res.body.proposals[0].items.map(
        (i: { status: string; taskId: string | null }) => [
          i.status,
          !!i.taskId,
        ],
      ),
    ).toEqual([
      ['APPLIED', true],
      ['APPLIED', true],
      ['DISCARDED', false],
    ]);
    await api()
      .get(`/api/v1/ai/sessions/${sessionId}`)
      .set(auth(lan))
      .expect(404);
    const list = await api()
      .get(`/api/v1/ai/sessions?projectId=${projectId}`)
      .set(auth(minh))
      .expect(200);
    expect(list.body[0]).toMatchObject({
      id: sessionId,
      openDrafts: 0,
      messageCount: 12,
    });
  });

  it('sửa item đã duyệt qua chat → DRAFT_ALREADY_APPLIED; sửa TASK THẬT → proposal TASK_UPDATE d4, duyệt → hạn đổi', async () => {
    AiMockQueue.push(
      {
        type: 'UPDATE_TASK_DRAFT',
        reply: 'sửa d1',
        targetDraftKeys: ['d1'],
        patch: { estimateHours: 9 },
      },
      {
        type: 'UPDATE_TASK_DRAFT',
        reply: 'sửa d1',
        targetDraftKeys: ['d1'],
        patch: { estimateHours: 9 },
      },
    );
    const bad = await chat(minh, 'd1 đổi 9 giờ').expect(200);
    expect(bad.body.validation.errors[0].code).toBe('DRAFT_ALREADY_APPLIED');

    const due = iso(plus(monday, 17));
    AiMockQueue.push((userText) => ({
      type: 'UPDATE_TASK_DRAFT',
      reply: 'Đề xuất dời hạn.',
      targetTask: /^(t\d+) \| CH-\d+ \| API đăng nhập/m.exec(userText)![1],
      patch: { due },
      resolutionReason: 'task thật đã tạo từ d2',
    }));
    const res = await chat(minh, `dời hạn API đăng nhập sang ${due}`).expect(
      200,
    );
    expect(res.body.action.type).toBe('UPDATE_TASK_DRAFT');
    expect(res.body.action.draftKey).toBe('d4');
    expect(res.body.validation.ok).toBe(true);
    expect(res.body.proposals).toHaveLength(2);
    const upd = res.body.proposals[1];
    expect(upd).toMatchObject({
      kind: 'TASK_UPDATE',
      status: 'DRAFT',
      itemStatus: { d4: 'DRAFT' },
    });
    const before = await prisma.task.count({ where: { projectId } });
    const applied = await api()
      .post(`/api/v1/ai/proposals/${upd.id}/apply`)
      .set(auth(minh))
      .send({ version: upd.version })
      .expect(201);
    expect(applied.body.proposal.status).toBe('APPLIED');
    const task = await prisma.task.findUniqueOrThrow({
      where: { id: applied.body.proposal.appliedMap.d4 },
    });
    expect(iso(task.dueDate!)).toBe(due);
    expect(task.version).toBe(2);
    expect(await prisma.task.count({ where: { projectId } })).toBe(before);
  });

  it('sửa tay trên panel (PATCH items/:draftKey) kèm version; ASK_CLARIFICATION → selectedCode ở lượt sau; từ chối một phần', async () => {
    AiMockQueue.push({
      type: 'CREATE_TASK_DRAFT',
      reply: '2 task cho màn đăng ký.',
      drafts: [
        { draftKey: 'd1', title: 'Form đăng ký', estimateHours: 5 },
        {
          draftKey: 'd2',
          title: 'Email xác nhận',
          estimateHours: 3,
          dependsOn: ['d1'],
        },
      ],
    });
    const res = await chat(minh, 'tạo 2 task cho màn đăng ký').expect(200);
    const p = res.body.proposals[2];
    expect(p).toMatchObject({
      kind: 'TASK_DRAFT',
      itemStatus: { d5: 'DRAFT', d6: 'DRAFT' },
    });
    expect(p.items[1].dependsOn).toEqual(['d5']);

    const conflict = await api()
      .patch(`/api/v1/ai/proposals/${p.id}/items/d5`)
      .set(auth(minh))
      .send({ patch: { estimateHours: 7 }, version: 99 })
      .expect(409);
    expect(conflict.body.code).toBe('PROPOSAL_VERSION_CONFLICT');
    const edited = await api()
      .patch(`/api/v1/ai/proposals/${p.id}/items/d5`)
      .set(auth(minh))
      .send({
        patch: {
          estimateHours: 7,
          suggestedAssignee: lanCode,
          due: iso(plus(monday, 16)),
        },
        version: p.version,
      })
      .expect(200);
    expect(edited.body.version).toBe(p.version + 1);
    expect(edited.body.items[0]).toMatchObject({
      estimateHours: 7,
      assignee: lanCode,
      edited: true,
    });
    await api()
      .patch(`/api/v1/ai/proposals/${p.id}/items/d9`)
      .set(auth(minh))
      .send({ patch: { estimateHours: 1 }, version: edited.body.version })
      .expect(422);

    AiMockQueue.push({
      type: 'ASK_CLARIFICATION',
      reply: 'Giao cho ai?',
      question: 'Bạn muốn giao d6 cho ai?',
      options: [{ code: lanCode, label: 'Lan · Frontend' }],
    });
    const ask = await chat(minh, 'giao cái email cho Bảo').expect(200);
    expect(ask.body.action.type).toBe('ASK_CLARIFICATION');
    expect(ask.body.proposals).toHaveLength(3);
    AiMockQueue.push((userText) => {
      expect(userText).toContain(`Người dùng vừa chọn phương án: ${lanCode}`);
      return {
        type: 'UPDATE_TASK_DRAFT',
        reply: 'Giao d6 cho Lan.',
        targetDraftKeys: ['d6'],
        patch: { suggestedAssignee: lanCode },
      };
    });
    const picked = await chat(minh, 'Lan', { selectedCode: lanCode }).expect(
      200,
    );
    expect(picked.body.proposals[2].items[1]).toMatchObject({
      draftKey: 'd6',
      assignee: lanCode,
    });

    const rejected = await api()
      .post(`/api/v1/ai/proposals/${p.id}/reject`)
      .set(auth(minh))
      .send({ draftKeys: ['d6'] })
      .expect(204);
    void rejected;
    const after = await api()
      .get(`/api/v1/ai/sessions/${sessionId}/proposals`)
      .set(auth(minh))
      .expect(200);
    expect(after.body[2].itemStatus).toEqual({ d5: 'DRAFT', d6: 'DISCARDED' });
    expect(after.body[2].status).toBe('DRAFT');
  });

  it('phiên: đổi tên, lưu trữ (chat → 409), mở lại, xoá → DRAFT còn lại REJECTED, task đã tạo giữ nguyên', async () => {
    const renamed = await api()
      .patch(`/api/v1/ai/sessions/${sessionId}`)
      .set(auth(minh))
      .send({ title: 'Đăng nhập & đăng ký' })
      .expect(200);
    expect(renamed.body.title).toBe('Đăng nhập & đăng ký');
    await api()
      .patch(`/api/v1/ai/sessions/${sessionId}`)
      .set(auth(minh))
      .send({ archived: true })
      .expect(200);
    await chat(minh, 'còn nói được không').expect(409);
    const hidden = await api()
      .get(`/api/v1/ai/sessions?projectId=${projectId}`)
      .set(auth(minh))
      .expect(200);
    expect(hidden.body).toHaveLength(0);
    await api()
      .patch(`/api/v1/ai/sessions/${sessionId}`)
      .set(auth(minh))
      .send({ archived: false })
      .expect(200);
    const tasksBefore = await prisma.task.count({
      where: { projectId, deletedAt: null },
    });
    await api()
      .delete(`/api/v1/ai/sessions/${sessionId}`)
      .set(auth(minh))
      .expect(204);
    const rows = await prisma.aiProposal.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
    expect(rows.map((r) => [r.status, r.sessionId])).toEqual([
      ['APPLIED', null],
      ['APPLIED', null],
      ['REJECTED', null],
    ]);
    expect(
      await prisma.task.count({ where: { projectId, deletedAt: null } }),
    ).toBe(tasksBefore);
  });

  it('quản trị danh tính: alias trùng 409 (citext), xoá alias, quản lý là chính mình 422, prompt workspace có phiên bản', async () => {
    const dup = await api()
      .post(`/api/v1/workspaces/${wsId}/member-aliases`)
      .set(auth(pm))
      .send({ userId: lan.id, alias: 'CHỊ LAN' })
      .expect(409);
    expect(dup.body.code).toBe('CONFLICT');
    await api()
      .post(`/api/v1/workspaces/${wsId}/member-aliases`)
      .set(auth(lan))
      .send({ userId: lan.id, alias: 'Lan FE' })
      .expect(403);
    const list = await api()
      .get(`/api/v1/workspaces/${wsId}/member-aliases`)
      .set(auth(lan))
      .expect(200);
    expect(list.body).toHaveLength(1);
    await api()
      .delete(`/api/v1/workspaces/${wsId}/member-aliases/${list.body[0].id}`)
      .set(auth(pm))
      .expect(204);
    await api()
      .patch(`/api/v1/workspaces/${wsId}/members/${lan.id}/identity`)
      .set(auth(pm))
      .send({ managerUserId: lan.id })
      .expect(422);
    const v1 = await api()
      .put(`/api/v1/workspaces/${wsId}/ai/prompt`)
      .set(auth(pm))
      .send({
        content:
          'Khi trùng tên, ưu tiên người cùng phòng ban với người đang chat.',
      })
      .expect(200);
    expect(v1.body.version).toBeGreaterThanOrEqual(1);
    const cur = await api()
      .get(`/api/v1/workspaces/${wsId}/ai/prompt`)
      .set(auth(pm))
      .expect(200);
    expect(cur.body.content).toContain('cùng phòng ban');
    AiMockQueue.push({ type: 'CHAT_RESPONSE', reply: 'ok' });
    sessionId = '';
    await chat(minh, 'xin chào').expect(200);
    expect(AiMockQueue.lastPrompt!.system).toContain('cùng phòng ban');
  });
  // Hình dạng thật lấy từ ai_token_logs ngày 25/09/2026 (Gemini structured output phẳng).
  // Phiên riêng để không phụ thuộc trạng thái các lượt trên.
  describe('đầu ra méo của model vẫn dùng được', () => {
    let sid = '';
    const say = (text: string) =>
      api()
        .post('/api/v1/ai/chat')
        .set(auth(minh))
        .send({ projectId, sessionId: sid, text });

    beforeAll(async () => {
      const s = await api()
        .post('/api/v1/ai/sessions')
        .set(auth(minh))
        .send({ projectId, title: 'đầu ra méo' })
        .expect(201);
      sid = s.body.id;
      AiMockQueue.push({
        type: 'DECOMPOSE_PROPOSAL',
        reply: 'Hai việc.',
        tasks: [
          { draftKey: 'd1', title: 'Thiết kế schema', estimateHours: 8 },
          { draftKey: 'd2', title: 'API đăng nhập', estimateHours: 6 },
        ],
      });
      await say('phân rã đăng nhập').expect(200);
    });

    it('targetTask rỗng + draftKey nhét nhầm + patch nằm trong tasks[] → vẫn vá đúng d2', async () => {
      AiMockQueue.push({
        type: 'UPDATE_TASK_DRAFT',
        reply: 'Đã cập nhật d2.',
        targetDraftKeys: ['d2'],
        targetTask: 'd2',
        tasks: [
          {
            draftKey: 'd2',
            title: 'API đăng nhập',
            estimateHours: 9,
            difficulty: 2,
          },
        ],
        warnings: [],
      });
      const res = await say('d2 đổi 9 giờ, độ khó 2').expect(200);
      expect(res.body.action.type).toBe('UPDATE_TASK_DRAFT');
      expect(res.body.validation.ok).toBe(true);
      expect(res.body.usage.attempts).toBe(1); // không phải gọi lại model
      expect(res.body.proposals[0].items[1]).toMatchObject({
        draftKey: 'd2',
        estimateHours: 9,
        status: 'DRAFT',
      });
    });

    it('không có gì để sửa (model trả lời câu hỏi) → CHAT_RESPONSE, nháp giữ nguyên', async () => {
      const before = await prisma.aiProposal.findFirstOrThrow({
        where: { sessionId: sid },
        select: { id: true, version: true },
      });
      AiMockQueue.push({
        type: 'UPDATE_TASK_DRAFT',
        reply: 'Lan phù hợp nhất cho việc này.',
        targetDraftKeys: ['d2'],
        targetTask: '',
        tasks: [],
        warnings: [],
      });
      const res = await say('ai có thể làm d2?').expect(200);
      expect(res.body.action).toMatchObject({
        type: 'CHAT_RESPONSE',
        reply: 'Lan phù hợp nhất cho việc này.',
      });
      expect(res.body.action.parseFailed).toBeUndefined();
      expect(res.body.usage.attempts).toBe(1);
      const after = await prisma.aiProposal.findUniqueOrThrow({
        where: { id: before.id },
        select: { version: true },
      });
      expect(after.version).toBe(before.version);
    });

    it('thiếu patch mà reply nói "Đã cập nhật" → gọi lại 1 lần; vẫn thiếu → trả lời thật "chưa thay đổi gì"', async () => {
      const lie = {
        type: 'UPDATE_TASK_DRAFT',
        reply: 'Đã cập nhật d2 với độ khó 4.',
        targetDraftKeys: ['d2'],
        warnings: [],
      };
      AiMockQueue.push(lie, lie);
      const res = await say('cái thứ hai đổi 8 giờ và độ khó 4').expect(200);
      expect(res.body.action.type).toBe('CHAT_RESPONSE');
      expect(res.body.action.reply).toMatch(/^Mình chưa thay đổi gì/);
      expect(res.body.usage.attempts).toBe(2);
    });
  });

  it('tra cứu: "Làm mới" giải được mã của phiên chỉ có tra cứu; mã sprint không đổi khi có sprint mới hay sprint bị đóng', async () => {
    const sprintCode = (text: string, name: string) =>
      new RegExp(`^(s\\d+) \\| ${name} \\|`, 'm').exec(text)?.[1];
    const ask = () =>
      api()
        .post('/api/v1/ai/chat')
        .set(auth(pm))
        .send({ projectId, text: 'Sprint 2 tiến độ thế nào?' });
    const dataQuery = (userText: string) => ({
      type: 'DATA_QUERY',
      reply: 'Đây là tiến độ Sprint 2.',
      query: {
        intent: 'SPRINT_PROGRESS',
        sprint: sprintCode(userText, 'Sprint 2'),
      },
    });

    AiMockQueue.push(dataQuery);
    const first = await ask().expect(200);
    const code = sprintCode(AiMockQueue.lastPrompt!.userText, 'Sprint 2')!;
    expect(first.body.action.type).toBe('DATA_QUERY');
    expect(code).toMatch(/^s\d+$/);
    expect(first.body.action.query.sprint).toBe(code);
    expect(first.body.proposals).toHaveLength(0); // tra cứu không sinh proposal
    const refresh = (extra: Record<string, unknown>) =>
      api()
        .post('/api/v1/ai/query')
        .set(auth(pm))
        .send({
          projectId,
          sessionId: first.body.sessionId,
          query: first.body.action.query,
          ...extra,
        });
    // Trước đây: 422 UNKNOWN_CODE vì bảng mã chỉ nằm trong ai_proposals
    await refresh({ messageId: first.body.message.id }).expect(200);
    await refresh({}).expect(200);

    // Sprint tạo sau nhưng bắt đầu sớm hơn, rồi bắt đầu + đóng nó: mã của Sprint 2 vẫn như cũ
    const old = await api()
      .post(`/api/v1/projects/${projectId}/sprints`)
      .set(auth(pm))
      .send({
        name: 'Sprint cũ',
        startDate: iso(plus(monday, -14)),
        endDate: iso(plus(monday, -3)),
      })
      .expect(201);
    await api()
      .post(`/api/v1/sprints/${old.body.id}/start`)
      .set(auth(pm))
      .expect(201);
    await api()
      .post(`/api/v1/sprints/${old.body.id}/close`)
      .set(auth(pm))
      .send({ moveOpenTo: 'backlog' })
      .expect(201);
    AiMockQueue.push(dataQuery);
    await ask().expect(200);
    const prompt = AiMockQueue.lastPrompt!.userText;
    expect(sprintCode(prompt, 'Sprint 2')).toBe(code);
    expect(sprintCode(prompt, 'Sprint cũ')).toBeDefined(); // hỏi được "sprint trước"
    expect(prompt).toMatch(/Sprint cũ \| CLOSED/);
  });

  it('rủi ro trong chat: mức do LLM tự chọn lệch số backend bị từ chối (cả lần gọi lại); chép đúng thì qua', async () => {
    const levelIn = (text: string) =>
      /MỨC RỦI RO SPRINT[^\n]*\n[^\n]*mức rủi ro (\w+)/.exec(text)?.[1];
    const explain = (riskLevel: string) => ({
      type: 'RISK_EXPLANATION',
      reply: 'Sprint đang chậm vì còn việc chưa giao.',
      riskLevel,
      causes: [],
      recommendations: ['Giao nốt việc chưa có người'],
    });
    const ask = (extra: Record<string, unknown> = {}) =>
      api()
        .post('/api/v1/ai/chat')
        .set(auth(pm))
        .send({ projectId, text: 'Vì sao sprint này rủi ro?', ...extra });

    // LLM cứ khăng khăng "LOW" → hai lần đều bị kiểm, mức lưu kèm tin là "chưa khớp"
    AiMockQueue.push(
      (t) => explain(levelIn(t) === 'LOW' ? 'HIGH' : 'LOW'),
      (t) => explain(levelIn(t) === 'LOW' ? 'HIGH' : 'LOW'),
    );
    const bad = await ask({ sprintId }).expect(200);
    const expected = levelIn(AiMockQueue.lastPrompt!.userText);
    expect(expected).toBeDefined(); // ngữ cảnh CHAT có số rủi ro của backend
    expect(bad.body.validation.ok).toBe(false);
    expect(bad.body.validation.errors[0]).toMatchObject({
      code: 'AI_RESPONSE_INVALID',
      data: { expected },
    });
    expect(bad.body.usage.attempts).toBe(2);
    const stored = await prisma.chatMessage.findUniqueOrThrow({
      where: { id: bad.body.message.id },
      select: { structuredData: true },
    });
    expect(
      (stored.structuredData as { validation: { ok: boolean } }).validation.ok,
    ).toBe(false);

    // Chép đúng mức trong ngữ cảnh → qua ngay lần đầu
    AiMockQueue.push((t) => explain(levelIn(t)!));
    const good = await ask({
      sprintId,
      sessionId: bad.body.sessionId,
    }).expect(200);
    expect(good.body.validation.ok).toBe(true);
    expect(good.body.usage.attempts).toBe(1);
  });

  it('TASK_DETAIL qua chat: mã t thật trong prompt → thẻ việc đúng task', async () => {
    let code = '';
    AiMockQueue.push((userText) => {
      code = /^(t\d+) \| [^\n]*API đăng nhập/m.exec(userText)?.[1] ?? '';
      return {
        type: 'DATA_QUERY',
        reply: 'Đây là tình trạng việc đó.',
        query: { intent: 'TASK_DETAIL', filters: { task: code } },
      };
    });
    const res = await api()
      .post('/api/v1/ai/chat')
      .set(auth(pm))
      .send({ projectId, text: 'việc API đăng nhập đang thế nào?' })
      .expect(200);
    expect(code).toMatch(/^t\d+$/);
    const msg = await prisma.chatMessage.findUniqueOrThrow({
      where: { id: res.body.message.id },
      select: { structuredData: true },
    });
    const qr = (
      msg.structuredData as {
        queryResult: { blocks: { kind: string; item?: { title: string } }[] };
      }
    ).queryResult;
    expect(qr.blocks[0].kind).toBe('person_card');
    expect(qr.blocks[0].item!.title).toContain('API đăng nhập');
  });
});
