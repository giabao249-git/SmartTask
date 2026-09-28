import {
  effectiveWindow,
  remainingOf,
  shareInDay,
  shareInWeek,
  type AllocTask,
} from './allocation';
import { toDate, weekStartOf, workdaysBetween } from './calendar';
import {
  busyHoursOnDay,
  capacityInRange,
  focusBlocksOnDay,
  freeHoursOnDay,
  weekCapacity,
} from './capacity';
import { burnoutScore } from './burnout';
import {
  difficultyFactor,
  earBayes,
  hoursEff,
  skillGapFactor,
  switchPenalty,
} from './factors';
import { skillMatch } from './skill-match';
import { levelOf, spreadOf, utilizationOf } from './utilization';

const cal = { workdays: [1, 2, 3, 4, 5], holidays: ['2026-10-20'] };
const wh = { start: '08:00', end: '17:30' };
const today = toDate('2026-10-14'); // Thứ Tư
const task = (p: Partial<AllocTask>): AllocTask => ({
  id: 't',
  estimateHours: 10,
  remainingHours: null,
  progress: 0,
  startDate: null,
  dueDate: null,
  createdAt: toDate('2026-10-01'),
  completedAt: null,
  ...p,
});

describe('lịch làm việc', () => {
  it('đếm ngày làm việc bỏ cuối tuần và ngày lễ', () => {
    expect(
      workdaysBetween(toDate('2026-10-19'), toDate('2026-10-23'), cal),
    ).toBe(4); // 20/10 lễ
    expect(
      workdaysBetween(toDate('2026-10-17'), toDate('2026-10-18'), cal),
    ).toBe(0); // T7, CN
    expect(weekStartOf(toDate('2026-10-14')).toISOString().slice(0, 10)).toBe(
      '2026-10-12',
    );
  });
});

describe('phân bổ giờ theo tuần (docs 04 §1)', () => {
  it('remaining: nhập tay > estimate × (1 − progress); task xong = 0', () => {
    expect(remainingOf(task({ estimateHours: 10, progress: 30 }))).toBe(7);
    expect(remainingOf(task({ remainingHours: 4, progress: 30 }))).toBe(4);
    expect(remainingOf(task({ completedAt: new Date() }))).toBe(0);
  });

  it('task trong một tuần → 100% tuần đó', () => {
    const t = task({
      startDate: toDate('2026-10-14'),
      dueDate: toDate('2026-10-16'),
    });
    expect(shareInWeek(t, toDate('2026-10-12'), today, cal)).toBe(1);
    expect(shareInWeek(t, toDate('2026-10-19'), today, cal)).toBe(0);
  });

  it('task cắt qua hai tuần chia theo ngày làm việc (có ngày lễ)', () => {
    const t = task({
      startDate: toDate('2026-10-14'),
      dueDate: toDate('2026-10-23'),
    }); // 14,15,16 | 19,21,22,23 (20 lễ) = 7 ngày
    expect(shareInWeek(t, toDate('2026-10-12'), today, cal)).toBeCloseTo(
      3 / 7,
      5,
    );
    expect(shareInWeek(t, toDate('2026-10-19'), today, cal)).toBeCloseTo(
      4 / 7,
      5,
    );
  });

  it('task quá hạn dồn 100% vào tuần hiện tại', () => {
    const t = task({
      startDate: toDate('2026-10-01'),
      dueDate: toDate('2026-10-09'),
    });
    expect(effectiveWindow(t, today, cal).overdue).toBe(true);
    expect(shareInWeek(t, toDate('2026-10-12'), today, cal)).toBe(1);
    expect(shareInWeek(t, toDate('2026-10-19'), today, cal)).toBe(0);
  });

  it('không có ngày bắt đầu → max(createdAt, hôm nay); không hạn → +5 ngày làm việc', () => {
    const t = task({});
    const w = effectiveWindow(t, today, cal);
    expect(w.start.toISOString().slice(0, 10)).toBe('2026-10-14');
    expect(w.end.toISOString().slice(0, 10)).toBe('2026-10-22'); // 15,16,19,21,22 (20 lễ)
    expect(shareInDay(t, toDate('2026-10-20'), today, cal)).toBe(0); // ngày lễ
    expect(shareInDay(t, toDate('2026-10-15'), today, cal)).toBeCloseTo(
      1 / 6,
      5,
    );
  });
});

