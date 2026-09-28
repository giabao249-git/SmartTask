import type { DecomposeProposal } from '@smarttask/shared';
import { decomposeProposalSchema } from '@smarttask/shared';
import { CodeBook } from '../context/short-codes';
import { ActionValidatorService } from './action-validator.service';
import { boDau, findCycle, topoOrder } from './graph';

/**
 * Validator kiểm trên "dữ liệu sống" — ở đây Prisma/Workload được mock để dựng đúng tình huống cho 7 mã lỗi
 * (docs 11 §5): UNKNOWN_CODE, ASSIGN_NOT_MEMBER, ASSIGN_ON_LEAVE, ASSIGN_SKILL_GAP, ASSIGN_CAPACITY_EXCEEDED,
 * ASSIGN_OVERLOAD, DEPENDENCY_CYCLE. Quy tắc: chỉ báo, không sửa.
 */
const U_LAN = '11111111-1111-4111-8111-111111111111';
const U_MINH = '22222222-2222-4222-8222-222222222222';
const U_OUT = '33333333-3333-4333-8333-333333333333';
const K_REACT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const K_NEST = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const S1 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const PROJECT = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const WS = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

function codes(): CodeBook {
  const c = new CodeBook();
  c.assign('u', U_LAN); // u1
  c.assign('u', U_MINH); // u2
  c.assign('u', U_OUT); // u3 (đã rời dự án)
  c.assign('k', K_REACT); // k1
  c.assign('k', K_NEST); // k2
  c.assign('s', S1); // s1
  return c;
}

const today = new Date('2026-10-12T00:00:00Z');
const sprint = {
  id: S1,
  startDate: new Date('2026-10-13'),
  endDate: new Date('2026-10-24'),
};

function makeService(opts: {
  offs?: { userId: string; fromDate: Date; toDate: Date }[];
  freeHours?: Record<string, number>;
  effLoad?: Record<string, number>;
  effCap?: number;
}) {
  const prisma = {
    sprint: { findFirst: jest.fn().mockResolvedValue(sprint) },
    projectMember: {
      findMany: jest.fn().mockResolvedValue([
        {
          userId: U_LAN,
          user: {
            fullName: 'Lan',
            userSkills: [
              { skillId: K_REACT, level: 4 },
              { skillId: K_NEST, level: 1 },
            ],
          },
        },
        {
          userId: U_MINH,
          user: {
            fullName: 'Minh',
            userSkills: [{ skillId: K_NEST, level: 3 }],
          },
        },
      ]),
    },
    skill: {
      findMany: jest.fn().mockResolvedValue([
        { id: K_REACT, name: 'React', aliases: [{ alias: 'ReactJS' }] },
        { id: K_NEST, name: 'NestJS', aliases: [] },
      ]),
    },
    userTimeOff: { findMany: jest.fn().mockResolvedValue(opts.offs ?? []) },
    workspace: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ settings: {} }),
    },
  };
  const cap = opts.effCap ?? 34;
  const workload = {
    computeUsers: jest.fn().mockResolvedValue({
      users: [U_LAN, U_MINH].map((id) => ({
        userId: id,
        weeks: [
          { effLoadHours: opts.effLoad?.[id] ?? 10, effCapacityHours: cap },
          { effLoadHours: 0, effCapacityHours: cap },
        ],
      })),
    }),
    freeByDay: jest
      .fn()
      .mockImplementation((_ws: string, userId: string) =>
        Promise.resolve([{ freeHours: opts.freeHours?.[userId] ?? 40 }]),
      ),
  };
  return new ActionValidatorService(prisma as never, workload as never);
}

function proposal(
  over: Partial<DecomposeProposal['tasks'][number]>[] = [],
  sprintCode = 's1',
): DecomposeProposal {
  const base = [
    {
      draftKey: 'd1',
      title: 'UI',
      estimateHours: 8,
      requiredSkills: [{ skill: 'k1', minLevel: 3 }],
      suggestedAssignee: 'u1',
    },
    {
      draftKey: 'd2',
      title: 'API',
      estimateHours: 6,
      requiredSkills: [{ skill: 'k2', minLevel: 2 }],
      dependsOn: ['d1'],
      suggestedAssignee: 'u2',
    },
  ];
  const tasks = base.map((t, i) => ({ ...t, ...(over[i] ?? {}) }));
  return decomposeProposalSchema.parse({
    type: 'DECOMPOSE_PROPOSAL',
    reply: 'ok',
    sprint: sprintCode,
    tasks,
  });
}

