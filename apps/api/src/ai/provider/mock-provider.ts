import type { AiPurpose } from '@prisma/client';
import { fakeGenerate } from './fake-provider';

/** JSON thô như LLM sẽ trả (chưa qua zod) hoặc chuỗi */
type MockValue = Record<string, unknown> | string;
type MockEntry =
  | MockValue
  | ((userText: string, purpose: AiPurpose) => MockValue | Promise<MockValue>);

/**
 * Nhà cung cấp MOCK cho e2e (`AI_PROVIDER=mock`): test đẩy sẵn action vào hàng đợi (trong cùng tiến trình),
 * mỗi lượt gọi lấy một phần tử; hàng đợi rỗng → rơi về `fakeGenerate` (nên mọi e2e Phase 7 chạy được với mock).
 * Không dùng ngoài test — không gọi mạng, không suy luận.
 */
export class AiMockQueue {
  private static queue: MockEntry[] = [];
  /** Prompt của lượt gần nhất — test đọc để soi ngữ cảnh (khối BẢN NHÁP, DANH TÍNH…). */
  static lastPrompt: { system: string; userText: string } | null = null;

  static push(...entries: MockEntry[]): void {
    this.queue.push(...entries);
  }

  static clear(): void {
    this.queue = [];
  }

  static size(): number {
    return this.queue.length;
  }

  static async take(purpose: AiPurpose, userText: string): Promise<string> {
    const next = this.queue.shift();
    if (next === undefined) return fakeGenerate(purpose, userText);
    const value: MockValue =
      typeof next === 'function'
        ? await Promise.resolve(next(userText, purpose))
        : next;
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
}

export function mockGenerate(
  purpose: AiPurpose,
  system: string,
  userText: string,
): Promise<string> {
  AiMockQueue.lastPrompt = { system, userText };
  return AiMockQueue.take(purpose, userText);
}
