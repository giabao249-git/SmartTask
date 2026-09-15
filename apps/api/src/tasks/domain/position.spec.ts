import {
  MIN_GAP,
  needsNormalize,
  normalizePositions,
  POSITION_STEP,
  positionBetween,
} from './position';

describe('vị trí thẻ (fractional positioning)', () => {
  it('cột trống → STEP; cuối cột → +STEP; đầu cột → −STEP; giữa → trung bình', () => {
    expect(positionBetween(null, null)).toBe(POSITION_STEP);
    expect(positionBetween(2048, null)).toBe(3072);
    expect(positionBetween(null, 1024)).toBe(0);
    expect(positionBetween(1024, 2048)).toBe(1536);
  });

  it('chèn liên tiếp vào cùng khe rồi cần đánh số lại khi khoảng cách < MIN_GAP', () => {
    let a = 1024;
    const b = 2048;
    const positions = [a, b];
    for (let i = 0; i < 60; i += 1) {
      a = positionBetween(a, b);
      positions.push(a);
    }
    positions.sort((x, y) => x - y);
    expect(needsNormalize(positions)).toBe(true);
    expect(needsNormalize([1024, 2048, 3072])).toBe(false);
    expect(2048 - positions[positions.length - 2]).toBeLessThan(MIN_GAP * 1e3);
  });

  it('đánh số lại giữ nguyên thứ tự và cách đều', () => {
    expect(normalizePositions(['c', 'a', 'b'])).toEqual([
      { id: 'c', position: 1024 },
      { id: 'a', position: 2048 },
      { id: 'b', position: 3072 },
    ]);
  });
});
