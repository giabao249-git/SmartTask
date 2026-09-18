import {
  decryptSecret,
  encryptSecret,
  hashPrompt,
  maskSecret,
} from './ai-config/crypto.util';
import { CodeBook } from './context/short-codes';
import { applyEdits } from './executor/apply-edits';
import { parseStructuredAction, stripFences } from './parser/response-parser';
import {
  assemblePrompt,
  bang,
  MOC_PHAN_DONG,
  tachPromptTinhDong,
} from './prompt/prompt-assembler';
import { estimateCost } from './provider/ai-provider.service';
import { fakeGenerate } from './provider/fake-provider';
import {
  geminiBody,
  geminiCachedContentsUrl,
  geminiGenerateUrl,
  readGemini,
} from './provider/gemini';
import { RESPONSE_SCHEMAS, toGeminiSchema } from './provider/response-schemas';
import { dayBounds } from './quota/quota.service';

describe('PromptAssembler (thuần)', () => {
  const built = () =>
    assemblePrompt({
      policy: [{ title: 'MASTER', body: 'luật' }],
      staticBlocks: [
        { title: 'DANH BẠ', body: 'u1 | Lan' },
        { title: 'RỖNG', body: '  ' },
      ],
      dynamicBlocks: [{ title: 'HÔM NAY', body: '2026-10-12' }],
    });

  it('phần tĩnh trước mốc, phần động sau; khối rỗng bị bỏ', () => {
    const p = built();
    expect(p.system).toBe('--- MASTER ---\nluật\n--- HẾT MASTER ---');
    expect(p.userText.indexOf(MOC_PHAN_DONG)).toBeGreaterThan(0);
    expect(p.userText).not.toContain('RỖNG');
    expect(p.userText.indexOf('DANH BẠ')).toBeLessThan(
      p.userText.indexOf(MOC_PHAN_DONG),
    );
    expect(p.userText.indexOf('HÔM NAY')).toBeGreaterThan(
      p.userText.indexOf(MOC_PHAN_DONG),
    );
  });

  it('hash tĩnh ổn định giữa hai lượt cùng dữ liệu tĩnh, đổi khi danh bạ đổi', () => {
    const a = built().staticHash;
    const b = built().staticHash;
    const c = assemblePrompt({
      policy: [{ title: 'MASTER', body: 'luật' }],
      staticBlocks: [{ title: 'DANH BẠ', body: 'u1 | Lan\nu2 | Minh' }],
      dynamicBlocks: [],
    }).staticHash;
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(32);
  });

  it('tachPromptTinhDong: không mốc hoặc mốc ở đầu → không cắt', () => {
    expect(tachPromptTinhDong('abc')).toEqual({ tinh: null, dong: 'abc' });
    expect(tachPromptTinhDong(`${MOC_PHAN_DONG}\nx`).tinh).toBeNull();
    const p = built();
    const { tinh, dong } = tachPromptTinhDong(p.userText);
    expect(tinh).toBe(p.staticText);
    expect(dong.startsWith(MOC_PHAN_DONG)).toBe(true);
  });

  it('bang: cột | cột, null → —', () => {
    expect(
      bang(
        ['a', 'b'],
        [
          [1, null],
          ['x', undefined],
        ],
      ),
    ).toBe('a | b\n1 | —\nx | —');
  });
});

describe('ResponseParser (thuần, không ném lỗi)', () => {
  it('bỏ ```json fence và văn bản lạc quanh object', () => {
    expect(stripFences('Đây là:\n```json\n{"a":1}\n```\ncảm ơn')).toBe(
      '{"a":1}',
    );
    expect(stripFences('blah {"a":1} blah')).toBe('{"a":1}');
  });
  it('JSON hợp lệ đúng schema → action, defaults được điền', () => {
    const r = parseStructuredAction(
      '{"type":"ASK_CLARIFICATION","reply":"?","question":"Sprint nào?"}',
    );
    expect(r.parseFailed).toBe(false);
    expect(r.action).toMatchObject({
      type: 'ASK_CLARIFICATION',
      schemaVersion: 1,
      options: [],
    });
  });
  it('JSON hỏng hoặc sai schema → CHAT_RESPONSE parseFailed kèm văn bản thô cắt ngắn', () => {
    const r1 = parseStructuredAction('không phải json');
    expect(r1.parseFailed).toBe(true);
    expect(r1.action).toMatchObject({
      type: 'CHAT_RESPONSE',
      parseFailed: true,
      reply: 'không phải json',
    });
    const r2 = parseStructuredAction(
      '{"type":"DECOMPOSE_PROPOSAL","reply":"x","tasks":[]}',
    );
    expect(r2.parseFailed).toBe(true);
    expect(r2.issues?.[0]).toContain('tasks');
  });
});

