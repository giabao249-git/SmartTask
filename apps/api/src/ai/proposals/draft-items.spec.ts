import {
  decomposeProposalSchema,
  structuredActionSchema,
} from '@smarttask/shared';
import {
  assignServerKeys,
  deriveStatus,
  filterItems,
  initialItemStatus,
  isProposalAction,
  itemsOf,
  kindOf,
  patchItem,
  type ProposalAction,
  issuesByKey,
  itemDetailsOf,
} from './draft-items';

const decompose = () =>
  decomposeProposalSchema.parse({
    type: 'DECOMPOSE_PROPOSAL',
    reply: 'ok',
    sprint: 's2',
    tasks: [
      {
        draftKey: 'd1',
        title: 'Schema',
        estimateHours: 8,
        requiredSkills: [{ skill: 'k3', minLevel: 3 }],
        suggestedAssignee: 'u2',
      },
      { draftKey: 'd2', title: 'API', estimateHours: 6, dependsOn: ['d1'] },
      { draftKey: 'd3', title: 'Test', estimateHours: 4, dependsOn: ['d2'] },
    ],
  });

describe('draft-items — cấp key từ next_draft_seq (docs 12 §3)', () => {
  it('đổi key LLM d1..d3 thành d7..d9, kể cả dependsOn; trả bảng ánh xạ và số key đã cấp', () => {
    const { action, keyMap, count } = assignServerKeys(decompose(), 7);
    expect(count).toBe(3);
    expect(keyMap).toEqual({ d1: 'd7', d2: 'd8', d3: 'd9' });
    const t = (action as ReturnType<typeof decompose>).tasks;
    expect(t.map((x) => x.draftKey)).toEqual(['d7', 'd8', 'd9']);
    expect(t[1].dependsOn).toEqual(['d7']);
    expect(t[2].dependsOn).toEqual(['d8']);
  });

  it('UPDATE_TASK_DRAFT{targetTask} và ASSIGN/REBALANCE cũng nhận key server', () => {
    const upd = structuredActionSchema.parse({
      type: 'UPDATE_TASK_DRAFT',
      reply: '',
      targetTask: 't3',
      patch: { due: '2026-10-24' },
    });
    expect(isProposalAction(upd)).toBe(true);
    const r = assignServerKeys(upd as ProposalAction, 4);
    expect(r.count).toBe(1);
    expect((r.action as { draftKey: string }).draftKey).toBe('d4');
    expect(kindOf(r.action)).toBe('TASK_UPDATE');
    const asg = structuredActionSchema.parse({
      type: 'ASSIGN_PROPOSAL',
      reply: '',
      assignments: [
        { task: 't1', assignee: 'u2' },
        { task: 't2', assignee: 'u3' },
      ],
    });
    const a = assignServerKeys(asg as ProposalAction, 10);
    expect(itemsOf(a.action).map((i) => i.draftKey)).toEqual(['d10', 'd11']);
    // UPDATE_TASK_DRAFT theo draftKey (không targetTask) KHÔNG phải proposal mới
    const patch = structuredActionSchema.parse({
      type: 'UPDATE_TASK_DRAFT',
      reply: '',
      targetDraftKeys: ['d2'],
      patch: {},
    });
    expect(isProposalAction(patch)).toBe(false);
  });
});

describe('draft-items — vá patch theo key', () => {
  it('"cái thứ hai đổi 6 giờ, giao Lan": chỉ item đó đổi; null = xoá giá trị; key lạ → null', () => {
    const a = decompose();
    const out = patchItem(a, 'd2', {
      estimateHours: 12,
      suggestedAssignee: 'u5',
    }) as ReturnType<typeof decompose>;
    expect(out.tasks[1]).toMatchObject({
      estimateHours: 12,
      suggestedAssignee: 'u5',
      dependsOn: ['d1'],
    });
    expect(out.tasks[0]).toEqual(a.tasks[0]);
    const cleared = patchItem(out, 'd1', {
      suggestedAssignee: null,
      description: null,
    }) as ReturnType<typeof decompose>;
    expect(cleared.tasks[0].suggestedAssignee).toBeUndefined();
    expect(patchItem(a, 'd9', { title: 'x' })).toBeNull();
    // đối tượng vào không bị sửa
    expect(a.tasks[1].estimateHours).toBe(6);
  });

  it('patch sai schema (ước lượng âm) → ném ZodError', () => {
    expect(() => patchItem(decompose(), 'd1', { estimateHours: -1 })).toThrow();
  });

  it('CREATE_TASK_DRAFT: suggestedAssignee vá vào assignee, start/due đổi được', () => {
    const a = structuredActionSchema.parse({
      type: 'CREATE_TASK_DRAFT',
      reply: '',
      drafts: [
        {
          draftKey: 'd1',
          title: 'Đăng nhập',
          estimateHours: 4,
          assignee: 'u1',
          due: '2026-10-10',
        },
      ],
    }) as ProposalAction;
    const out = patchItem(a, 'd1', {
      suggestedAssignee: 'u2',
      due: '2026-10-24',
    });
    expect(itemsOf(out!)[0]).toMatchObject({
      assignee: 'u2',
      due: '2026-10-24',
    });
  });
});

