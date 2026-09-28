/**
 * Hồ sơ kỹ năng TỪ BẰNG CHỨNG (docs 02/08, docs 04 §2b) — thay cho mức tự khai khi AI chia việc.
 *
 * Mỗi việc ĐÃ XONG có yêu cầu kỹ năng s ở mức m là một bằng chứng cho từng người làm nó:
 *   - đạt   : không bị mở lại, không sinh bug (bug gắn việc gốc), đánh giá ≥ 3 (hoặc chưa đánh giá)
 *   - trượt : bị mở lại, có bug gốc, hoặc đánh giá ≤ 2
 *   - mức thể hiện = m; làm tốt (đánh giá ≥ 4) việc thực tế khó hơn yêu cầu → m + 1
 *   - trọng số: có đánh giá của PM = 1, chưa đánh giá = 0,5; nhiều người làm thì chia đều
 * PM xác nhận mức trong hồ sơ kỹ năng cũng là một bằng chứng (trọng số 1) — mức TỰ KHAI thì không.
 *
 * Mức(u, s) = L lớn nhất mà, trong các bằng chứng có mức thể hiện ≥ L: tổng trọng số ĐẠT ≥ 1 và NHIỀU HƠN tổng
 * trọng số TRƯỢT (việc phải làm lại là tín hiệu thật nhưng không xoá sạch các việc làm tốt).
 * Hàm thuần, không xếp hạng người — chỉ trả sự thật kèm số liệu để validator/LLM/giao diện trích dẫn.
 */

export interface EvidenceItem {
  userId: string;
  skillId: string;
  /** Mức kỹ năng việc yêu cầu (task_skills.min_level) hoặc mức PM xác nhận */
  required: number;
  source: 'task' | 'verified';
  taskId?: string;
  /** Độ khó thực tế (đánh giá) hoặc độ khó lúc lập kế hoạch */
  difficulty?: number;
  /** null = chưa có đánh giá của người khác (tự chấm không tính) */
  rating: number | null;
  reopened: number;
  bugs: number;
  /** Phần ghi nhận khi nhiều người cùng làm (1 / số người) */
  share: number;
  at: Date;
}

export type Confidence = 'none' | 'low' | 'medium' | 'high';

export interface SkillEvidence {
  skillId: string;
  /** 0 = chưa đủ bằng chứng */
  level: number;
  confidence: Confidence;
  /** Số việc đã xong dùng kỹ năng này (kể cả trượt) */
  tasks: number;
  passed: number;
  failed: number;
  reviewed: number;
  verified: boolean;
  lastAt: Date | null;
}

export const PASS_THRESHOLD = 1;
const UNREVIEWED_WEIGHT = 0.5;

export function demonstrated(e: EvidenceItem): number {
  if (e.source === 'verified') return clamp(e.required);
  const bonus =
    e.rating !== null && e.rating >= 4 && (e.difficulty ?? 0) > e.required
      ? 1
      : 0;
  return clamp(e.required + bonus);
}

export function passedOf(e: EvidenceItem): boolean {
  if (e.source === 'verified') return true;
  return (
    e.reopened === 0 && e.bugs === 0 && (e.rating === null || e.rating >= 3)
  );
}

export function weightOf(e: EvidenceItem): number {
  if (e.source === 'verified') return 1;
  return (e.rating === null ? UNREVIEWED_WEIGHT : 1) * e.share;
}

/** Một người, một kỹ năng. */
export function skillEvidence(
  skillId: string,
  items: EvidenceItem[],
): SkillEvidence {
  let level = 0;
  for (let L = 5; L >= 1; L--) {
    const at = items.filter((e) => demonstrated(e) >= L);
    const pass = at.filter(passedOf).reduce((s, e) => s + weightOf(e), 0);
    const fail = at
      .filter((e) => !passedOf(e))
      .reduce((s, e) => s + weightOf(e), 0);
    if (pass >= PASS_THRESHOLD - 1e-9 && pass > fail + 1e-9) {
      level = L;
      break;
    }
  }
  const tasks = items.filter((e) => e.source === 'task');
  const credit = items.filter(passedOf).reduce((s, e) => s + weightOf(e), 0);
  const confidence: Confidence =
    items.length === 0
      ? 'none'
      : credit >= 4
        ? 'high'
        : credit >= 2
          ? 'medium'
          : 'low';
  const last = items.reduce<Date | null>(
    (m, e) => (!m || e.at > m ? e.at : m),
    null,
  );
  return {
    skillId,
    level,
    confidence,
    tasks: tasks.length,
    passed: tasks.filter(passedOf).length,
    failed: tasks.filter((e) => !passedOf(e)).length,
    reviewed: tasks.filter((e) => e.rating !== null).length,
    verified: items.some((e) => e.source === 'verified'),
    lastAt: last,
  };
}

/**
 * Bằng chứng có KẾT LUẬN: đạt được một mức, hoặc có việc phải làm lại. Chỉ có nửa ghi nhận (làm chung/chưa
 * đánh giá) mà chưa đủ một mức thì vẫn là "chưa biết" — không được coi là thiếu kỹ năng.
 */
export function isConclusive(
  e: Pick<SkillEvidence, 'level' | 'failed'>,
): boolean {
  return e.level > 0 || e.failed > 0;
}

/** Gom theo (người, kỹ năng). */
export function buildProfiles(
  items: EvidenceItem[],
): Map<string, Map<string, SkillEvidence>> {
  const groups = new Map<string, Map<string, EvidenceItem[]>>();
  for (const e of items) {
    if (!groups.has(e.userId)) groups.set(e.userId, new Map());
    const g = groups.get(e.userId)!;
    g.set(e.skillId, [...(g.get(e.skillId) ?? []), e]);
  }
  const out = new Map<string, Map<string, SkillEvidence>>();
  for (const [u, bySkill] of groups) {
    const m = new Map<string, SkillEvidence>();
    for (const [s, xs] of bySkill) m.set(s, skillEvidence(s, xs));
    out.set(u, m);
  }
  return out;
}

/** Nhãn ngắn để trích dẫn: "NestJS 3 · 4 việc · 20/09" / "chưa có bằng chứng". */
export function evidenceText(e: SkillEvidence | undefined): string {
  if (!e || e.confidence === 'none') return 'chưa có bằng chứng';
  const parts = [
    e.tasks
      ? `${e.tasks} việc${e.failed ? ` (${e.failed} phải làm lại)` : ''}`
      : null,
    e.verified ? 'PM xác nhận' : null,
    e.lastAt
      ? `gần nhất ${String(e.lastAt.getUTCDate()).padStart(2, '0')}/${String(e.lastAt.getUTCMonth() + 1).padStart(2, '0')}`
      : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

const clamp = (n: number) => Math.max(1, Math.min(5, Math.round(n)));
