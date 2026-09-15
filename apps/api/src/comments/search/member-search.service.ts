import { Injectable, Logger } from '@nestjs/common';
import { ElasticMemberSearch } from './elastic-member-search';
import type { MemberSuggestion } from './member-search.provider';
import { PgTrgmMemberSearch } from './pg-trgm-member-search';

/**
 * Chọn tầng tìm kiếm: Elasticsearch khi cấu hình và trả lời được; ngược lại pg_trgm.
 * Sau một lần ES lỗi, nghỉ 60 giây rồi mới thử lại — không để mỗi lần gõ @ phải chờ timeout.
 */
@Injectable()
export class MemberSearchService {
  private readonly logger = new Logger(MemberSearchService.name);
  private esDownUntil = 0;

  constructor(
    private readonly elastic: ElasticMemberSearch,
    private readonly pg: PgTrgmMemberSearch,
  ) {}

  async suggestProjectMembers(
    projectId: string,
    q: string | undefined,
    limit = 8,
  ): Promise<{ provider: string; items: MemberSuggestion[] }> {
    if (this.elastic.configured && Date.now() > this.esDownUntil) {
      try {
        return {
          provider: this.elastic.name,
          items: await this.elastic.suggestProjectMembers(projectId, q, limit),
        };
      } catch (e) {
        this.esDownUntil = Date.now() + 60_000;
        this.logger.warn(
          `Elasticsearch lỗi, rơi về pg_trgm trong 60 s: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    return {
      provider: this.pg.name,
      items: await this.pg.suggestProjectMembers(projectId, q, limit),
    };
  }
}
