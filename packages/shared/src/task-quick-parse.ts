/**
 * Đọc cú pháp nhanh khi tạo công việc: `Sửa login @huy #frontend !cao 4h t6 ~react>=3`.
 *
 * TẤT ĐỊNH HOÀN TOÀN — không gọi AI, cùng một đầu vào luôn cho cùng một kết quả, và có test.
 * Câu tự do kiểu "chia nhỏ màn đăng nhập ra" vẫn phải đi qua Trợ lý AI có bản nháp và người
 * duyệt (docs 12). Ở đây chỉ nhận đúng các ký hiệu dưới đây, cái gì không khớp thì GIỮ NGUYÊN
 * trong tiêu đề chứ không đoán bừa.
 *
 * | Ký hiệu | Ý nghĩa |
 * |---|---|
 * | `@tên` | người thực hiện (khớp không dấu, không phân biệt hoa thường) |
 * | `#nhãn` | nhãn có sẵn của dự án |
 * | `!thấp` `!tb` `!cao` `!rấtcao` | mức ưu tiên |
 * | `4h` `2.5h` | ước lượng giờ |
 * | `t2`…`t7` `cn` `hnay` `mai` `25/10` `25/10/2026` | hạn |
 * | `~react>=3` `~k:react>=3` | kỹ năng yêu cầu + mức tối thiểu |
 */

export type QuickPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface QuickParseDicts {
  members: { id: string; fullName: string; shortName?: string | null }[];
  labels: { id: string; name: string }[];
  skills: { id: string; name: string }[];
  /** Mốc tính hạn tương đối; bỏ trống = hôm nay. Truyền vào để test không phụ thuộc ngày chạy. */
  today?: Date;
}

export type QuickChipKind = 'assignee' | 'label' | 'priority' | 'estimate' | 'due' | 'skill';

export interface QuickChip {
  kind: QuickChipKind;
  /** Chữ hiện trên huy hiệu cho người dùng soát lại trước khi Enter. */
  text: string;
  /** Đoạn gốc trong câu, dùng để bỏ chọn. */
  token: string;
}

export interface QuickParseResult {
  title: string;
  assigneeIds: string[];
  labelIds: string[];
  priority?: QuickPriority;
  estimateHours?: number;
  /** YYYY-MM-DD */
  dueDate?: string;
  requiredSkills: { skillId: string; minLevel: number }[];
  chips: QuickChip[];
  /** Ký hiệu đúng dạng nhưng không tìm ra thứ tương ứng — vẫn nằm lại trong tiêu đề. */
  unknown: { token: string; reason: 'không tìm thấy' | 'trùng nhiều' }[];
}

/** Bỏ dấu tiếng Việt và hạ chữ thường để so khớp tên người/nhãn/kỹ năng. */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, (c) => (c === 'Đ' ? 'D' : 'd'))
    .toLowerCase()
    .trim();
}

const PRIORITY_WORDS: Record<string, QuickPriority> = {
  thap: 'LOW',
  low: 'LOW',
  tb: 'MEDIUM',
  trungbinh: 'MEDIUM',
  medium: 'MEDIUM',
  cao: 'HIGH',
  high: 'HIGH',
  ratcao: 'URGENT',
  urgent: 'URGENT',
  khan: 'URGENT',
};

