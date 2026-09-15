import { toDate } from '../../workload/domain/calendar';
import {
  etaOf,
  idealLine,
  riskOf,
  scopeCreepDays,
  velocityOf,
} from './burndown';

const cal = { workdays: [1, 2, 3, 4, 5], holidays: [] as string[] };
const snap = (d: string, scope: number, remaining: number, done: number) => ({
  date: toDate(d),
  scopeHours: scope,
  remainingHours: remaining,
  completedHours: done,
});

describe('burn-down & dự báo (docs 04 §8)', () => {
  it('đường lý tưởng giảm đều theo ngày làm việc, cuối tuần giữ nguyên', () => {
    const line = idealLine(
      100,
      toDate('2026-10-12'),
      toDate('2026-10-23'),
      cal,
    ); // 10 ngày làm việc
    expect(line[0]).toEqual({ date: '2026-10-12', ideal: 90 });
    expect(line.find((p) => p.date === '2026-10-17')!.ideal).toBe(50); // T7 = T6
    expect(line[line.length - 1]).toEqual({ date: '2026-10-23', ideal: 0 });
  });
  it('vận tốc = trung bình 5 ngày làm việc gần nhất; ETA đếm ngày làm việc', () => {
    const s = [
      snap('2026-10-12', 100, 90, 10),
      snap('2026-10-13', 100, 82, 8),
      snap('2026-10-14', 100, 70, 12),
      snap('2026-10-15', 100, 60, 10),
      snap('2026-10-16', 100, 50, 10),
      snap('2026-10-17', 100, 50, 0),
    ];
    expect(velocityOf(s, cal)).toBe(10);
    expect(
      etaOf(50, 10, toDate('2026-10-16'), cal)!.toISOString().slice(0, 10),
    ).toBe('2026-10-23');
    expect(
      etaOf(0, 10, toDate('2026-10-16'), cal)!.toISOString().slice(0, 10),
    ).toBe('2026-10-16');
    expect(etaOf(50, 0, toDate('2026-10-16'), cal)).toBeNull();
  });
  it('mức rủi ro: sớm ≥1 ngày Thấp, ±1 Trung bình, trễ Cao, vận tốc 0 sau ≥3 ngày Cao, sprint <3 ngày chưa rõ', () => {
    const end = toDate('2026-10-23');
    expect(riskOf(toDate('2026-10-22'), end, 10, 5)).toBe('LOW');
    expect(riskOf(toDate('2026-10-24'), end, 10, 5)).toBe('MEDIUM');
    expect(riskOf(toDate('2026-10-27'), end, 10, 5)).toBe('HIGH');
    expect(riskOf(null, end, 0, 5)).toBe('HIGH');
    expect(riskOf(null, end, 0, 2)).toBe('UNKNOWN');
  });
  it('scope creep khi scope > 110% ban đầu', () => {
    expect(
      scopeCreepDays(
        [snap('2026-10-12', 100, 90, 10), snap('2026-10-14', 112, 80, 5)],
        100,
      ),
    ).toEqual(['2026-10-14']);
  });
});
