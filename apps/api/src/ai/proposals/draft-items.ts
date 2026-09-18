import { AiProposalKind, AiProposalStatus } from '@prisma/client';
import {
  structuredActionSchema,
  type AssignProposal,
  type CreateTaskDraft,
  type DecomposeProposal,
  type DraftItemStatus,
  type DraftPatch,
  type RebalanceProposal,
  type StructuredAction,
  type UpdateTaskDraft,
} from '@smarttask/shared';

/**
 * Hàm THUẦN cho bản nháp trong phiên (docs 12 §2–3): loại proposal từ action, danh sách item theo draftKey,
 * đổi key LLM trả → key server cấp từ `next_draft_seq`, vá patch vào đúng item, lọc tập con để duyệt một phần,
 * suy trạng thái proposal từ trạng thái item. Không Prisma, không quyết định gì thay LLM/người.
 */

/** Action có thể lưu thành proposal (có item để duyệt). */
export type ProposalAction =
  | DecomposeProposal
  | CreateTaskDraft
  | UpdateTaskDraft
  | AssignProposal
  | RebalanceProposal;

export type ItemStatusMap = Record<string, DraftItemStatus>;

export function isProposalAction(a: StructuredAction): a is ProposalAction {
  return (
    a.type === 'DECOMPOSE_PROPOSAL' ||
    a.type === 'CREATE_TASK_DRAFT' ||
    (a.type === 'UPDATE_TASK_DRAFT' && !!a.targetTask) ||
    a.type === 'ASSIGN_PROPOSAL' ||
    a.type === 'REBALANCE_PROPOSAL'
  );
}

export function kindOf(a: ProposalAction): AiProposalKind {
  switch (a.type) {
    case 'DECOMPOSE_PROPOSAL':
      return AiProposalKind.DECOMPOSE;
    case 'CREATE_TASK_DRAFT':
      return AiProposalKind.TASK_DRAFT;
    case 'UPDATE_TASK_DRAFT':
      return AiProposalKind.TASK_UPDATE;
    case 'ASSIGN_PROPOSAL':
      return AiProposalKind.ASSIGN;
    case 'REBALANCE_PROPOSAL':
      return AiProposalKind.REBALANCE;
  }
}

/** Item hiển thị/vào prompt — một dòng mỗi draftKey, cùng hình dạng cho mọi kind. */
export interface DraftItem {
  draftKey: string;
  title: string;
  estimateHours?: number | null;
  assignee?: string | null;
  task?: string | null;
  dependsOn?: string[];
  start?: string | null;
  due?: string | null;
  skills?: string[];
  extra?: string;
}

export function itemsOf(a: ProposalAction): DraftItem[] {
  switch (a.type) {
    case 'DECOMPOSE_PROPOSAL':
      return a.tasks.map((t) => ({
        draftKey: t.draftKey,
        title: t.title,
        estimateHours: t.estimateHours ?? null,
        assignee: t.suggestedAssignee ?? null,
        dependsOn: t.dependsOn,
        skills: t.requiredSkills.map((s) => `${s.skill}≥${s.minLevel}`),
      }));
    case 'CREATE_TASK_DRAFT':
      return a.drafts.map((t) => ({
        draftKey: t.draftKey,
        title: t.title,
        estimateHours: t.estimateHours ?? null,
        assignee: t.assignee ?? t.suggestedAssignee ?? null,
        dependsOn: t.dependsOn,
        start: t.start ?? null,
        due: t.due ?? null,
        skills: t.requiredSkills.map((s) => `${s.skill}≥${s.minLevel}`),
      }));
    case 'UPDATE_TASK_DRAFT':
      return [
        {
          draftKey: a.draftKey ?? 'd0',
          title: `sửa ${a.targetTask ?? '?'}`,
          task: a.targetTask ?? null,
          extra: JSON.stringify(a.patch),
        },
      ];
    case 'ASSIGN_PROPOSAL':
      return a.assignments.map((x, i) => ({
        draftKey: x.draftKey ?? `d${i}`,
        title: `giao ${x.task}`,
        task: x.task,
        assignee: x.assignee,
        start: x.start ?? null,
        due: x.due ?? null,
      }));
    case 'REBALANCE_PROPOSAL':
      return a.moves.map((x, i) => ({
        draftKey: x.draftKey ?? `d${i}`,
        title: `chuyển ${x.task} ${x.from} → ${x.to}`,
        task: x.task,
        assignee: x.to,
      }));
  }
}

