import {
  addDays,
  isWorkday,
  toDate,
  workdaysBetween,
  type WorkCalendar,
} from '../../workload/domain/calendar';

export interface Snapshot {
  date: Date;
  scopeHours: number;
  remainingHours: number;
  completedHours: number;
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';

/** Đường lý tưởng: Scope0 × (1 − workdays(start..d) / workdays(start..end)) cho từng ngày của sprint. */
export function idealLine(
  scope0: number,
  start: Date,
  end: Date,
  cal: WorkCalendar,
): Array<{ date: string; ideal: number }> {
  const total = Math.max(1, workdaysBetween(start, end, cal));
  const out: Array<{ date: string; ideal: number }> = [];
  for (
    let d = toDate(start);
    d.getTime() <= toDate(end).getTime();
    d = addDays(d, 1)
  ) {
    const done = workdaysBetween(start, d, cal);
    out.push({
      date: d.toISOString().slice(0, 10),
      ideal: Math.round(scope0 * (1 - done / total) * 100) / 100,
    });
  }
  return out;
}

/** Vận tốc = trung bình giờ hoàn thành / ngày làm việc trong N ngày làm việc gần nhất (mặc định 5); < 5 ngày thì lấy từ đầu sprint. */
export function velocityOf(
  snapshots: Snapshot[],
  cal: WorkCalendar,
  lastN = 5,
): number {
  const work = snapshots
    .filter((s) => isWorkday(toDate(s.date), cal))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  if (!work.length) return 0;
  const window = work.slice(-lastN);
  const sum = window.reduce((s, x) => s + Math.max(0, x.completedHours), 0);
  return Math.round((sum / window.length) * 100) / 100;
}

/** ETA = hôm nay + ceil(remaining / velocity) ngày làm việc; velocity 0 → null */
export function etaOf(
  remaining: number,
  velocity: number,
  today: Date,
  cal: WorkCalendar,
): Date | null {
  if (remaining <= 0) return toDate(today);
  if (velocity <= 0) return null;
  const days = Math.ceil(remaining / velocity);
  let d = toDate(today);
  let left = days;
  while (left > 0) {
    d = addDays(d, 1);
    if (isWorkday(d, cal)) left -= 1;
  }
  return d;
}

/** docs 04 §8 */
export function riskOf(
  eta: Date | null,
  end: Date,
  velocity: number,
  sprintAgeWorkdays: number,
): RiskLevel {
  if (sprintAgeWorkdays < 3) return 'UNKNOWN';
  if (!eta) return velocity <= 0 ? 'HIGH' : 'UNKNOWN';
  const diff = (toDate(eta).getTime() - toDate(end).getTime()) / 86_400_000;
  if (diff <= -1) return 'LOW';
  if (Math.abs(diff) <= 1) return 'MEDIUM';
  return 'HIGH';
}

export function scopeCreepDays(
  snapshots: Snapshot[],
  scope0: number,
  threshold = 1.1,
): string[] {
  if (scope0 <= 0) return [];
  return snapshots
    .filter((s) => s.scopeHours > threshold * scope0)
    .map((s) => s.date.toISOString().slice(0, 10));
}