describe('CodeBook — mã ngắn theo lượt', () => {
  it('cấp mã tăng dần theo thứ tự, idempotent, tra ngược, khôi phục từ JSON', () => {
    const c = new CodeBook();
    expect(c.assign('u', 'A')).toBe('u1');
    expect(c.assign('u', 'B')).toBe('u2');
    expect(c.assign('u', 'A')).toBe('u1');
    expect(c.assign('k', 'X')).toBe('k1');
    expect(c.idOf('u', 'u2')).toBe('B');
    expect(c.idOf('u', 'k1')).toBeUndefined();
    expect(c.idOf('u', 'u9')).toBeUndefined();
    const again = CodeBook.from(c.toJSON());
    expect(again.idOf('k', 'k1')).toBe('X');
    expect(again.assign('u', 'C')).toBe('u3');
  });
});

describe('crypto.util — AES-256-GCM từ APP_KEY', () => {
  const prev = process.env.APP_KEY;
  beforeAll(() => (process.env.APP_KEY = 'khoa-thu-nghiem-phase-7'));
  afterAll(() => (process.env.APP_KEY = prev));

  it('mã hoá → giải mã đúng; che chỉ lộ 4 ký tự cuối; hash 32 ký tự', () => {
    const enc = encryptSecret('AIzaSy-abcdef-1234');
    expect(enc.split(':')).toHaveLength(3);
    expect(decryptSecret(enc)).toBe('AIzaSy-abcdef-1234');
    expect(maskSecret(enc)).toBe('••••1234');
    expect(hashPrompt('x')).toHaveLength(32);
  });
  it('đổi APP_KEY → giải mã NÉM LỖI rõ, không trả rác', () => {
    const enc = encryptSecret('secret');
    process.env.APP_KEY = 'khoa-khac';
    expect(() => decryptSecret(enc)).toThrow(/APP_KEY/);
    expect(maskSecret(enc)).toContain('không đọc được');
    process.env.APP_KEY = 'khoa-thu-nghiem-phase-7';
  });
});

describe('Gemini/Ollama helpers', () => {
  it('URL generateContent theo các dạng baseUrl (kế thừa gemini-api.util)', () => {
    expect(geminiGenerateUrl('gemini-2.5-flash')).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    );
    expect(
      geminiGenerateUrl('m', 'https://proxy.local/{model}:generateContent?x=1'),
    ).toBe('https://proxy.local/m:generateContent?x=1');
    expect(geminiGenerateUrl('m', 'https://proxy.local/v1beta/models')).toBe(
      'https://proxy.local/v1beta/models/m:generateContent',
    );
    expect(geminiCachedContentsUrl(null)).toBe(
      'https://generativelanguage.googleapis.com/v1beta/cachedContents',
    );
    expect(
      geminiCachedContentsUrl(
        'https://proxy.local/v1beta/models/{model}:generateContent',
        'cachedContents/abc',
      ),
    ).toBe('https://proxy.local/v1beta/cachedContents/abc');
  });
  it('body: responseSchema viết hoa type, bỏ khoá lạ; cachedContent thay systemInstruction', () => {
    const schema = toGeminiSchema(RESPONSE_SCHEMAS.DECOMPOSE);
    expect(schema.type).toBe('OBJECT');
    expect(
      (schema.properties as Record<string, { type: string }>).tasks.type,
    ).toBe('ARRAY');
    const b1 = geminiBody({
      system: 's',
      userText: 'u',
      supportsTemperature: true,
      temperature: 0.4,
      responseSchema: RESPONSE_SCHEMAS.EXPLAIN,
    });
    expect(b1).toHaveProperty('systemInstruction');
    expect(
      (b1.generationConfig as Record<string, unknown>).responseMimeType,
    ).toBe('application/json');
    const b2 = geminiBody({
      system: 's',
      userText: 'u',
      supportsTemperature: false,
      temperature: 0.4,
      cachedContent: 'cachedContents/x',
    });
    expect(b2).not.toHaveProperty('systemInstruction');
    expect(b2.cachedContent).toBe('cachedContents/x');
    expect(b2.generationConfig).not.toHaveProperty('temperature');
  });
  it('readGemini: gom parts, usage kể cả cache/thoughts, MAX_TOKENS → truncated', () => {
    const r = readGemini({
      candidates: [
        {
          content: { parts: [{ text: '{"a":' }, { text: '1}' }] },
          finishReason: 'MAX_TOKENS',
        },
      ],
      usageMetadata: {
        promptTokenCount: 100,
        candidatesTokenCount: 20,
        cachedContentTokenCount: 60,
        thoughtsTokenCount: 5,
        totalTokenCount: 125,
      },
    });
    expect(r.text).toBe('{"a":1}');
    expect(r.truncated).toBe(true);
    expect(r.usage).toEqual({
      inputTokens: 100,
      cachedInputTokens: 60,
      outputTokens: 20,
      reasoningTokens: 5,
      totalTokens: 125,
    });
  });
  it('estimateCost: token cache rẻ hơn (docs 07 §5)', () => {
    const prices = { input: 0.3, output: 2.5, cachedInput: 0.075 };
    const noCache = estimateCost(prices, {
      inputTokens: 11_000,
      cachedInputTokens: 0,
      outputTokens: 900,
      reasoningTokens: 0,
      totalTokens: 11_900,
    });
    const cached = estimateCost(prices, {
      inputTokens: 11_000,
      cachedInputTokens: 3_500,
      outputTokens: 900,
      reasoningTokens: 0,
      totalTokens: 11_900,
    });
    expect(noCache).toBeCloseTo((11_000 * 0.3 + 900 * 2.5) / 1e6, 8);
    expect(cached).toBeLessThan(noCache);
  });
});

