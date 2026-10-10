import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildProfiles,
  isConclusive,
  type EvidenceItem,
  type SkillEvidence,
} from './domain/skill-evidence';

/** Bằng chứng xa hơn chừng này tuần thì không tính — kỹ năng lâu không dùng không còn chắc. */
export const EVIDENCE_WINDOW_WEEKS = 26;
const DAY = 86_400_000;

export interface SkillProfileEntry extends SkillEvidence {
  name: string;
  /** Mức TỰ KHAI — chỉ để tham khảo, KHÔNG dùng để chia việc (docs 02/08) */
  declared: number | null;
}

/** Việc đã bị mở lại bao nhiêu lần: nhật ký `task.moved` có `completedAt.to = null`. */
export function reopenCounts(
  logs: { taskId: string | null; diff: unknown }[],
): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of logs) {
    const c = (l.diff as { completedAt?: { to?: unknown } } | null)
      ?.completedAt;
    if (l.taskId && c && 'to' in c && c.to === null)
      m.set(l.taskId, (m.get(l.taskId) ?? 0) + 1);
  }
  return m;
}

/**
 * Engine hồ sơ kỹ năng (docs 02/08): nạp bằng chứng từ việc đã xong + đánh giá + bug gốc + nhật ký mở lại
 * + xác nhận của PM, rồi gọi hàm thuần `buildProfiles`. Mọi nơi trước đây đọc `user_skills.level` (tự khai)
 * để chia việc — validator, bảng năng lực, ngữ cảnh AI, tra cứu — đọc từ đây.
 */
@Injectable()
export class SkillEvidenceService {
  constructor(private readonly prisma: PrismaService) {}

  async items(
    workspaceId: string,
    userIds?: string[],
    now = new Date(),
  ): Promise<EvidenceItem[]> {
    const since = new Date(now.getTime() - EVIDENCE_WINDOW_WEEKS * 7 * DAY);
    const userFilter = userIds ? { userId: { in: userIds } } : {};
    const [tasks, verified] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          deletedAt: null,
          completedAt: { gte: since },
          project: { workspaceId },
          skills: { some: {} },
          assignees: { some: userFilter },
        },
        select: {
          id: true,
          difficulty: true,
          completedAt: true,
          assignees: { select: { userId: true } },
          skills: { select: { skillId: true, minLevel: true } },
          review: {
            select: { rating: true, difficultyActual: true, reviewerId: true },
          },
          _count: { select: { derivedBugs: { where: { deletedAt: null } } } },
        },
      }),
      this.prisma.userSkill.findMany({
        where: {
          ...userFilter,
          verifiedAt: { not: null, gte: since },
          skill: { workspaceId },
          user: { workspaceMembers: { some: { workspaceId } } },
        },
        select: { userId: true, skillId: true, level: true, verifiedAt: true },
      }),
    ]);
    const reopened = reopenCounts(
      tasks.length
        ? await this.prisma.activityLog.findMany({
            where: {
              action: 'task.moved',
              taskId: { in: tasks.map((t) => t.id) },
            },
            select: { taskId: true, diff: true },
          })
        : [],
    );
    const items: EvidenceItem[] = [];
    for (const t of tasks) {
      const people = t.assignees.map((a) => a.userId);
      // Tự chấm việc của chính mình không phải bằng chứng
      const rating =
        t.review && !people.includes(t.review.reviewerId)
          ? t.review.rating
          : null;
      for (const userId of people) {
        if (userIds && !userIds.includes(userId)) continue;
        for (const s of t.skills)
          items.push({
            userId,
            skillId: s.skillId,
            required: s.minLevel,
            source: 'task',
            taskId: t.id,
            difficulty: t.review?.difficultyActual ?? t.difficulty,
            rating,
            reopened: reopened.get(t.id) ?? 0,
            bugs: t._count.derivedBugs,
            share: 1 / people.length,
            at: t.completedAt!,
          });
      }
    }
    for (const v of verified)
      items.push({
        userId: v.userId,
        skillId: v.skillId,
        required: v.level,
        source: 'verified',
        rating: null,
        reopened: 0,
        bugs: 0,
        share: 1,
        at: v.verifiedAt!,
      });
    return items;
  }

  /** Hồ sơ đầy đủ (kèm tên kỹ năng và mức tự khai để đối chiếu) cho giao diện/tra cứu. */
  async profiles(
    workspaceId: string,
    userIds?: string[],
    now = new Date(),
  ): Promise<Map<string, SkillProfileEntry[]>> {
    const [items, declared, skills] = await Promise.all([
      this.items(workspaceId, userIds, now),
      this.prisma.userSkill.findMany({
        where: {
          ...(userIds ? { userId: { in: userIds } } : {}),
          skill: { workspaceId },
        },
        select: { userId: true, skillId: true, level: true },
      }),
      this.prisma.skill.findMany({
        where: { workspaceId },
        select: { id: true, name: true },
      }),
    ]);
    const nameOf = new Map(skills.map((s) => [s.id, s.name]));
    const built = buildProfiles(items);
    const out = new Map<string, SkillProfileEntry[]>();
    const declaredOf = new Map(
      declared.map((d) => [`${d.userId}:${d.skillId}`, d.level]),
    );
    const users = new Set([...built.keys(), ...declared.map((d) => d.userId)]);
    for (const u of users) {
      const ev = built.get(u) ?? new Map<string, SkillEvidence>();
      const skillIds = new Set([
        ...ev.keys(),
        ...declared.filter((d) => d.userId === u).map((d) => d.skillId),
      ]);
      out.set(
        u,
        [...skillIds]
          .map((sid) => ({
            ...(ev.get(sid) ?? emptyEvidence(sid)),
            name: nameOf.get(sid) ?? sid,
            declared: declaredOf.get(`${u}:${sid}`) ?? null,
          }))
          .sort(
            (a, b) =>
              b.level - a.level ||
              b.tasks - a.tasks ||
              a.name.localeCompare(b.name, 'vi'),
          ),
      );
    }
    return out;
  }

  /**
   * Thay thế cho `Map<userId, Map<skillId, level tự khai>>`. Chỉ có mặt kỹ năng có bằng chứng KẾT LUẬN (mức có thể là
   * 0 khi việc làm lại nhiều hơn việc đạt); vắng mặt = chưa biết → hệ số thiếu kỹ năng coi là trung tính.
   */
  async levels(
    workspaceId: string,
    userIds?: string[],
    now = new Date(),
  ): Promise<Map<string, Map<string, number>>> {
    const built = buildProfiles(await this.items(workspaceId, userIds, now));
    const out = new Map<string, Map<string, number>>();
    for (const [u, m] of built)
      out.set(
        u,
        new Map(
          [...m]
            .filter(([, e]) => isConclusive(e))
            .map(([s, e]) => [s, e.level]),
        ),
      );
    return out;
  }

  /** Như `levels` nhưng giữ cả số liệu để validator/ngữ cảnh AI trích dẫn. */
  async evidence(
    workspaceId: string,
    userIds?: string[],
    now = new Date(),
  ): Promise<Map<string, Map<string, SkillEvidence>>> {
    return buildProfiles(await this.items(workspaceId, userIds, now));
  }
}

function emptyEvidence(skillId: string): SkillEvidence {
  return {
    skillId,
    level: 0,
    confidence: 'none',
    tasks: 0,
    passed: 0,
    failed: 0,
    reviewed: 0,
    verified: false,
    lastAt: null,
  };
}