export function itemKeys(a: ProposalAction): string[] {
  return itemsOf(a).map((i) => i.draftKey);
}

/**
 * Cấp key server cho action LLM trả: `firstSeq` là `next_draft_seq` của phiên lúc lưu.
 * Trả action đã đổi key (kể cả `dependsOn`) và bảng ánh xạ key LLM → key server (ghi `code_map.drafts`).
 */
export function assignServerKeys(
  a: ProposalAction,
  firstSeq: number,
): { action: ProposalAction; keyMap: Record<string, string>; count: number } {
  const keyMap: Record<string, string> = {};
  let seq = firstSeq;
  const next = (llmKey: string | undefined, i: number) => {
    const k = llmKey ?? `_${i}`;
    if (!keyMap[k]) keyMap[k] = `d${seq++}`;
    return keyMap[k];
  };
  const dep = (list: string[]) => list.map((d) => keyMap[d] ?? d);
  let out: ProposalAction;
  switch (a.type) {
    case 'DECOMPOSE_PROPOSAL': {
      const tasks = a.tasks.map((t, i) => ({
        ...t,
        draftKey: next(t.draftKey, i),
      }));
      out = {
        ...a,
        tasks: tasks.map((t) => ({ ...t, dependsOn: dep(t.dependsOn) })),
      };
      break;
    }
    case 'CREATE_TASK_DRAFT': {
      const drafts = a.drafts.map((t, i) => ({
        ...t,
        draftKey: next(t.draftKey, i),
      }));
      out = {
        ...a,
        drafts: drafts.map((t) => ({ ...t, dependsOn: dep(t.dependsOn) })),
      };
      break;
    }
    case 'UPDATE_TASK_DRAFT':
      out = { ...a, draftKey: next(a.draftKey, 0) };
      break;
    case 'ASSIGN_PROPOSAL':
      out = {
        ...a,
        assignments: a.assignments.map((x, i) => ({
          ...x,
          draftKey: next(x.draftKey, i),
        })),
      };
      break;
    case 'REBALANCE_PROPOSAL':
      out = {
        ...a,
        moves: a.moves.map((x, i) => ({ ...x, draftKey: next(x.draftKey, i) })),
      };
      break;
  }
  return { action: out, keyMap, count: seq - firstSeq };
}

