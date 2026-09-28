import { geminiBody, thinkingBudgetFor } from './gemini';

/**
 * Đo 28/09 với Gemini 2.5 Flash thật: trần 4.096 token, model tiêu ~3.930 token suy nghĩ → JSON bị cắt còn ~150
 * token, lượt phân rã/tạo việc lỗi 503 sau 2 lần. Suy nghĩ tính chung vào maxOutputTokens nên phải giới hạn.
 */
describe('ngân sách suy nghĩ của Gemini', () => {
  it('model reasoning chưa cấu hình → giữ tối đa 1/4 trần, không quá 1.024', () => {
    expect(thinkingBudgetFor(4096, undefined, true)).toBe(1024);
    expect(thinkingBudgetFor(2048, undefined, true)).toBe(512);
    expect(thinkingBudgetFor(16_384, undefined, true)).toBe(1024);
  });
  it('cấu hình đặt sẵn thì dùng đúng số đó; model không reasoning thì không gửi', () => {
    expect(thinkingBudgetFor(4096, 0, true)).toBe(0);
    expect(thinkingBudgetFor(4096, 3000, true)).toBe(3000);
    expect(thinkingBudgetFor(4096, undefined, false)).toBeUndefined();
  });
  it('thân request mang thinkingConfig khi có ngân sách', () => {
    const body = geminiBody({
      system: 's',
      userText: 'u',
      maxOutputTokens: 4096,
      thinkingBudget: thinkingBudgetFor(4096, undefined, true),
      supportsTemperature: true,
    }) as { generationConfig: Record<string, unknown> };
    expect(body.generationConfig.thinkingConfig).toEqual({
      thinkingBudget: 1024,
    });
    expect(body.generationConfig.maxOutputTokens).toBe(4096);
  });
});
