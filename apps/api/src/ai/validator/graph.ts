/** Tìm một vòng trong đồ thị phụ thuộc (thuần). Trả về đường đi tạo vòng, hoặc null. */
export function findCycle(edges: Map<string, string[]>): string[] | null {
  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = new Map<string, number>();
  const stack: string[] = [];
  const visit = (n: string): string[] | null => {
    color.set(n, GRAY);
    stack.push(n);
    for (const m of edges.get(n) ?? []) {
      const c = color.get(m) ?? WHITE;
      if (c === GRAY) return [...stack.slice(stack.indexOf(m)), m];
      if (c === WHITE) {
        const found = visit(m);
        if (found) return found;
      }
    }
    stack.pop();
    color.set(n, BLACK);
    return null;
  };
  for (const n of edges.keys()) {
    if ((color.get(n) ?? WHITE) === WHITE) {
      const found = visit(n);
      if (found) return found;
    }
  }
  return null;
}

/** Thứ tự tô-pô (phụ thuộc trước) — gọi sau khi chắc không có vòng. */
export function topoOrder(
  nodes: string[],
  edges: Map<string, string[]>,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const visit = (n: string) => {
    if (seen.has(n)) return;
    seen.add(n);
    for (const m of edges.get(n) ?? []) visit(m);
    out.push(n);
  };
  for (const n of nodes) visit(n);
  return out;
}

/** Bỏ dấu tiếng Việt + thường hoá để khớp tên kỹ năng LLM sinh với danh mục (05 §6 — chuẩn hoá, không quyết định). */
export function boDau(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