const ctx = () => ({
  codes: codes(),
  projectId: PROJECT,
  workspaceId: WS,
  sprintId: S1,
  today,
});
const codesOf = (r: { errors: { code: string }[] }) =>
  r.errors.map((e) => e.code);

describe('ActionValidatorService.validateDecompose — 7 mã lỗi', () => {
  it('đề xuất hợp lệ → ok, resolution có UUID và facts có số', async () => {
    const r = await makeService({}).validateDecompose(proposal(), ctx());
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.resolution.sprintId).toBe(S1);
    expect(r.resolution.tasks.d1).toEqual({
      assigneeId: U_LAN,
      skills: [{ skillId: K_REACT, minLevel: 3 }],
      droppedSkills: [],
    });
    expect(r.facts).toMatchObject({
      totalHours: 14,
      window: { from: '2026-10-13', to: '2026-10-24' },
    });
  });

  it('UNKNOWN_CODE: mã k/u/s/draftKey không có trong ngữ cảnh — không đoán', async () => {
    const r = await makeService({}).validateDecompose(
      proposal(
        [
          {
            requiredSkills: [{ skill: 'k9', minLevel: 1 }],
            suggestedAssignee: 'u9',
          },
          { dependsOn: ['d7'] },
        ],
        's4',
      ),
      ctx(),
    );
    expect(r.ok).toBe(false);
    expect(codesOf(r).filter((c) => c === 'UNKNOWN_CODE')).toHaveLength(4);
    expect(r.errors.map((e) => e.path)).toEqual(
      expect.arrayContaining([
        'sprint',
        'tasks[0].requiredSkills[0]',
        'tasks[0].suggestedAssignee',
        'tasks[1].dependsOn[0]',
      ]),
    );
  });

  it('sprint AI nêu khác sprint đang chọn: form → lỗi; chat (sprintIsDefault) → dùng sprint AI nêu', async () => {
    const S2 = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    const book = codes();
    book.assign('s', S2); // s2
    const onForm = await makeService({}).validateDecompose(proposal([], 's2'), {
      ...ctx(),
      codes: book,
    });
    expect(onForm.errors.map((e) => e.path)).toContain('sprint');
    const inChat = await makeService({}).validateDecompose(proposal([], 's2'), {
      ...ctx(),
      codes: book,
      sprintIsDefault: true,
    });
    expect(inChat.errors.map((e) => e.path)).not.toContain('sprint');
    expect(inChat.resolution.sprintId).toBe(S2);
  });

  it('tên kỹ năng LLM sinh: khớp alias không dấu → dùng; không khớp → cảnh báo SKILL_UNKNOWN và bỏ (không lỗi)', async () => {
    const r = await makeService({}).validateDecompose(
      proposal([
        {
          requiredSkills: [
            { skill: 'react js', minLevel: 2 },
            { skill: 'Kiểm thử tự động', minLevel: 1 },
          ],
        },
      ]),
      ctx(),
    );
    expect(r.ok).toBe(true);
    expect(r.resolution.tasks.d1.skills).toEqual([
      { skillId: K_REACT, minLevel: 2 },
    ]);
    expect(r.resolution.tasks.d1.droppedSkills).toEqual(['Kiểm thử tự động']);
    expect(r.warnings.map((w) => w.code)).toContain('SKILL_UNKNOWN');
  });

  it('ASSIGN_NOT_MEMBER: mã có trong ngữ cảnh nhưng người đã rời dự án', async () => {
    const r = await makeService({}).validateDecompose(
      proposal([{ suggestedAssignee: 'u3' }]),
      ctx(),
    );
    expect(codesOf(r)).toContain('ASSIGN_NOT_MEMBER');
  });

  it('ASSIGN_ON_LEAVE: nghỉ trọn cửa sổ sprint', async () => {
    const r = await makeService({
      offs: [
        {
          userId: U_LAN,
          fromDate: new Date('2026-10-10'),
          toDate: new Date('2026-10-30'),
        },
      ],
    }).validateDecompose(proposal(), ctx());
    const e = r.errors.find((x) => x.code === 'ASSIGN_ON_LEAVE');
    expect(e).toBeDefined();
    expect(e!.data).toEqual({ from: '2026-10-10', to: '2026-10-30' });
  });

  it('ASSIGN_SKILL_GAP: mức người thấp hơn mức yêu cầu, kèm số', async () => {
    const r = await makeService({}).validateDecompose(
      proposal([{ requiredSkills: [{ skill: 'k2', minLevel: 3 }] }]), // Lan NestJS 1 < 3
      ctx(),
    );
    const e = r.errors.find((x) => x.code === 'ASSIGN_SKILL_GAP');
    expect(e?.data).toMatchObject({ skill: 'NestJS', required: 3, level: 1 });
  });

  it('ASSIGN_CAPACITY_EXCEEDED: giờ giao vượt giờ trống tới hết sprint', async () => {
    const r = await makeService({
      freeHours: { [U_LAN]: 5 },
    }).validateDecompose(proposal(), ctx());
    const e = r.errors.find((x) => x.code === 'ASSIGN_CAPACITY_EXCEEDED');
    expect(e?.path).toBe('tasks[0].suggestedAssignee');
    expect(e?.data).toMatchObject({ freeHours: 5, addedHours: 8 });
  });

  it('ASSIGN_OVERLOAD: mức sử dụng sau khi nhận vượt ngưỡng 1.1 của workspace', async () => {
    const r = await makeService({
      effLoad: { [U_MINH]: 70 },
      effCap: 34,
    }).validateDecompose(proposal(), ctx());
    const e = r.errors.find((x) => x.code === 'ASSIGN_OVERLOAD');
    expect(e?.path).toBe('tasks[1].suggestedAssignee');
    expect(e?.data).toMatchObject({ threshold: 1.1 });
    expect(
      (e?.data as { utilizationAfter: number }).utilizationAfter,
    ).toBeGreaterThan(1.1);
  });

  it('DEPENDENCY_CYCLE: d1 → d2 → d1', async () => {
    const r = await makeService({}).validateDecompose(
      proposal([{ dependsOn: ['d2'] }]),
      ctx(),
    );
    const e = r.errors.find((x) => x.code === 'DEPENDENCY_CYCLE');
    expect(e?.data).toEqual({ cycle: ['d1', 'd2', 'd1'] });
  });

  it('ước lượng ngoài 0,5–40 h → VALIDATION_FAILED; tổng vượt giờ trống nhóm → cảnh báo SPRINT_CAPACITY', async () => {
    const r = await makeService({
      freeHours: { [U_LAN]: 10, [U_MINH]: 10 },
    }).validateDecompose(
      proposal([
        { estimateHours: 0.25, suggestedAssignee: undefined },
        { estimateHours: 40, suggestedAssignee: undefined },
      ]),
      ctx(),
    );
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      path: 'tasks[0].estimateHours',
      code: 'VALIDATION_FAILED',
    });
    expect(r.warnings.map((w) => w.code)).toContain('SPRINT_CAPACITY');
  });

  it('không sửa action: đối tượng vào không bị đụng', async () => {
    const p = proposal([{ suggestedAssignee: 'u3' }]);
    const snapshot = JSON.stringify(p);
    await makeService({}).validateDecompose(p, ctx());
    expect(JSON.stringify(p)).toBe(snapshot);
  });
});