/** Vá `patch` vào đúng item; key không có → trả null (caller báo UNKNOWN_DRAFT_KEY). Kết quả được zod lại. */
export function patchItem(
  a: ProposalAction,
  draftKey: string,
  patch: DraftPatch,
): ProposalAction | null {
  const pick = <T extends object>(
    obj: T,
    keys: (keyof DraftPatch)[],
  ): Partial<T> => {
    const out: Record<string, unknown> = {};
    for (const k of keys) if (k in patch) out[k] = patch[k];
    return out as Partial<T>;
  };
  const undefIfNull = <T>(v: T | null | undefined): T | undefined =>
    v === null ? undefined : v;
  switch (a.type) {
    case 'DECOMPOSE_PROPOSAL': {
      const i = a.tasks.findIndex((t) => t.draftKey === draftKey);
      if (i < 0) return null;
      const t = a.tasks[i];
      const p = pick(t, [
        'title',
        'priority',
        'difficulty',
        'requiredSkills',
        'subtasks',
        'dependsOn',
      ]);
      const merged = {
        ...t,
        ...p,
        description:
          'description' in patch
            ? (patch.description ?? undefined)
            : t.description,
        estimateHours:
          'estimateHours' in patch
            ? (patch.estimateHours ?? undefined)
            : t.estimateHours,
        suggestedAssignee:
          'suggestedAssignee' in patch
            ? undefIfNull(patch.suggestedAssignee)
            : t.suggestedAssignee,
      };
      const tasks = [...a.tasks];
      tasks[i] = merged;
      const sprint = 'sprint' in patch ? undefIfNull(patch.sprint) : a.sprint;
      return reparse({ ...a, tasks, sprint });
    }
    case 'CREATE_TASK_DRAFT': {
      const i = a.drafts.findIndex((t) => t.draftKey === draftKey);
      if (i < 0) return null;
      const t = a.drafts[i];
      const p = pick(t, [
        'title',
        'priority',
        'difficulty',
        'requiredSkills',
        'subtasks',
        'dependsOn',
      ]);
      const merged = {
        ...t,
        ...p,
        description:
          'description' in patch
            ? (patch.description ?? undefined)
            : t.description,
        estimateHours:
          'estimateHours' in patch
            ? (patch.estimateHours ?? undefined)
            : t.estimateHours,
        assignee:
          'suggestedAssignee' in patch
            ? undefIfNull(patch.suggestedAssignee)
            : t.assignee,
        suggestedAssignee:
          'suggestedAssignee' in patch
            ? undefIfNull(patch.suggestedAssignee)
            : t.suggestedAssignee,
        start: 'start' in patch ? undefIfNull(patch.start) : t.start,
        due: 'due' in patch ? undefIfNull(patch.due) : t.due,
      };
      const drafts = [...a.drafts];
      drafts[i] = merged;
      const sprint = 'sprint' in patch ? undefIfNull(patch.sprint) : a.sprint;
      return reparse({ ...a, drafts, sprint });
    }
    case 'UPDATE_TASK_DRAFT':
      if (a.draftKey !== draftKey) return null;
      return reparse({ ...a, patch: { ...a.patch, ...patch } });
    case 'ASSIGN_PROPOSAL': {
      const i = a.assignments.findIndex((x) => x.draftKey === draftKey);
      if (i < 0) return null;
      const x = a.assignments[i];
      const assignments = [...a.assignments];
      assignments[i] = {
        ...x,
        assignee: patch.suggestedAssignee ?? x.assignee,
        start: 'start' in patch ? undefIfNull(patch.start) : x.start,
        due: 'due' in patch ? undefIfNull(patch.due) : x.due,
      };
      return reparse({ ...a, assignments });
    }
    case 'REBALANCE_PROPOSAL': {
      const i = a.moves.findIndex((x) => x.draftKey === draftKey);
      if (i < 0) return null;
      const moves = [...a.moves];
      moves[i] = { ...moves[i], to: patch.suggestedAssignee ?? moves[i].to };
      return reparse({ ...a, moves });
    }
  }
}

/** Tập con item (để validate/duyệt một phần); `dependsOn` trỏ ra ngoài tập được giữ nguyên (Executor tra applied_map). */
export function filterItems(a: ProposalAction, keys: string[]): ProposalAction {
  const keep = new Set(keys);
  switch (a.type) {
    case 'DECOMPOSE_PROPOSAL':
      return { ...a, tasks: a.tasks.filter((t) => keep.has(t.draftKey)) };
    case 'CREATE_TASK_DRAFT':
      return { ...a, drafts: a.drafts.filter((t) => keep.has(t.draftKey)) };
    case 'UPDATE_TASK_DRAFT':
      return a;
    case 'ASSIGN_PROPOSAL':
      return {
        ...a,
        assignments: a.assignments.filter((x) => keep.has(x.draftKey ?? '')),
      };
    case 'REBALANCE_PROPOSAL':
      return { ...a, moves: a.moves.filter((x) => keep.has(x.draftKey ?? '')) };
  }
}

/** DRAFT còn ≥ 1 → DRAFT; hết DRAFT và ≥ 1 APPLIED → APPLIED; còn lại → REJECTED (docs 12 §2). */
export function deriveStatus(items: ItemStatusMap): AiProposalStatus {
  const values = Object.values(items);
  if (values.some((v) => v === 'DRAFT')) return AiProposalStatus.DRAFT;
  if (values.some((v) => v === 'APPLIED')) return AiProposalStatus.APPLIED;
  return AiProposalStatus.REJECTED;
}

export function initialItemStatus(a: ProposalAction): ItemStatusMap {
  return Object.fromEntries(itemKeys(a).map((k) => [k, 'DRAFT' as const]));
}

function reparse(a: unknown): ProposalAction {
  return structuredActionSchema.parse(a) as ProposalAction;
}
