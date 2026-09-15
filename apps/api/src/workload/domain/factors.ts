/** Hệ số lịch sử và bản chất việc (docs 04 §2–3). */

/** EAR làm mượt Bayes về 1.0: (Σactual + k) / (Σestimate + k). Không có mẫu → 1.0 */
export function earBayes(
  actualSum: number,
  estimateSum: number,
  k = 20,
): number {
  if (estimateSum <= 0 && actualSum <= 0) return 1;
  return (actualSum + k) / (estimateSum + k);
}

/** 1 + 0.10 × (difficulty − 3) → 0.8 … 1.2 */
export function difficultyFactor(difficulty: number): number {
  const d = Math.min(5, Math.max(1, difficulty || 3));
  return 1 + 0.1 * (d - 3);
}

/** 1.00 đủ mức · 1.15 thiếu 1 bậc · 1.30 thiếu ≥ 2 bậc hoặc không có kỹ năng. Không yêu cầu kỹ năng → 1. */
export function skillGapFactor(
  userLevels: Map<string, number>,
  required: Array<{ skillId: string; minLevel: number }>,
): number {
  let worst = 0;
  for (const r of required) {
    const lv = userLevels.get(r.skillId) ?? 0;
    const gap = Math.max(0, r.minLevel - lv);
    worst = Math.max(worst, lv === 0 ? 2 : gap);
  }
  if (worst === 0) return 1;
  if (worst === 1) return 1.15;
  return 1.3;
}

/** Phạt chuyển ngữ cảnh: 1 + 0.05 × max(0, số dự án có việc mở − 1) */
export function switchPenalty(projectsOpen: number): number {
  return 1 + 0.05 * Math.max(0, projectsOpen - 1);
}

export function hoursEff(
  remaining: number,
  ear: number,
  difficulty: number,
  skillGap: number,
): number {
  return remaining * ear * difficultyFactor(difficulty) * skillGap;
}
