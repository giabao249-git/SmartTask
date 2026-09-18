/**
 * Mã ngắn theo lượt thay UUID (docs 05 §3.1): u1…uN người, t1…tM task, s1… sprint, k1… kỹ năng.
 * ContextBuilder cấp theo thứ tự ỔN ĐỊNH (tạo trước → số nhỏ) để khối tĩnh không đổi giữa các lượt;
 * bảng ánh xạ lưu `ai_proposals.code_map`; Validator đổi mã → UUID, mã lạ = UNKNOWN_CODE (không đoán).
 */
export type CodePrefix = 'u' | 't' | 's' | 'k';

export interface CodeMap {
  users: Record<string, string>;
  tasks: Record<string, string>;
  sprints: Record<string, string>;
  skills: Record<string, string>;
}

const KEY: Record<CodePrefix, keyof CodeMap> = {
  u: 'users',
  t: 'tasks',
  s: 'sprints',
  k: 'skills',
};

export class CodeBook {
  private readonly map: CodeMap = {
    users: {},
    tasks: {},
    sprints: {},
    skills: {},
  };
  private readonly reverse = new Map<string, string>();
  private readonly counters: Record<CodePrefix, number> = {
    u: 0,
    t: 0,
    s: 0,
    k: 0,
  };

  static from(map: CodeMap | null | undefined): CodeBook {
    const book = new CodeBook();
    if (!map) return book;
    for (const p of Object.keys(KEY) as CodePrefix[]) {
      for (const [code, id] of Object.entries(map[KEY[p]] ?? {})) {
        book.map[KEY[p]][code] = id;
        book.reverse.set(`${p}:${id}`, code);
        const n = Number(code.slice(1));
        if (n > book.counters[p]) book.counters[p] = n;
      }
    }
    return book;
  }

  /** Cấp mã cho id (idempotent). */
  assign(prefix: CodePrefix, id: string): string {
    const existing = this.reverse.get(`${prefix}:${id}`);
    if (existing) return existing;
    const code = `${prefix}${++this.counters[prefix]}`;
    this.map[KEY[prefix]][code] = id;
    this.reverse.set(`${prefix}:${id}`, code);
    return code;
  }

  codeOf(prefix: CodePrefix, id: string): string | undefined {
    return this.reverse.get(`${prefix}:${id}`);
  }

  /** UUID của mã; sai tiền tố hoặc không có → undefined (Validator biến thành UNKNOWN_CODE). */
  idOf(
    prefix: CodePrefix,
    code: string | undefined | null,
  ): string | undefined {
    if (!code || !code.startsWith(prefix)) return undefined;
    return this.map[KEY[prefix]][code];
  }

  toJSON(): CodeMap {
    return this.map;
  }
}
