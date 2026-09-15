import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  MemberSearchProvider,
  MemberSuggestion,
} from './member-search.provider';

/**
 * Tìm mờ bằng Postgres: unaccent + tiền tố + trigram (pg_trgm) trên tên, tên ngắn, email.
 * Luôn có sẵn (không cần dịch vụ ngoài) — là đường rơi về khi Elasticsearch không cấu hình hoặc không kết nối được.
 */
@Injectable()
export class PgTrgmMemberSearch implements MemberSearchProvider {
  readonly name = 'pg_trgm';

  constructor(private readonly prisma: PrismaService) {}

  async suggestProjectMembers(
    projectId: string,
    q: string | undefined,
    limit: number,
  ): Promise<MemberSuggestion[]> {
    const term = (q ?? '').trim();
    if (term.length === 0) {
      const rows = await this.prisma.projectMember.findMany({
        where: { projectId },
        select: {
          role: true,
          user: {
            select: {
              id: true,
              fullName: true,
              shortName: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: [{ role: 'asc' }, { user: { fullName: 'asc' } }],
        take: limit,
      });
      return rows.map((r) => ({ ...r.user, role: r.role, score: 1 }));
    }
    // Điểm = max(trigram tên, trigram tên ngắn, trigram email) + thưởng khi khớp tiền tố từ (gõ "hu" ra "Huy" trước "Thu").
    // Hàm/toán tử pg_trgm nằm ở schema public → gọi đủ tên vì search_path khi chạy có thể là schema khác (e2e).
    const rows = await this.prisma.$queryRaw<MemberSuggestion[]>(Prisma.sql`
      WITH q AS (SELECT public.f_unaccent(${term}) AS t)
      SELECT u.id, u.full_name AS "fullName", u.short_name AS "shortName", u.email::text AS email, u.avatar_url AS "avatarUrl",
             pm.role::text AS role,
             GREATEST(
               public.similarity(public.f_unaccent(u.full_name), q.t),
               public.similarity(public.f_unaccent(coalesce(u.short_name, '')), q.t),
               public.similarity(lower(u.email::text), lower(${term}))
             )
             + CASE WHEN public.f_unaccent(coalesce(u.short_name, '')) LIKE q.t || '%' THEN 0.5
                    WHEN public.f_unaccent(u.full_name) LIKE '%' || q.t || '%' THEN 0.3
                    WHEN EXISTS (SELECT 1 FROM unnest(string_to_array(public.f_unaccent(u.full_name), ' ')) w WHERE w LIKE q.t || '%') THEN 0.4
                    ELSE 0 END AS score
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id, q
      WHERE pm.project_id = ${projectId}::uuid AND u.is_active
        AND (
          public.f_unaccent(u.full_name) OPERATOR(public.%) q.t
          OR public.f_unaccent(coalesce(u.short_name, '')) OPERATOR(public.%) q.t
          OR public.f_unaccent(u.full_name) LIKE '%' || q.t || '%'
          OR lower(u.email::text) LIKE '%' || lower(${term}) || '%'
          OR EXISTS (SELECT 1 FROM unnest(string_to_array(public.f_unaccent(u.full_name), ' ')) w WHERE w LIKE q.t || '%')
        )
      ORDER BY score DESC, u.full_name ASC
      LIMIT ${limit}
    `);
    return rows.map((r) => ({ ...r, score: Number(r.score) }));
  }
}
