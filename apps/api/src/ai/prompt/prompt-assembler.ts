import { hashPrompt } from '../ai-config/crypto.util';

/**
 * Ghép prompt từ các khối có tiêu đề (docs 05 §3, 07 §2) — hàm thuần, không Prisma.
 * Phần TĨNH (dùng chung cả workspace, sắp theo mã ổn định) đứng trước mốc `MOC_PHAN_DONG`,
 * phần ĐỘNG (theo người dùng và thời điểm) đứng sau — nhà cung cấp khớp cache theo tiền tố nên phần tĩnh
 * phải ổn định từng ký tự giữa các lượt. Kế thừa `smart-scheduler/tach-prompt.ts` (Table_Calendar).
 */
export const MOC_PHAN_DONG = '════════ DỮ LIỆU HAY THAY ĐỔI';

export interface PromptBlock {
  title: string;
  body: string;
}

export interface AssembledPrompt {
  /** systemInstruction: Master + Workspace prompt + khung đầu ra theo mục đích */
  system: string;
  /** Khối dữ liệu tĩnh (danh bạ, kỹ năng, dự án) — cache được */
  staticText: string;
  /** Khối động + yêu cầu hiện tại */
  dynamicText: string;
  /** Nội dung gửi ở lượt user: static + mốc + dynamic */
  userText: string;
  /** sha256 32 ký tự của (system + static) — khoá cache & ai_token_logs.prompt_hash */
  staticHash: string;
  chars: number;
}

export function renderBlock(b: PromptBlock): string {
  const body = b.body.trim();
  if (!body) return '';
  return `--- ${b.title} ---\n${body}\n--- HẾT ${b.title} ---`;
}

export function assemblePrompt(input: {
  policy: PromptBlock[];
  staticBlocks: PromptBlock[];
  dynamicBlocks: PromptBlock[];
}): AssembledPrompt {
  const join = (blocks: PromptBlock[]) =>
    blocks.map(renderBlock).filter(Boolean).join('\n\n');
  const system = join(input.policy);
  const staticText = join(input.staticBlocks);
  const dynamicText = join(input.dynamicBlocks);
  const userText = staticText
    ? `${staticText}\n\n${MOC_PHAN_DONG}\n\n${dynamicText}`
    : dynamicText;
  return {
    system,
    staticText,
    dynamicText,
    userText,
    staticHash: hashPrompt(`${system}\n${staticText}`),
    chars: system.length + userText.length,
  };
}

/**
 * Tách lại phần tĩnh/động từ một chuỗi đã ghép (dùng khi cache): không thấy mốc hoặc mốc ở đầu → gửi nguyên,
 * không cache — không bao giờ cắt bừa.
 */
export function tachPromptTinhDong(userText: string): {
  tinh: string | null;
  dong: string;
} {
  const i = userText.indexOf(MOC_PHAN_DONG);
  if (i <= 0) return { tinh: null, dong: userText };
  return {
    tinh: userText.slice(0, i).trimEnd(),
    dong: userText.slice(i).trimStart(),
  };
}

/** Bảng văn bản `cột | cột` — ít token hơn JSON ~35% và LLM đọc tốt hơn (05 §3.2). */
export function bang(
  headers: string[],
  rows: (string | number | null | undefined)[][],
): string {
  const line = (cells: (string | number | null | undefined)[]) =>
    cells
      .map((c) => (c === null || c === undefined ? '—' : String(c)))
      .join(' | ');
  return [line(headers), ...rows.map(line)].join('\n');
}
