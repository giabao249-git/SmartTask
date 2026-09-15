export interface BurnoutWeights {
  utilization: number;
  consecutiveWeeks: number;
  overdue: number;
  slowingDown: number;
  onTime: number;
  checkin: number;
  alertAt: number;
  watchAt: number;
}

export interface BurnoutInputs {
  utilization: number;
  consecutiveHighWeeks: number;
  overdueTasks: number;
  openTasks: number;
  ear4w: number | null;
  ear8w: number | null;
  onTimeRate: number | null;
  lowCheckinTwice: boolean;
}

export interface BurnoutResult {
  score: number;
  label: 'NORMAL' | 'WATCH' | 'BURNOUT_RISK';
  breakdown: Record<string, number>;
}

/** docs 04 §4 — mỗi hạng tử lưu riêng để giao diện giải thích "vì sao". */
export function burnoutScore(
  i: BurnoutInputs,
  w: BurnoutWeights,
): BurnoutResult {
  const u = Number.isFinite(i.utilization) ? i.utilization : 2;
  const b = {
    utilization: w.utilization * Math.min(u / 1.2, 1),
    consecutiveWeeks:
      w.consecutiveWeeks * Math.min(i.consecutiveHighWeeks / 3, 1),
    overdue: w.overdue * (i.openTasks > 0 ? i.overdueTasks / i.openTasks : 0),
    slowingDown:
      i.ear4w !== null && i.ear8w !== null
        ? w.slowingDown * Math.min(Math.max(0, i.ear4w - i.ear8w) * 2, 1)
        : 0,
    onTime:
      i.onTimeRate === null ? 0 : w.onTime * Math.max(0, 1 - i.onTimeRate),
    checkin: i.lowCheckinTwice ? w.checkin : 0,
  };
  const score = Math.round(Object.values(b).reduce((s, x) => s + x, 0));
  const label =
    score >= w.alertAt
      ? 'BURNOUT_RISK'
      : score >= w.watchAt
        ? 'WATCH'
        : 'NORMAL';
  return {
    score,
    label,
    breakdown: Object.fromEntries(
      Object.entries(b).map(([k, v]) => [k, Math.round(v * 10) / 10]),
    ),
  };
}
