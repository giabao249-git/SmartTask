import {
  addDays,
  isWorkday,
  toDate,
  workdaysBetween,
  type WorkCalendar,
} from './calendar';

/** Task tối thiểu cho phân bổ giờ. */
export interface AllocTask {
  id: string;
  estimateHours: number | null;
  remainingHours: number | null;
  progress: number;
  startDate: Date | null;
  dueDate: Date | null;
  createdAt: Date;
  completedAt: Date | null;
  /** Hạn thay thế khi task không có hạn: ngày kết thúc sprint */
  sprintEndDate?: Date | null;
}

/** remaining_hours nếu người dùng nhập, ngược lại estimate × (1 − progress). Task xong = 0. */
export function remainingOf(t: AllocTask): number {
  if (t.completedAt) return 0;
  if (t.remainingHours !== null && t.remainingHours !== undefined)
    return Math.max(0, t.remainingHours);
  if (t.estimateHours === null || t.estimateHours === undefined) return 0;
  return Math.max(0, t.estimateHours * (1 - t.progress / 100));
}

/** Khoảng phân bổ [start*, due*] theo docs 04 §1. */
export function effectiveWindow(
  t: AllocTask,
  today: Date,
  cal: WorkCalendar,
): { start: Date; end: Date; overdue: boolean } {
  const td = toDate(today);
  const start = t.startDate
    ? toDate(t.startDate)
    : new Date(Math.max(toDate(t.createdAt).getTime(), td.getTime()));
  let end: Date;
  if (t.dueDate) end = toDate(t.dueDate);
  else if (t.sprintEndDate) end = toDate(t.sprintEndDate);
  else end = addWorkdays(start, 5, cal);
  const overdue = end.getTime() < td.getTime();
  return { start: start.getTime() > end.getTime() ? end : start, end, overdue };
}

export function addWorkdays(from: Date, n: number, cal: WorkCalendar): Date {
  let d = toDate(from);
  let left = n;
  while (left > 0) {
    d = addDays(d, 1);
    if (isWorkday(d, cal)) left -= 1;
  }
  return d;
}

/** Phần giờ của task rơi vào tuần [weekStart, weekStart+6]: chia đều theo ngày làm việc; quá hạn dồn hết vào tuần hiện tại. */
export function shareInWeek(
  t: AllocTask,
  weekStart: Date,
  today: Date,
  cal: WorkCalendar,
): number {
  const w0 = toDate(weekStart);
  const w1 = addDays(w0, 6);
  const { start, end, overdue } = effectiveWindow(t, today, cal);
  const td = toDate(today);
  if (overdue) {
    const thisWeek0 = addDays(td, -(isoWeekdayOf(td) - 1));
    return w0.getTime() === thisWeek0.getTime() ? 1 : 0;
  }
  // phần việc chưa làm chỉ phân bổ từ hôm nay trở đi (quá khứ của cửa sổ đã trôi qua)
  const from = start.getTime() < td.getTime() ? td : start;
  const total = workdaysBetween(from, end, cal);
  if (total === 0) {
    // khoảng không còn ngày làm việc (hạn = hôm nay là cuối tuần…): dồn vào tuần chứa hạn
    return w0.getTime() <= end.getTime() && end.getTime() <= w1.getTime()
      ? 1
      : 0;
  }
  const overlapStart = from.getTime() > w0.getTime() ? from : w0;
  const overlapEnd = end.getTime() < w1.getTime() ? end : w1;
  if (overlapStart.getTime() > overlapEnd.getTime()) return 0;
  return workdaysBetween(overlapStart, overlapEnd, cal) / total;
}

/** Phần giờ của task rơi vào một ngày cụ thể (cho bảng giờ trống theo ngày). */
export function shareInDay(
  t: AllocTask,
  day: Date,
  today: Date,
  cal: WorkCalendar,
): number {
  const d = toDate(day);
  if (!isWorkday(d, cal)) return 0;
  const { start, end, overdue } = effectiveWindow(t, today, cal);
  const td = toDate(today);
  if (overdue) return d.getTime() === td.getTime() ? 1 : 0;
  const from = start.getTime() < td.getTime() ? td : start;
  if (d.getTime() < from.getTime() || d.getTime() > end.getTime()) return 0;
  const total = workdaysBetween(from, end, cal);
  return total === 0 ? 0 : 1 / total;
}

function isoWeekdayOf(d: Date): number {
  const w = d.getUTCDay();
  return w === 0 ? 7 : w;
}
