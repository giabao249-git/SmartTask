import {
  buildProfiles,
  demonstrated,
  evidenceText,
  skillEvidence,
  type EvidenceItem,
} from './skill-evidence';

const item = (over: Partial<EvidenceItem> = {}): EvidenceItem => ({
  userId: 'u',
  skillId: 's',
  required: 3,
  source: 'task',
  difficulty: 3,
  rating: 4,
  reopened: 0,
  bugs: 0,
  share: 1,
  at: new Date('2026-09-20T00:00:00Z'),
  ...over,
});

describe('hồ sơ kỹ năng từ bằng chứng (docs 04 §2b)', () => {
  it('không có bằng chứng → mức 0, độ tin cậy none (mức tự khai không được tính)', () => {
    const e = skillEvidence('s', []);
    expect(e).toMatchObject({ level: 0, confidence: 'none', tasks: 0 });
    expect(evidenceText(e)).toBe('chưa có bằng chứng');
  });

  it('một việc mức 3 được PM đánh giá đạt → mức 3, tin cậy thấp', () => {
    const e = skillEvidence('s', [item()]);
    expect(e).toMatchObject({
      level: 3,
      confidence: 'low',
      passed: 1,
      reviewed: 1,
    });
  });

  it('chưa đánh giá chỉ tính nửa: cần 2 việc mới đủ một mức', () => {
    expect(skillEvidence('s', [item({ rating: null })]).level).toBe(0);
    expect(
      skillEvidence('s', [item({ rating: null }), item({ rating: null })])
        .level,
    ).toBe(3);
  });

  it('làm tốt việc khó hơn yêu cầu → thể hiện mức cao hơn một bậc', () => {
    expect(demonstrated(item({ rating: 5, difficulty: 4 }))).toBe(4);
    expect(demonstrated(item({ rating: 3, difficulty: 4 }))).toBe(3);
  });

  it('bị mở lại / sinh bug / đánh giá thấp là trượt và kéo mức xuống', () => {
    const e = skillEvidence('s', [
      item({ required: 4 }),
      item({ required: 4, bugs: 1 }),
      item({ required: 2, difficulty: 2 }),
    ]);
    // mức 4: +1 −1 = 0 < 1; mức 2: +1 −1 +1 = 1 → 2
    expect(e).toMatchObject({ level: 2, failed: 1, passed: 2 });
    expect(evidenceText(e)).toContain('1 phải làm lại');
    expect(skillEvidence('s', [item({ rating: 2 })]).level).toBe(0);
    expect(skillEvidence('s', [item({ reopened: 1 })]).level).toBe(0);
  });

  it('nhiều người cùng làm thì chia phần ghi nhận', () => {
    expect(skillEvidence('s', [item({ share: 0.5 })]).level).toBe(0);
    expect(
      skillEvidence('s', [item({ share: 0.5 }), item({ share: 0.5 })]).level,
    ).toBe(3);
  });

  it('PM xác nhận là một bằng chứng; độ tin cậy tăng theo tổng ghi nhận', () => {
    const e = skillEvidence('s', [
      item({ source: 'verified', required: 4, rating: null }),
    ]);
    expect(e).toMatchObject({ level: 4, verified: true, tasks: 0 });
    const many = skillEvidence('s', [item(), item(), item(), item()]);
    expect(many.confidence).toBe('high');
    expect(skillEvidence('s', [item(), item()]).confidence).toBe('medium');
  });

  it('gom theo người và kỹ năng', () => {
    const p = buildProfiles([
      item({ userId: 'a', skillId: 'x' }),
      item({ userId: 'a', skillId: 'y', required: 2, difficulty: 2 }),
      item({ userId: 'b', skillId: 'x', rating: 1 }),
    ]);
    expect(p.get('a')!.get('x')!.level).toBe(3);
    expect(p.get('a')!.get('y')!.level).toBe(2);
    expect(p.get('b')!.get('x')!.level).toBe(0);
  });
});