/** t2 = thứ Hai … t7 = thứ Bảy, cn = Chủ nhật. Lấy lần xuất hiện gần nhất kể từ hôm nay. */
const WEEKDAY: Record<string, number> = { t2: 1, t3: 2, t4: 3, t5: 4, t6: 5, t7: 6, cn: 0 };

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function nextWeekday(from: Date, target: number): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const diff = (target - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

export function parseQuickTask(raw: string, dicts: QuickParseDicts): QuickParseResult {
  const today = dicts.today ?? new Date();
  const out: QuickParseResult = {
    title: '',
    assigneeIds: [],
    labelIds: [],
    requiredSkills: [],
    chips: [],
    unknown: [],
  };
  const keep: string[] = [];

  for (const token of raw.split(/\s+/).filter(Boolean)) {
    const body = token.slice(1);

    // @người
    if (token.startsWith('@') && body) {
      const needle = fold(body);
      const hit = dicts.members.filter(
        (m) =>
          fold(m.shortName ?? '') === needle ||
          fold(m.fullName) === needle ||
          fold(m.fullName).split(' ').includes(needle) ||
          fold(m.fullName).replace(/\s+/g, '') === needle,
      );
      if (hit.length === 1) {
        if (!out.assigneeIds.includes(hit[0].id)) {
          out.assigneeIds.push(hit[0].id);
          out.chips.push({ kind: 'assignee', text: hit[0].shortName ?? hit[0].fullName, token });
        }
        continue;
      }
      out.unknown.push({ token, reason: hit.length > 1 ? 'trùng nhiều' : 'không tìm thấy' });
      keep.push(token);
      continue;
    }

    // #nhãn
    if (token.startsWith('#') && body) {
      const needle = fold(body);
      const hit = dicts.labels.filter((l) => fold(l.name) === needle || fold(l.name).replace(/\s+/g, '') === needle);
      if (hit.length === 1) {
        if (!out.labelIds.includes(hit[0].id)) {
          out.labelIds.push(hit[0].id);
          out.chips.push({ kind: 'label', text: `#${hit[0].name}`, token });
        }
        continue;
      }
      out.unknown.push({ token, reason: hit.length > 1 ? 'trùng nhiều' : 'không tìm thấy' });
      keep.push(token);
      continue;
    }

    // !ưu tiên
    if (token.startsWith('!') && body) {
      const p = PRIORITY_WORDS[fold(body).replace(/\s+/g, '')];
      if (p) {
        out.priority = p;
        out.chips = out.chips.filter((c) => c.kind !== 'priority');
        out.chips.push({ kind: 'priority', text: `ưu tiên ${body}`, token });
        continue;
      }
      out.unknown.push({ token, reason: 'không tìm thấy' });
      keep.push(token);
      continue;
    }

    // ~kỹ năng>=mức  (cho phép cả ~k:react>=3)
    if (token.startsWith('~') && body) {
      const m = /^(?:k:)?(.+?)(?:>=?|≥)(\d)$/.exec(body) ?? /^(?:k:)?(.+)$/.exec(body);
      const name = m?.[1] ?? '';
      const level = m && m[2] ? Number(m[2]) : 2;
      const needle = fold(name);
      const hit = dicts.skills.filter((s) => fold(s.name) === needle || fold(s.name).replace(/\s+/g, '') === needle);
      if (hit.length === 1 && level >= 1 && level <= 5) {
        if (!out.requiredSkills.some((s) => s.skillId === hit[0].id)) {
          out.requiredSkills.push({ skillId: hit[0].id, minLevel: level });
          out.chips.push({ kind: 'skill', text: `${hit[0].name} ≥ ${level}`, token });
        }
        continue;
      }
      out.unknown.push({ token, reason: hit.length > 1 ? 'trùng nhiều' : 'không tìm thấy' });
      keep.push(token);
      continue;
    }

    // 4h / 2.5h / 2,5h
    const hours = /^(\d+(?:[.,]\d+)?)h$/i.exec(token);
    if (hours) {
      const v = Number(hours[1].replace(',', '.'));
      if (v > 0 && v <= 400) {
        out.estimateHours = v;
        out.chips = out.chips.filter((c) => c.kind !== 'estimate');
        out.chips.push({ kind: 'estimate', text: `${v}h`, token });
        continue;
      }
    }

    // hạn: t2..t7, cn, hnay, mai, dd/mm, dd/mm/yyyy
    const low = fold(token);
    let due: Date | null = null;
    if (low === 'hnay') due = today;
    else if (low === 'mai') due = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    else if (WEEKDAY[low] !== undefined) due = nextWeekday(today, WEEKDAY[low]);
    else {
      const d = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(token);
      if (d) {
        const year = d[3] ? Number(d[3]) : today.getFullYear();
        const cand = new Date(year, Number(d[2]) - 1, Number(d[1]));
        // Ngày thật sự tồn tại (31/02 không tính) và đúng như đã gõ
        if (cand.getMonth() === Number(d[2]) - 1 && cand.getDate() === Number(d[1])) due = cand;
      }
    }
    if (due) {
      out.dueDate = isoDay(due);
      out.chips = out.chips.filter((c) => c.kind !== 'due');
      out.chips.push({ kind: 'due', text: `hạn ${pad(due.getDate())}/${pad(due.getMonth() + 1)}`, token });
      continue;
    }

    keep.push(token);
  }

  out.title = keep.join(' ').trim();
  return out;
}
