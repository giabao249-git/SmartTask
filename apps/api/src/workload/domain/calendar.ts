/** Lịch làm việc thuần: ngày làm việc theo settings (workdays 1=T2…7=CN, holidays YYYY-MM-DD). Mọi ngày là UTC-midnight. */
export interface WorkCalendar {
  workdays: number[];
  holidays: string[];
}

export const DAY_MS = 86_400_000;

export function toDate(d: Date | string): Date {
  const x = typeof d === 'string' ? new Date(d) : d;
  return new Date(
    Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()),
  );
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

/** 1 = Thứ Hai … 7 = Chủ nhật */
export function isoWeekday(d: Date): number {
  const w = d.getUTCDay();
  return w === 0 ? 7 : w;
}

export function isWorkday(d: Date, cal: WorkCalendar): boolean {
  return (
    cal.workdays.includes(isoWeekday(d)) && !cal.holidays.includes(isoDate(d))
  );
}

/** Số ngày làm việc trong [start, end] (bao gồm hai đầu); start > end → 0 */
export function workdaysBetween(
  start: Date,
  end: Date,
  cal: WorkCalendar,
): number {
  let n = 0;
  for (
    let d = toDate(start);
    d.getTime() <= toDate(end).getTime();
    d = addDays(d, 1)
  )
    if (isWorkday(d, cal)) n += 1;
  return n;
}

/** Thứ Hai của tuần chứa d */
export function weekStartOf(d: Date): Date {
  const x = toDate(d);
  return addDays(x, -(isoWeekday(x) - 1));
}

export function weekEndOf(weekStart: Date): Date {
  return addDays(weekStart, 6);
}

export function weeksFrom(from: Date, count: number): Date[] {
  const first = weekStartOf(from);
  return Array.from({ length: count }, (_, i) => addDays(first, 7 * i));
}

export function daysBetween(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  for (
    let d = toDate(start);
    d.getTime() <= toDate(end).getTime();
    d = addDays(d, 1)
  )
    out.push(d);
  return out;
}
