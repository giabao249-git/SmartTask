export interface SkillMatchItem {
  skillId: string;
  name: string;
  required: number;
  level: number;
  ratio: number;
  /** Chưa có bằng chứng nào về kỹ năng này (khác với "có bằng chứng, mức thấp") */
  unproven: boolean;
}

/** Khớp kỹ năng từng cặp (docs 04 §6): sự thật, không xếp hạng. */
export function skillMatch(
  userLevels: Map<string, number>,
  required: Array<{ skillId: string; name: string; minLevel: number }>,
): {
  items: SkillMatchItem[];
  avg: number;
  missing: string[];
  unproven: string[];
} {
  const items = required.map((r) => {
    const level = userLevels.get(r.skillId) ?? 0;
    return {
      skillId: r.skillId,
      name: r.name,
      required: r.minLevel,
      level,
      ratio: Math.min(1, level / Math.max(1, r.minLevel)),
      unproven: !userLevels.has(r.skillId),
    };
  });
  const avg = items.length
    ? Math.round(
        (items.reduce((s, x) => s + x.ratio, 0) / items.length) * 100,
      ) / 100
    : 1;
  return {
    items,
    avg,
    // "thiếu" chỉ khi có bằng chứng mà mức 0; chưa có bằng chứng thì liệt kê riêng
    missing: items
      .filter((x) => x.level === 0 && !x.unproven)
      .map((x) => x.name),
    unproven: items.filter((x) => x.unproven).map((x) => x.name),
  };
}