describe('draft-items — lọc tập con & suy trạng thái (docs 12 §2)', () => {
  it('filterItems giữ đúng key; initialItemStatus mọi item DRAFT', () => {
    const a = decompose();
    const sub = filterItems(a, ['d1', 'd3']) as ReturnType<typeof decompose>;
    expect(sub.tasks.map((t) => t.draftKey)).toEqual(['d1', 'd3']);
    expect(initialItemStatus(a)).toEqual({
      d1: 'DRAFT',
      d2: 'DRAFT',
      d3: 'DRAFT',
    });
  });

  it('deriveStatus: còn DRAFT → DRAFT; hết DRAFT có APPLIED → APPLIED; toàn DISCARDED → REJECTED', () => {
    expect(deriveStatus({ d1: 'APPLIED', d2: 'DRAFT' })).toBe('DRAFT');
    expect(deriveStatus({ d1: 'APPLIED', d2: 'DISCARDED' })).toBe('APPLIED');
    expect(deriveStatus({ d1: 'DISCARDED', d2: 'DISCARDED' })).toBe('REJECTED');
  });
});

describe('panel bản nháp: chi tiết và vấn đề gắn đúng mục', () => {
  const action = {
    type: 'DECOMPOSE_PROPOSAL' as const,
    reply: 'r',
    sprint: 's1',
    assumptions: [],
    tasks: [
      {
        draftKey: 'd3',
        title: 'Đăng nhập',
        description: 'Form email + mật khẩu',
        estimateHours: 10,
        taskType: 'STORY' as const,
        priority: 'HIGH' as const,
        difficulty: 3,
        requiredSkills: [{ skill: 'k2', minLevel: 3 }],
        subtasks: [{ title: 'API' }, { title: 'UI' }],
        dependsOn: [],
        suggestedAssignee: 'u4',
        reason: 'Minh làm backend đăng nhập trước đó',
      },
      {
        draftKey: 'd4',
        title: 'Khoá tài khoản',
        requiredSkills: [],
        subtasks: [],
        dependsOn: ['d3'],
      },
    ],
  };
  it('chi tiết: mô tả, loại, ưu tiên, độ khó, lý do, số việc con, kỹ năng kèm mức', () => {
    expect(itemDetailsOf(action as never).d3).toEqual({
      description: 'Form email + mật khẩu',
      taskType: 'STORY',
      priority: 'HIGH',
      difficulty: 3,
      reason: 'Minh làm backend đăng nhập trước đó',
      subtasks: 2,
      skills: [{ code: 'k2', minLevel: 3 }],
    });
  });
  it('lỗi tasks[1].* về d4, lỗi không có chỉ số về chung, cảnh báo giữ mức cảnh báo', () => {
    const r = issuesByKey(action as never, {
      errors: [
        {
          path: 'tasks[1].suggestedAssignee',
          code: 'ASSIGN_SKILL_GAP',
          message: 'Minh thiếu React',
        },
        { path: 'sprint', code: 'NOT_FOUND', message: 'Sprint đã đóng' },
      ],
      warnings: [
        {
          path: 'tasks[0].due',
          code: 'WARN_DUE_AFTER_SPRINT',
          message: 'Hạn sau sprint',
        },
      ],
    });
    expect(r.byKey.d4).toEqual([
      {
        severity: 'error',
        code: 'ASSIGN_SKILL_GAP',
        message: 'Minh thiếu React',
      },
    ]);
    expect(r.byKey.d3).toEqual([
      {
        severity: 'warning',
        code: 'WARN_DUE_AFTER_SPRINT',
        message: 'Hạn sau sprint',
      },
    ]);
    expect(r.general).toEqual([
      { severity: 'error', code: 'NOT_FOUND', message: 'Sprint đã đóng' },
    ]);
  });
});
