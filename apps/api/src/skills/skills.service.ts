import { HttpStatus, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { WorkspaceAccessService } from '../common/access/workspace-access.service';
import { AppError } from '../common/app-error';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateSkillDto,
  MergeSkillDto,
  PutMySkillsDto,
  SkillMatrixQueryDto,
  UpdateSkillDto,
} from './dto/skill.dto';
import { DEFAULT_SKILLS } from './skill-seed';

type Tx = Prisma.TransactionClient;

const SKILL_SELECT = {
  id: true,
  workspaceId: true,
  name: true,
  category: true,
  isActive: true,
  aliases: { select: { alias: true } },
  _count: { select: { userSkills: true, taskSkills: true } },
} as const;

@Injectable()
export class SkillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  /** Gọi trong transaction tạo workspace. */
  async seedDefaults(tx: Tx, workspaceId: string): Promise<void> {
    for (const s of DEFAULT_SKILLS) {
      await tx.skill.create({
        data: {
          workspaceId,
          name: s.name,
          category: s.category,
          aliases: { create: (s.aliases ?? []).map((alias) => ({ alias })) },
        },
      });
    }
  }

  async list(workspaceId: string, includeInactive = false) {
    const rows = await this.prisma.skill.findMany({
      where: { workspaceId, ...(includeInactive ? {} : { isActive: true }) },
      select: SKILL_SELECT,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    return rows.map((r) => this.toView(r));
  }

  async create(workspaceId: string, dto: CreateSkillDto) {
    const dup = await this.findByNameOrAlias(workspaceId, dto.name);
    if (dup)
      throw AppError.conflict('CONFLICT', {
        reason: `Trùng với kỹ năng "${dup.name}"`,
      });
    const row = await this.prisma.skill.create({
      data: {
        workspaceId,
        name: dto.name,
        category: dto.category ?? 'Khác',
        aliases: {
          create: uniqueAliases(dto.aliases, dto.name).map((alias) => ({
            alias,
          })),
        },
      },
      select: SKILL_SELECT,
    });
    return this.toView(row);
  }

  /** Route /skills/:id không có :wsId → kiểm quyền theo workspace của kỹ năng. */
  async update(userId: string, skillId: string, dto: UpdateSkillDto) {
    const skill = await this.loadForAdmin(userId, skillId);
    if (dto.name && dto.name !== skill.name) {
      const dup = await this.findByNameOrAlias(
        skill.workspaceId,
        dto.name,
        skillId,
      );
      if (dup)
        throw AppError.conflict('CONFLICT', {
          reason: `Trùng với kỹ năng "${dup.name}"`,
        });
    }
    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.aliases) {
        await tx.skillAlias.deleteMany({ where: { skillId } });
        await tx.skillAlias.createMany({
          data: uniqueAliases(dto.aliases, dto.name ?? skill.name).map(
            (alias) => ({ skillId, alias }),
          ),
          skipDuplicates: true,
        });
      }
      return tx.skill.update({
        where: { id: skillId },
        data: {
          name: dto.name,
          category: dto.category,
          isActive: dto.isActive,
        },
        select: SKILL_SELECT,
      });
    });
    return this.toView(row);
  }

  /**
   * Gộp nguồn → đích: user_skills giữ mức cao hơn, task_skills giữ mức yêu cầu cao hơn,
   * alias + tên nguồn thành alias của đích, xoá nguồn. Dùng khi danh mục có "ReactJS" và "React".
   */
  async merge(userId: string, sourceId: string, dto: MergeSkillDto) {
    if (sourceId === dto.intoSkillId)
      throw new AppError('SKILL_MERGE_SAME', HttpStatus.BAD_REQUEST);
    const source = await this.loadForAdmin(userId, sourceId);
    const target = await this.prisma.skill.findFirst({
      where: { id: dto.intoSkillId, workspaceId: source.workspaceId },
    });
    if (!target) throw AppError.notFound({ intoSkillId: dto.intoSkillId });

    await this.prisma.$transaction(async (tx) => {
      const srcUser = await tx.userSkill.findMany({
        where: { skillId: sourceId },
      });
      for (const us of srcUser) {
        const existing = await tx.userSkill.findUnique({
          where: { userId_skillId: { userId: us.userId, skillId: target.id } },
        });
        if (!existing) {
          await tx.userSkill.create({
            data: {
              userId: us.userId,
              skillId: target.id,
              level: us.level,
              verifiedById: us.verifiedById,
              verifiedAt: us.verifiedAt,
            },
          });
        } else if (us.level > existing.level) {
          await tx.userSkill.update({
            where: {
              userId_skillId: { userId: us.userId, skillId: target.id },
            },
            data: { level: us.level },
          });
        }
      }
      const srcTask = await tx.taskSkill.findMany({
        where: { skillId: sourceId },
      });
      for (const ts of srcTask) {
        const existing = await tx.taskSkill.findUnique({
          where: { taskId_skillId: { taskId: ts.taskId, skillId: target.id } },
        });
        if (!existing)
          await tx.taskSkill.create({
            data: {
              taskId: ts.taskId,
              skillId: target.id,
              minLevel: ts.minLevel,
            },
          });
        else if (ts.minLevel > existing.minLevel) {
          await tx.taskSkill.update({
            where: {
              taskId_skillId: { taskId: ts.taskId, skillId: target.id },
            },
            data: { minLevel: ts.minLevel },
          });
        }
      }
      const srcAliases = await tx.skillAlias.findMany({
        where: { skillId: sourceId },
      });
      await tx.skillAlias.createMany({
        data: [...srcAliases.map((a) => a.alias), source.name].map((alias) => ({
          skillId: target.id,
          alias,
        })),
        skipDuplicates: true,
      });
      await tx.skill.delete({ where: { id: sourceId } }); // cascade user_skills/task_skills/aliases nguồn
    });
    const row = await this.prisma.skill.findUniqueOrThrow({
      where: { id: target.id },
      select: SKILL_SELECT,
    });
    return this.toView(row);
  }

  /** Kỹ năng của tôi trong một workspace (UC-22). */
  async mySkills(userId: string, workspaceId: string) {
    await this.access.assertRole(userId, workspaceId, []);
    const rows = await this.prisma.userSkill.findMany({
      where: { userId, skill: { workspaceId } },
      select: {
        level: true,
        verifiedAt: true,
        updatedAt: true,
        verifiedBy: { select: { id: true, fullName: true } },
        skill: { select: { id: true, name: true, category: true } },
      },
      orderBy: { skill: { name: 'asc' } },
    });
    return rows.map((r) => ({
      ...r.skill,
      level: r.level,
      verifiedAt: r.verifiedAt,
      verifiedBy: r.verifiedBy,
      updatedAt: r.updatedAt,
    }));
  }

  /** Thay toàn bộ: kỹ năng bỏ khỏi danh sách bị xoá; mức đổi thì mất xác nhận của PM. */
  async putMySkills(userId: string, workspaceId: string, dto: PutMySkillsDto) {
    await this.access.assertRole(userId, workspaceId, []);
    const ids = [...new Set(dto.skills.map((s) => s.skillId))];
    const valid = await this.prisma.skill.findMany({
      where: { id: { in: ids }, workspaceId, isActive: true },
      select: { id: true },
    });
    if (valid.length !== ids.length)
      throw AppError.notFound({
        reason: 'Có kỹ năng không thuộc workspace này hoặc đã ẩn',
      });

    await this.prisma.$transaction(async (tx) => {
      await tx.userSkill.deleteMany({
        where: { userId, skill: { workspaceId }, skillId: { notIn: ids } },
      });
      for (const item of dto.skills) {
        const existing = await tx.userSkill.findUnique({
          where: { userId_skillId: { userId, skillId: item.skillId } },
        });
        if (!existing)
          await tx.userSkill.create({
            data: { userId, skillId: item.skillId, level: item.level },
          });
        else if (existing.level !== item.level) {
          await tx.userSkill.update({
            where: { userId_skillId: { userId, skillId: item.skillId } },
            data: { level: item.level, verifiedById: null, verifiedAt: null },
          });
        }
      }
    });
    return this.mySkills(userId, workspaceId);
  }

  /**
   * Xác nhận mức kỹ năng: OWNER/ADMIN workspace, hoặc PM của một dự án (chưa lưu trữ) mà người được xác nhận là
   * thành viên — PM là người thấy người đó làm việc. Xác nhận là một bằng chứng trong hồ sơ kỹ năng (docs 02/08).
   */
  async verify(
    verifierId: string,
    targetUserId: string,
    skillId: string,
    level: number,
  ) {
    const skill = await this.prisma.skill.findUnique({
      where: { id: skillId },
      select: { workspaceId: true },
    });
    if (!skill) throw AppError.notFound();
    const role = await this.access.assertRole(
      verifierId,
      skill.workspaceId,
      [],
    );
    if (role !== 'OWNER' && role !== 'ADMIN') {
      const shared = await this.prisma.project.count({
        where: {
          workspaceId: skill.workspaceId,
          status: { not: 'ARCHIVED' },
          members: { some: { userId: verifierId, role: 'PM' } },
          AND: { members: { some: { userId: targetUserId } } },
        },
      });
      if (!shared)
        throw AppError.forbidden({
          required: 'OWNER/ADMIN hoặc PM của dự án có người này',
        });
    }
    await this.access.assertRole(targetUserId, skill.workspaceId, []);
    const row = await this.prisma.userSkill.upsert({
      where: { userId_skillId: { userId: targetUserId, skillId } },
      create: {
        userId: targetUserId,
        skillId,
        level,
        verifiedById: verifierId,
        verifiedAt: new Date(),
      },
      update: { level, verifiedById: verifierId, verifiedAt: new Date() },
      select: {
        level: true,
        verifiedAt: true,
        skill: { select: { id: true, name: true } },
        user: { select: { id: true, fullName: true } },
      },
    });
    return row;
  }

  /** Heatmap thành viên × kỹ năng + bus factor (UC-23). Đây là SỰ THẬT cho AI — không xếp hạng. */
  async matrix(workspaceId: string, query: SkillMatrixQueryDto) {
    const minLevel = query.minLevel ?? 3;
    const [members, skills, userSkills] = await Promise.all([
      this.prisma.workspaceMember.findMany({
        where: { workspaceId, role: { not: 'VIEWER' } },
        select: {
          user: {
            select: {
              id: true,
              fullName: true,
              shortName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { joinedAt: 'asc' },
      }),
      this.prisma.skill.findMany({
        where: { workspaceId, isActive: true },
        select: { id: true, name: true, category: true },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.userSkill.findMany({
        where: { skill: { workspaceId, isActive: true } },
        select: { userId: true, skillId: true, level: true, verifiedAt: true },
      }),
    ]);
    const cells = userSkills.map((u) => ({
      userId: u.userId,
      skillId: u.skillId,
      level: u.level,
      verified: u.verifiedAt !== null,
    }));
    const holders = new Map<string, number>();
    for (const c of cells)
      if (c.level >= minLevel)
        holders.set(c.skillId, (holders.get(c.skillId) ?? 0) + 1);
    const busFactor = skills
      .filter((s) => (holders.get(s.id) ?? 0) <= 1)
      .map((s) => ({
        skillId: s.id,
        name: s.name,
        holders: holders.get(s.id) ?? 0,
      }));
    return {
      users: members.map((m) => m.user),
      skills,
      cells,
      busFactor,
      minLevel,
    };
  }

  private async loadForAdmin(userId: string, skillId: string) {
    const skill = await this.prisma.skill.findUnique({
      where: { id: skillId },
    });
    if (!skill) throw AppError.notFound();
    await this.access.assertRole(userId, skill.workspaceId, ['OWNER', 'ADMIN']);
    return skill;
  }

  private async findByNameOrAlias(
    workspaceId: string,
    name: string,
    exceptId?: string,
  ) {
    return this.prisma.skill.findFirst({
      where: {
        workspaceId,
        ...(exceptId ? { id: { not: exceptId } } : {}),
        OR: [
          { name: { equals: name, mode: 'insensitive' } },
          {
            aliases: { some: { alias: { equals: name, mode: 'insensitive' } } },
          },
        ],
      },
      select: { id: true, name: true },
    });
  }

  private toView(row: {
    id: string;
    workspaceId: string;
    name: string;
    category: string;
    isActive: boolean;
    aliases: { alias: string }[];
    _count: { userSkills: number; taskSkills: number };
  }) {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      name: row.name,
      category: row.category,
      isActive: row.isActive,
      aliases: row.aliases.map((a) => a.alias),
      usersCount: row._count.userSkills,
      tasksCount: row._count.taskSkills,
    };
  }
}

function uniqueAliases(aliases: string[] | undefined, name: string): string[] {
  const seen = new Set<string>([name.toLowerCase()]);
  const out: string[] = [];
  for (const raw of aliases ?? []) {
    const a = raw.trim();
    if (!a || seen.has(a.toLowerCase())) continue;
    seen.add(a.toLowerCase());
    out.push(a);
  }
  return out;
}
