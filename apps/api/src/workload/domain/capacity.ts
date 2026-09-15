import {
  addDays,
  daysBetween,
  isWorkday,
  toDate,
  weekEndOf,
  type WorkCalendar,
} from './calendar';

export interface BusyEvent {
  startAt: Date;
  endAt: Date;
}

export interface TimeOff {
  fromDate: Date;
  toDate: Date;
  kind: 'LEAVE' | 'HOLIDAY' | 'PARTIAL' | 'RECURRING';
  hoursPerDay: number | null;
}

export interface WorkHours {
  start: string; // "08:00"
  end: string; // "17:30"
}

export function hoursPerDay(baseHours: number, cal: WorkCalendar): number {
  const n = cal.workdays.length || 5;
  return baseHours / n;
}

/** Giờ bận trong giờ làm việc của một ngày, gộp khoảng chồng nhau. */
export function busyHoursOnDay(
  day: Date,
  events: BusyEvent[],
  wh: WorkHours,
): number {
  const d = toDate(day);
  const dayStart = d.getTime() + hm(wh.start);
  const dayEnd = d.getTime() + hm(wh.end);
  const intervals = events
    .map(
      (e) =>
        [
          Math.max(e.startAt.getTime(), dayStart),
          Math.min(e.endAt.getTime(), dayEnd),
        ] as [number, number],
    )
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cur: [number, number] | null = null;
  for (const iv of intervals) {
    if (!cur || iv[0] > cur[1]) {
      if (cur) total += cur[1] - cur[0];
      cur = [iv[0], iv[1]];
    } else cur[1] = Math.max(cur[1], iv[1]);
  }
  if (cur) total += cur[1] - cur[0];
  return total / 3_600_000;
}

/** Số khối liên tục ≥ minHours trong giờ làm việc không bị khoảng bận cắt. */
export function focusBlocksOnDay(
  day: Date,
  events: BusyEvent[],
  wh: WorkHours,
  minHours = 2,
): number {
  const d = toDate(day);
  const dayStart = d.getTime() + hm(wh.start);
  const dayEnd = d.getTime() + hm(wh.end);
  const busy = events
    .map(
      (e) =>
        [
          Math.max(e.startAt.getTime(), dayStart),
          Math.min(e.endAt.getTime(), dayEnd),
        ] as [number, number],
    )
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  let blocks = 0;
  let cursor = dayStart;
  for (const [s, e] of busy) {
    if (s - cursor >= minHours * 3_600_000) blocks += 1;
    cursor = Math.max(cursor, e);
  }
  if (dayEnd - cursor >= minHours * 3_600_000) blocks += 1;
  return blocks;
}

/** Giờ nghỉ trong một ngày: LEAVE/HOLIDAY = cả ngày; PARTIAL = hours_per_day. */
export function timeOffHoursOnDay(
  day: Date,
  offs: TimeOff[],
  perDay: number,
): number {
  const d = toDate(day).getTime();
  let h = 0;
  for (const o of offs) {
    if (d < toDate(o.fromDate).getTime() || d > toDate(o.toDate).getTime())
      continue;
    h = Math.max(
      h,
      o.kind === 'PARTIAL' ? Math.min(perDay, o.hoursPerDay ?? 0) : perDay,
    );
  }
  return h;
}

export interface WeekCapacity {
  baseHours: number;
  meetingHours: number;
  timeOffHours: number;
  adminHours: number;
  effCapacityHours: number;
}

/** EffCap = Base − họp − nghỉ − admin × Base (docs 04 §3) */
export function weekCapacity(
  weekStart: Date,
  baseHours: number,
  events: BusyEvent[],
  offs: TimeOff[],
  cal: WorkCalendar,
  wh: WorkHours,
  adminOverhead: number,
): WeekCapacity {
  const perDay = hoursPerDay(baseHours, cal);
  let meeting = 0;
  let off = 0;
  for (const day of daysBetween(weekStart, weekEndOf(weekStart))) {
    if (!isWorkday(day, cal)) continue;
    const o = timeOffHoursOnDay(day, offs, perDay);
    off += o;
    meeting += Math.min(perDay - o, busyHoursOnDay(day, events, wh));
  }
  const adminHours = adminOverhead * baseHours;
  return {
    baseHours,
    meetingHours: round2(meeting),
    timeOffHours: round2(off),
    adminHours: round2(adminHours),
    effCapacityHours: round2(
      Math.max(0, baseHours - meeting - off - adminHours),
    ),
  };
}

export function freeHoursOnDay(
  day: Date,
  baseHours: number,
  events: BusyEvent[],
  offs: TimeOff[],
  plannedHours: number,
  cal: WorkCalendar,
  wh: WorkHours,
): number {
  if (!isWorkday(day, cal)) return 0;
  const perDay = hoursPerDay(baseHours, cal);
  const off = timeOffHoursOnDay(day, offs, perDay);
  const busy = Math.min(perDay - off, busyHoursOnDay(day, events, wh));
  return round2(Math.max(0, perDay - off - busy - plannedHours));
}

function hm(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return ((h || 0) * 60 + (m || 0)) * 60_000;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export { addDays };