describe('hệ số (docs 04 §2–3)', () => {
  it('EAR làm mượt Bayes: không mẫu = 1; 1 task trễ 3× không thành 3', () => {
    expect(earBayes(0, 0)).toBe(1);
    expect(earBayes(24, 8)).toBeCloseTo(44 / 28, 5); // ≈ 1.57 chứ không phải 3
    expect(earBayes(240, 200, 20)).toBeCloseTo(260 / 220, 5);
  });
  it('độ khó 1–5 → 0.8–1.2; thiếu kỹ năng 1.15/1.30; phạt dự án', () => {
    expect(difficultyFactor(1)).toBeCloseTo(0.8);
    expect(difficultyFactor(5)).toBeCloseTo(1.2);
    const lv = new Map([
      ['react', 3],
      ['nest', 1],
    ]);
    expect(skillGapFactor(lv, [{ skillId: 'react', minLevel: 3 }])).toBe(1);
    expect(skillGapFactor(lv, [{ skillId: 'react', minLevel: 4 }])).toBe(1.15);
    expect(skillGapFactor(lv, [{ skillId: 'nest', minLevel: 3 }])).toBe(1.3);
    expect(skillGapFactor(lv, [{ skillId: 'docker', minLevel: 1 }])).toBe(1.3);
    expect(switchPenalty(1)).toBe(1);
    expect(switchPenalty(3)).toBeCloseTo(1.1);
  });
  it('ví dụ Minh vs Lan trong tài liệu', () => {
    expect(hoursEff(32, 0.9, 3, 1)).toBeCloseTo(28.8);
    expect(hoursEff(32, 1.4, 4, 1) * switchPenalty(3)).toBeCloseTo(54.2, 1);
  });
});

describe('năng lực hiệu dụng (docs 04 §3, §5)', () => {
  const ev = (s: string, e: string) => ({
    startAt: new Date(s),
    endAt: new Date(e),
  });
  it('họp chồng nhau gộp lại, cắt theo giờ làm việc', () => {
    const day = toDate('2026-10-14');
    const events = [
      ev('2026-10-14T09:00:00Z', '2026-10-14T11:00:00Z'),
      ev('2026-10-14T10:00:00Z', '2026-10-14T12:00:00Z'),
      ev('2026-10-14T17:00:00Z', '2026-10-14T19:00:00Z'),
    ];
    expect(busyHoursOnDay(day, events, wh)).toBeCloseTo(3.5); // 09–12 = 3h, 17:00–17:30 = 0.5h
    expect(focusBlocksOnDay(day, events, wh)).toBe(1); // 12:00–17:00 = 5h; 08–09 chỉ 1h
  });
  it('EffCap tuần = 40 − họp − nghỉ − 10%: nghỉ cả ngày và nửa ngày', () => {
    const offs = [
      {
        fromDate: toDate('2026-10-16'),
        toDate: toDate('2026-10-16'),
        kind: 'LEAVE' as const,
        hoursPerDay: null,
      },
      {
        fromDate: toDate('2026-10-13'),
        toDate: toDate('2026-10-13'),
        kind: 'PARTIAL' as const,
        hoursPerDay: 4,
      },
    ];
    const c = weekCapacity(
      toDate('2026-10-12'),
      40,
      [
        ev('2026-10-14T09:00:00Z', '2026-10-11T00:00:00Z'),
        ev('2026-10-14T09:00:00Z', '2026-10-14T11:00:00Z'),
      ],
      offs,
      cal,
      wh,
      0.1,
    );
    expect(c.timeOffHours).toBe(12);
    expect(c.meetingHours).toBe(2);
    expect(c.effCapacityHours).toBe(22);
  });
  it('năng lực theo khoảng ngày = EffCap của tuần khi khoảng trùng tuần; khoảng lẻ tính đúng ngày làm việc', () => {
    const offs = [
      {
        fromDate: toDate('2026-10-13'),
        toDate: toDate('2026-10-13'),
        kind: 'PARTIAL' as const,
        hoursPerDay: 4,
      },
    ];
    const events = [ev('2026-10-14T09:00:00Z', '2026-10-14T11:00:00Z')];
    const week = weekCapacity(
      toDate('2026-10-12'),
      40,
      events,
      offs,
      cal,
      wh,
      0.1,
    );
    expect(
      capacityInRange(
        toDate('2026-10-12'),
        toDate('2026-10-18'),
        40,
        events,
        offs,
        cal,
        wh,
        0.1,
      ),
    ).toBe(week.effCapacityHours);
    // T4–T6 (ba ngày làm việc, không nghỉ; T4 có 2 h họp): 3 × (8 − 0,8) − 2
    expect(
      capacityInRange(
        toDate('2026-10-14'),
        toDate('2026-10-16'),
        40,
        events,
        offs,
        cal,
        wh,
        0.1,
      ),
    ).toBe(19.6);
  });
  it('EffCap ≤ 0 → mức sử dụng vô cực = quá tải; ngưỡng 70/90/110', () => {
    const t = { high: 0.7, full: 0.9, overload: 1.1 };
    expect(levelOf(utilizationOf(10, 0), t)).toBe('OVERLOAD');
    expect(levelOf(0.69, t)).toBe('NORMAL');
    expect(levelOf(0.7, t)).toBe('HIGH');
    expect(levelOf(0.9, t)).toBe('FULL');
    expect(levelOf(1.11, t)).toBe('OVERLOAD');
    expect(utilizationOf(28.8, 33)).toBeCloseTo(0.873, 3);
  });
  it('giờ trống theo ngày trừ họp, nghỉ, việc đã giao', () => {
    const day = toDate('2026-10-14');
    expect(
      freeHoursOnDay(
        day,
        40,
        [
          ev('2026-10-14T09:00:00Z', '2026-10-11T00:00:00Z'),
          ev('2026-10-14T14:00:00Z', '2026-10-14T16:00:00Z'),
        ],
        [],
        3,
        cal,
        wh,
      ),
    ).toBe(3);
    expect(freeHoursOnDay(toDate('2026-10-18'), 40, [], [], 0, cal, wh)).toBe(
      0,
    ); // CN
  });
});

