import type { AiPurpose } from '@prisma/client';

/**
 * Nhà cung cấp GIẢ cho dev/test (`AI_PROVIDER=fake`, như `AI_V2_FAKE_PROVIDER` của Table_Calendar): không gọi mạng,
 * đọc mã ngắn có thật trong prompt rồi trả JSON hợp lệ. Chỉ thị `[[fake:…]]` trong yêu cầu cho e2e đi qua các
 * nhánh lỗi của Validator; `[[fake:…-persist]]` giữ lỗi cả khi được gọi lại kèm LỖI KIỂM TRA LƯỢT TRƯỚC.
 */
export function fakeGenerate(purpose: AiPurpose, userText: string): string {
  const directive = /\[\[fake:([a-z-]+)\]\]/.exec(userText)?.[1] ?? '';
  const isRetry = userText.includes('LỖI KIỂM TRA LƯỢT TRƯỚC');
  const persist = directive.endsWith('-persist');
  const mode = persist
    ? directive.replace(/-persist$/, '')
    : isRetry
      ? ''
      : directive;

  if (mode === 'invalid-json')
    return 'Xin lỗi, tôi không chắc. {"type": "DECOMPOSE_PROPOSAL", "tasks": [';
  if (mode === 'ask')
    return JSON.stringify({
      type: 'ASK_CLARIFICATION',
      reply: 'Yêu cầu chưa rõ.',
      question: 'Bạn muốn đăng nhập bằng Google hay email?',
      options: [
        { code: 'google', label: 'Google' },
        { code: 'email', label: 'Email + mật khẩu' },
      ],
    });

  if (purpose === 'EXPLAIN') {
    const level =
      /Mức rủi ro \(backend\): (\w+)/.exec(userText)?.[1] ?? 'UNKNOWN';
    const causes = [
      ...userText.matchAll(
        /^(OVERDUE|UNASSIGNED|OVERLOADED_MEMBER|BLOCKED|BIG_NOT_STARTED|SCOPE_CREEP) \| (\d+)/gm,
      ),
    ];
    return JSON.stringify({
      type: 'RISK_EXPLANATION',
      reply: `Sprint đang ở mức ${level} (fake).`,
      riskLevel:
        mode === 'wrong-level' ? (level === 'HIGH' ? 'LOW' : 'HIGH') : level,
      causes: causes.map((c) => ({ code: c[1], text: `${c[1]}: ${c[2]} mục` })),
      recommendations: [
        'Giao các task chưa có người',
        'Chia nhỏ task lớn chưa bắt đầu',
      ],
    });
  }

  const skills = [...userText.matchAll(/^(k\d+) \| /gm)].map((m) => m[1]);
  const sprint = /Sprint đích: (s\d+)/.exec(userText)?.[1];
  const k1 = mode === 'unknown-code' ? 'k999' : skills[0];
  // Người có kỹ năng k1 trong DANH BẠ (cột kỹ năng ghi "k1 React 4"); không ai có → không gợi ý
  const withSkill = skills[0]
    ? [...userText.matchAll(/^(u\d+) \| .*$/gm)].find((m) =>
        new RegExp(`\\b${skills[0]} `).test(m[0]),
      )?.[1]
    : undefined;
  const u1 = mode === 'unknown-code' ? 'u999' : withSkill;
  const bigHours = mode === 'overload' ? 400 : 8;
  return JSON.stringify({
    type: 'DECOMPOSE_PROPOSAL',
    reply: 'Đề xuất 3 công việc (fake).',
    ...(sprint ? { sprint } : {}),
    tasks: [
      {
        draftKey: 'd1',
        title: 'Thiết kế màn hình đăng nhập',
        description: 'Wireframe + component',
        estimateHours: bigHours,
        priority: 'HIGH',
        difficulty: 3,
        requiredSkills: k1 ? [{ skill: k1, minLevel: 2 }] : [],
        subtasks: [{ title: 'Wireframe', estimateHours: 2 }],
        dependsOn: mode === 'cycle' ? ['d2'] : [],
        ...(u1 ? { suggestedAssignee: u1 } : {}),
        reason: 'Có kỹ năng phù hợp và còn giờ trống',
      },
      {
        draftKey: 'd2',
        title: 'API xác thực',
        estimateHours: 6,
        priority: 'MEDIUM',
        difficulty: 3,
        requiredSkills: skills[1] ? [{ skill: skills[1], minLevel: 1 }] : [],
        subtasks: [],
        dependsOn: ['d1'],
      },
      {
        draftKey: 'd3',
        title: 'Kiểm thử luồng đăng nhập',
        estimateHours: 4,
        priority: 'LOW',
        difficulty: 2,
        requiredSkills: [{ skill: 'Kiem thu tu dong', minLevel: 1 }],
        subtasks: [],
        dependsOn: ['d2'],
      },
    ],
    assumptions: [
      'Chưa có kỹ năng "Kiểm thử tự động" trong danh mục nên để trống',
    ],
  });
}
