import { fold, parseQuickTask, type QuickParseDicts } from './task-quick-parse';

/** 23/09/2026 là thứ Tư — mọi ca tính hạn tương đối đều neo vào ngày này cho khỏi phụ thuộc lúc chạy. */
const TODAY = new Date(2026, 8, 23);

const dicts: QuickParseDicts = {
  members: [
    { id: 'u-huy', fullName: 'Lê Đức Huy', shortName: 'Huy' },
    { id: 'u-lan', fullName: 'Nguyễn Thị Lan', shortName: 'Lan' },
    { id: 'u-minh', fullName: 'Trần Quang Minh', shortName: 'Minh' },
    { id: 'u-quang', fullName: 'Đỗ Hồng Quang', shortName: 'Quang' },
  ],
  labels: [
    { id: 'l-fe', name: 'frontend' },
    { id: 'l-be', name: 'backend' },
  ],
  skills: [
    { id: 's-react', name: 'React' },
    { id: 's-nest', name: 'NestJS' },
  ],
  today: TODAY,
};

describe('parseQuickTask', () => {
  it('bỏ dấu và hạ chữ thường khi so khớp', () => {
    expect(fold('Lê Đức Huy')).toBe('le duc huy');
    expect(fold('ĐỖ HỒNG QUANG')).toBe('do hong quang');
  });

  it('câu đầy đủ: tách đúng mọi ký hiệu, tiêu đề còn lại sạch', () => {
    const r = parseQuickTask('Sửa màn login @huy #frontend !cao 4h t6 ~react>=3', dicts);
    expect(r.title).toBe('Sửa màn login');
    expect(r.assigneeIds).toEqual(['u-huy']);
    expect(r.labelIds).toEqual(['l-fe']);
    expect(r.priority).toBe('HIGH');
    expect(r.estimateHours).toBe(4);
    expect(r.dueDate).toBe('2026-09-25'); // thứ Sáu ngay sau thứ Tư 23/09
    expect(r.requiredSkills).toEqual([{ skillId: 's-react', minLevel: 3 }]);
    expect(r.unknown).toHaveLength(0);
  });

  it('không có ký hiệu nào thì trả nguyên câu', () => {
    const r = parseQuickTask('Viết tài liệu bàn giao', dicts);
    expect(r.title).toBe('Viết tài liệu bàn giao');
    expect(r.chips).toHaveLength(0);
  });

  it('@ khớp cả tên rút gọn, họ tên đầy đủ viết liền và một phần tên — không phân biệt dấu', () => {
    expect(parseQuickTask('x @huy', dicts).assigneeIds).toEqual(['u-huy']);
    expect(parseQuickTask('x @HUY', dicts).assigneeIds).toEqual(['u-huy']);
    expect(parseQuickTask('x @leduchuy', dicts).assigneeIds).toEqual(['u-huy']);
    expect(parseQuickTask('x @duc', dicts).assigneeIds).toEqual(['u-huy']);
  });

  it('nhận nhiều người thực hiện, không trùng lặp', () => {
    const r = parseQuickTask('x @huy @lan @huy', dicts);
    expect(r.assigneeIds).toEqual(['u-huy', 'u-lan']);
    expect(r.chips.filter((c) => c.kind === 'assignee')).toHaveLength(2);
  });

  it('tên trùng nhiều người thì KHÔNG đoán, giữ nguyên trong tiêu đề và báo lại', () => {
    const r = parseQuickTask('x @quang', {
      ...dicts,
      members: [
        { id: 'u-quang', fullName: 'Đỗ Hồng Quang', shortName: 'Quang' },
        { id: 'u-minh', fullName: 'Trần Quang Minh', shortName: 'Minh' },
      ],
    });
    expect(r.assigneeIds).toEqual([]);
    expect(r.title).toBe('x @quang');
    expect(r.unknown).toEqual([{ token: '@quang', reason: 'trùng nhiều' }]);
  });

  it('người/nhãn/kỹ năng không có thật thì giữ nguyên trong tiêu đề, không bịa', () => {
    const r = parseQuickTask('x @khongco #khongco ~khongco>=2', dicts);
    expect(r.assigneeIds).toEqual([]);
    expect(r.labelIds).toEqual([]);
    expect(r.requiredSkills).toEqual([]);
    expect(r.title).toBe('x @khongco #khongco ~khongco>=2');
    expect(r.unknown.map((u) => u.reason)).toEqual(['không tìm thấy', 'không tìm thấy', 'không tìm thấy']);
  });

  it('mức ưu tiên: đủ bốn mức, tiếng Việt lẫn tiếng Anh', () => {
    expect(parseQuickTask('x !thấp', dicts).priority).toBe('LOW');
    expect(parseQuickTask('x !tb', dicts).priority).toBe('MEDIUM');
    expect(parseQuickTask('x !cao', dicts).priority).toBe('HIGH');
    expect(parseQuickTask('x !rấtcao', dicts).priority).toBe('URGENT');
    expect(parseQuickTask('x !urgent', dicts).priority).toBe('URGENT');
  });

  it('gõ ưu tiên hai lần thì lần sau thắng, chỉ còn một huy hiệu', () => {
    const r = parseQuickTask('x !thấp !cao', dicts);
    expect(r.priority).toBe('HIGH');
    expect(r.chips.filter((c) => c.kind === 'priority')).toHaveLength(1);
  });

  it('giờ ước lượng nhận cả dấu chấm và dấu phẩy, chặn giá trị vô lý', () => {
    expect(parseQuickTask('x 4h', dicts).estimateHours).toBe(4);
    expect(parseQuickTask('x 2.5h', dicts).estimateHours).toBe(2.5);
    expect(parseQuickTask('x 2,5h', dicts).estimateHours).toBe(2.5);
    const tooBig = parseQuickTask('x 999h', dicts);
    expect(tooBig.estimateHours).toBeUndefined();
    expect(tooBig.title).toBe('x 999h');
  });

  it('hạn theo thứ trong tuần tính từ hôm nay, hôm nay tính là lần gần nhất', () => {
    expect(parseQuickTask('x t4', dicts).dueDate).toBe('2026-09-23'); // đúng hôm nay là thứ Tư
    expect(parseQuickTask('x t5', dicts).dueDate).toBe('2026-09-24');
    expect(parseQuickTask('x t2', dicts).dueDate).toBe('2026-09-28');
    expect(parseQuickTask('x cn', dicts).dueDate).toBe('2026-09-27');
    expect(parseQuickTask('x hnay', dicts).dueDate).toBe('2026-09-23');
    expect(parseQuickTask('x mai', dicts).dueDate).toBe('2026-09-24');
  });

  it('hạn theo ngày/tháng, có cả dạng đủ năm; ngày không tồn tại thì bỏ qua', () => {
    expect(parseQuickTask('x 25/10', dicts).dueDate).toBe('2026-10-25');
    expect(parseQuickTask('x 05/01/2027', dicts).dueDate).toBe('2027-01-05');
    const bad = parseQuickTask('x 31/02', dicts);
    expect(bad.dueDate).toBeUndefined();
    expect(bad.title).toBe('x 31/02');
  });

  it('kỹ năng: mặc định mức 2, nhận cả ~k: và ≥, chặn mức ngoài 1–5', () => {
    expect(parseQuickTask('x ~react', dicts).requiredSkills).toEqual([{ skillId: 's-react', minLevel: 2 }]);
    expect(parseQuickTask('x ~k:nestjs>=4', dicts).requiredSkills).toEqual([{ skillId: 's-nest', minLevel: 4 }]);
    expect(parseQuickTask('x ~react≥5', dicts).requiredSkills).toEqual([{ skillId: 's-react', minLevel: 5 }]);
    expect(parseQuickTask('x ~react>=9', dicts).requiredSkills).toEqual([]);
  });

  it('ký hiệu trơ trọi không có phần thân thì coi như chữ thường', () => {
    const r = parseQuickTask('Giá @ # ! ~ bao nhiêu', dicts);
    expect(r.title).toBe('Giá @ # ! ~ bao nhiêu');
    expect(r.chips).toHaveLength(0);
    expect(r.unknown).toHaveLength(0);
  });

  it('mọi huy hiệu đều giữ lại đoạn gốc để người dùng bỏ chọn được', () => {
    const r = parseQuickTask('Sửa login @huy #frontend !cao 4h t6 ~react>=3', dicts);
    expect(r.chips.map((c) => c.token)).toEqual(['@huy', '#frontend', '!cao', '4h', 't6', '~react>=3']);
  });
});
