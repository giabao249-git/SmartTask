import {
  decomposeProposalSchema,
  type DecomposeProposal,
} from '@smarttask/shared';
import type { EditTaskDto } from '../dto/ai.dto';

/**
 * Gộp phần người dùng sửa trên thẻ xem trước vào đề xuất (thuần, không Prisma) rồi validate lại bằng zod.
 * Người sửa là NGƯỜI, không phải backend — backend không tự đổi đề xuất của LLM (05 §1).
 */
export function applyEdits(
  action: DecomposeProposal,
  edits: EditTaskDto[] | undefined,
): DecomposeProposal {
  if (!edits?.length) return action;
  const byKey = new Map(edits.map((e) => [e.draftKey, e]));
  const removed = new Set(edits.filter((e) => e.remove).map((e) => e.draftKey));
  const tasks = action.tasks
    .filter((t) => !removed.has(t.draftKey))
    .map((t) => {
      const e = byKey.get(t.draftKey);
      if (!e)
        return { ...t, dependsOn: t.dependsOn.filter((d) => !removed.has(d)) };
      return {
        ...t,
        title: e.title ?? t.title,
        description: e.description ?? t.description,
        estimateHours: e.estimateHours ?? t.estimateHours,
        priority: e.priority ?? t.priority,
        difficulty: e.difficulty ?? t.difficulty,
        suggestedAssignee:
          e.suggestedAssignee === null
            ? undefined
            : (e.suggestedAssignee ?? t.suggestedAssignee),
        requiredSkills: e.requiredSkills
          ? e.requiredSkills.map((s) => ({
              skill: s.skill,
              minLevel: s.minLevel ?? 1,
            }))
          : t.requiredSkills,
        dependsOn: (e.dependsOn ?? t.dependsOn).filter((d) => !removed.has(d)),
      };
    });
  return decomposeProposalSchema.parse({ ...action, tasks });
}
