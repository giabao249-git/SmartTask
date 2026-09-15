/**
 * Vị trí thẻ trong cột là số thực: chèn giữa hai thẻ = trung bình, không phải đánh số lại cả cột.
 * Khi khoảng cách quá nhỏ (kéo qua lại nhiều lần) thì đánh số lại cả cột cách nhau STEP.
 */
export const POSITION_STEP = 1024;
export const MIN_GAP = 1e-6;

export function positionBetween(
  prev: number | null,
  next: number | null,
): number {
  if (prev === null && next === null) return POSITION_STEP;
  if (prev === null) return (next as number) - POSITION_STEP;
  if (next === null) return prev + POSITION_STEP;
  return (prev + next) / 2;
}

export function needsNormalize(sortedPositions: number[]): boolean {
  for (let i = 1; i < sortedPositions.length; i += 1) {
    if (sortedPositions[i] - sortedPositions[i - 1] < MIN_GAP) return true;
  }
  return false;
}

/** Trả về vị trí mới cho từng id theo thứ tự đã cho: STEP, 2·STEP, … */
export function normalizePositions(
  orderedIds: string[],
): Array<{ id: string; position: number }> {
  return orderedIds.map((id, i) => ({ id, position: (i + 1) * POSITION_STEP }));
}
