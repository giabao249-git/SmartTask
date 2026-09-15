export interface SkillMatchItem {
  skillId: string;
  name: string;
  required: number;
  level: number;
  ratio: number;
}

/** Khớp kỹ năng từng cặp (docs 04 §6): sự thật, không xếp hạng. */
export function skillMatch(
  userLevels: Map<string, number>,
  required: Array<{ skillId: string; name: string; minLevel: number }>,
): { items: SkillMatchItem[]; avg: number; missing: string[] } {
  const items = required.map((r) => {
    const level = userLevels.get(r.skillId) ?? 0;
    return {
      skillId: r.skillId,
      name: r.name,
      required: r.minLevel,
      level,
      ratio: Math.min(1, level / Math.max(1, r.minLevel)),
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
    missing: items.filter((x) => x.level === 0).map((x) => x.name),
  };
}