describe('burnout, khớp kỹ năng, công bằng', () => {
  const w = {
    utilization: 35,
    consecutiveWeeks: 20,
    overdue: 15,
    slowingDown: 10,
    onTime: 10,
    checkin: 10,
    alertAt: 70,
    watchAt: 50,
  };
  it('từng hạng tử và nhãn biên 49/50/69/70', () => {
    const calm = burnoutScore(
      {
        utilization: 0.5,
        consecutiveHighWeeks: 0,
        overdueTasks: 0,
        openTasks: 5,
        ear4w: 1,
        ear8w: 1,
        onTimeRate: 1,
        lowCheckinTwice: false,
      },
      w,
    );
    expect(calm.score).toBe(15);
    expect(calm.label).toBe('NORMAL');
    const hot = burnoutScore(
      {
        utilization: 1.3,
        consecutiveHighWeeks: 3,
        overdueTasks: 2,
        openTasks: 4,
        ear4w: 1.5,
        ear8w: 1.0,
        onTimeRate: 0.5,
        lowCheckinTwice: false,
      },
      w,
    );
    expect(hot.breakdown).toEqual({
      utilization: 35,
      consecutiveWeeks: 20,
      overdue: 7.5,
      slowingDown: 10,
      onTime: 5,
      checkin: 0,
    });
    expect(hot.score).toBe(78);
    expect(hot.label).toBe('BURNOUT_RISK');
    const mid = burnoutScore(
      {
        utilization: 1.2,
        consecutiveHighWeeks: 1,
        overdueTasks: 0,
        openTasks: 3,
        ear4w: null,
        ear8w: null,
        onTimeRate: null,
        lowCheckinTwice: false,
      },
      w,
    );
    expect(mid.score).toBe(42);
    expect(mid.label).toBe('NORMAL');
    // 29.2 + 0 + 15 + 0 + 5 = 49 → NORMAL (biên dưới 50); thêm một tuần cao → 55.8 → WATCH
    expect(
      burnoutScore(
        {
          utilization: 1.0,
          consecutiveHighWeeks: 0,
          overdueTasks: 2,
          openTasks: 2,
          ear4w: 1,
          ear8w: 1,
          onTimeRate: 0.5,
          lowCheckinTwice: false,
        },
        w,
      ),
    ).toMatchObject({ score: 49, label: 'NORMAL' });
    expect(
      burnoutScore(
        {
          utilization: 1.0,
          consecutiveHighWeeks: 1,
          overdueTasks: 2,
          openTasks: 2,
          ear4w: 1,
          ear8w: 1,
          onTimeRate: 0.5,
          lowCheckinTwice: false,
        },
        w,
      ),
    ).toMatchObject({ score: 56, label: 'WATCH' });
  });
  it('khớp kỹ năng từng cặp: tỷ lệ mức đạt / yêu cầu, kẹp 1, liệt kê thiếu', () => {
    const m = skillMatch(
      new Map([
        ['a', 4],
        ['b', 1],
      ]),
      [
        { skillId: 'a', name: 'React', minLevel: 3 },
        { skillId: 'b', name: 'NestJS', minLevel: 2 },
        { skillId: 'c', name: 'Docker', minLevel: 1 },
      ],
    );
    expect(m.items.map((i) => i.ratio)).toEqual([1, 0.5, 0]);
    expect(m.avg).toBe(0.5);
    expect(m.missing).toEqual(['Docker']);
  });
  it('Spread = max − median', () => {
    expect(spreadOf([0.4, 0.62, 1.05])).toBe(0.43);
    expect(spreadOf([0.8, 0.8])).toBe(0);
    expect(spreadOf([])).toBe(0);
  });
});