describe('Fake provider — JSON hợp lệ theo mã có trong prompt', () => {
  const prompt = [
    'k1 | React | FE | ',
    'k2 | NestJS | BE | ',
    'u1 | Lan | Lan | PM | k1 React 4 | 40',
    'Sprint đích: s1',
    'YÊU CẦU: làm đăng nhập',
  ].join('\n');
  it('DECOMPOSE dùng k1/u1/s1 thật; chỉ thị unknown-code trả mã lạ rồi tự sửa khi được gọi lại', () => {
    const ok = parseStructuredAction(fakeGenerate('DECOMPOSE', prompt));
    expect(ok.action).toMatchObject({
      type: 'DECOMPOSE_PROPOSAL',
      sprint: 's1',
    });
    const bad = parseStructuredAction(
      fakeGenerate('DECOMPOSE', prompt + ' [[fake:unknown-code]]'),
    );
    expect(
      (bad.action as { tasks: { suggestedAssignee: string }[] }).tasks[0]
        .suggestedAssignee,
    ).toBe('u999');
    const fixed = parseStructuredAction(
      fakeGenerate(
        'DECOMPOSE',
        prompt + ' [[fake:unknown-code]]\nLỖI KIỂM TRA LƯỢT TRƯỚC',
      ),
    );
    expect(
      (fixed.action as { tasks: { suggestedAssignee: string }[] }).tasks[0]
        .suggestedAssignee,
    ).toBe('u1');
  });
  it('EXPLAIN đọc mức backend từ ngữ cảnh', () => {
    const r = parseStructuredAction(
      fakeGenerate(
        'EXPLAIN',
        'Mức rủi ro (backend): HIGH\nOVERDUE | 2 | t1 t2 | u1',
      ),
    );
    expect(r.action).toMatchObject({
      type: 'RISK_EXPLANATION',
      riskLevel: 'HIGH',
      causes: [{ code: 'OVERDUE' }],
    });
  });
});

describe('applyEdits (thuần) — người sửa, backend gộp rồi zod lại', () => {
  const action = parseStructuredAction(
    fakeGenerate(
      'DECOMPOSE',
      'k1 | React | FE | \nu1 | Lan | Lan | PM | k1 React 4 | 40\nSprint đích: s1',
    ),
  ).action as never;
  it('sửa giờ, bỏ người, xoá task và gỡ phụ thuộc trỏ tới task đã xoá', () => {
    const out = applyEdits(action, [
      { draftKey: 'd1', estimateHours: 12, suggestedAssignee: null },
      { draftKey: 'd2', remove: true },
    ]);
    expect(out.tasks.map((t) => t.draftKey)).toEqual(['d1', 'd3']);
    expect(out.tasks[0]).toMatchObject({ estimateHours: 12 });
    expect(out.tasks[0].suggestedAssignee).toBeUndefined();
    expect(out.tasks[1].dependsOn).toEqual([]);
  });
  it('sửa sai schema (ước lượng âm) → ném ZodError', () => {
    expect(() =>
      applyEdits(action, [{ draftKey: 'd1', estimateHours: -1 }]),
    ).toThrow();
  });
});

describe('dayBounds — 0h theo múi giờ người dùng', () => {
  it('Asia/Ho_Chi_Minh: 2026-10-12T20:00Z là 03:00 ngày 13 → mốc 2026-10-12T17:00Z', () => {
    const { start, next } = dayBounds(
      'Asia/Ho_Chi_Minh',
      new Date('2026-10-12T20:00:00Z'),
    );
    expect(start.toISOString()).toBe('2026-10-12T17:00:00.000Z');
    expect(next.toISOString()).toBe('2026-10-13T17:00:00.000Z');
  });
  it('múi giờ sai → UTC', () => {
    const { start } = dayBounds(
      'Mars/Olympus',
      new Date('2026-10-12T20:00:00Z'),
    );
    expect(start.toISOString()).toBe('2026-10-12T00:00:00.000Z');
  });
});