describe('validateExplain', () => {
  it('riskLevel phải trùng mức backend', () => {
    const svc = makeService({});
    const ok = svc.validateExplain(
      {
        type: 'RISK_EXPLANATION',
        schemaVersion: 1,
        reply: '',
        riskLevel: 'HIGH',
        causes: [],
        recommendations: [],
      },
      'HIGH',
    );
    expect(ok.ok).toBe(true);
    const bad = svc.validateExplain(
      {
        type: 'RISK_EXPLANATION',
        schemaVersion: 1,
        reply: '',
        riskLevel: 'LOW',
        causes: [],
        recommendations: [],
      },
      'HIGH',
    );
    expect(bad.errors[0]).toMatchObject({
      code: 'AI_RESPONSE_INVALID',
      data: { expected: 'HIGH', got: 'LOW' },
    });
  });
});

describe('graph', () => {
  it('findCycle / topoOrder / boDau', () => {
    expect(
      findCycle(
        new Map([
          ['a', ['b']],
          ['b', ['c']],
          ['c', []],
        ]),
      ),
    ).toBeNull();
    expect(
      findCycle(
        new Map([
          ['a', ['b']],
          ['b', ['a']],
        ]),
      ),
    ).toEqual(['a', 'b', 'a']);
    expect(
      topoOrder(
        ['a', 'b', 'c'],
        new Map([
          ['a', ['b']],
          ['b', ['c']],
          ['c', []],
        ]),
      ),
    ).toEqual(['c', 'b', 'a']);
    expect(boDau('  Kiểm thử Tự động (E2E) ')).toBe('kiem thu tu dong e2e');
    expect(boDau('ReactJS')).toBe('reactjs');
  });
});
