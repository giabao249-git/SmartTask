import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';
import type { Env } from '../../config/env.schema';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  MemberSearchProvider,
  MemberSuggestion,
} from './member-search.provider';

const INDEX = 'smarttask-members';
const REFRESH_MS = 60_000;

/**
 * Elasticsearch cho @mention: analyzer bỏ dấu (asciifolding) + edge_ngram để gõ tới đâu ra tới đó,
 * multi_match fuzziness AUTO để gõ sai một ký tự vẫn ra. Chỉ index thành viên dự án; đồng bộ lười:
 * mỗi dự án được nạp lại từ DB khi có yêu cầu gợi ý mà lần nạp trước đã quá 60 giây (không cần nối mọi sự kiện).
 */
@Injectable()
export class ElasticMemberSearch implements MemberSearchProvider {
  readonly name = 'elasticsearch';
  private readonly logger = new Logger(ElasticMemberSearch.name);
  private readonly client: Client | null;
  private indexReady = false;
  private readonly syncedAt = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    const url = config.get('ELASTICSEARCH_URL', { infer: true });
    const apiKey = config.get('ELASTICSEARCH_API_KEY', { infer: true });
    this.client = url
      ? new Client({
          node: url,
          ...(apiKey ? { auth: { apiKey } } : {}),
          requestTimeout: 3000,
          maxRetries: 1,
        })
      : null;
  }

  get configured(): boolean {
    return this.client !== null;
  }

  async suggestProjectMembers(
    projectId: string,
    q: string | undefined,
    limit: number,
  ): Promise<MemberSuggestion[]> {
    if (!this.client) throw new Error('ELASTICSEARCH_URL chưa cấu hình');
    await this.ensureIndex();
    await this.syncProject(projectId);
    const term = (q ?? '').trim();
    const res = await this.client.search<MemberDoc>({
      index: INDEX,
      size: limit,
      query: {
        bool: {
          filter: [{ term: { projectId } }],
          ...(term
            ? {
                must: [
                  {
                    bool: {
                      should: [
                        {
                          multi_match: {
                            query: term,
                            fields: ['fullName^3', 'shortName^4', 'email'],
                            fuzziness: 'AUTO',
                            prefix_length: 1,
                          },
                        },
                        {
                          multi_match: {
                            query: term,
                            fields: [
                              'fullName.prefix^2',
                              'shortName.prefix^3',
                              'email.prefix',
                            ],
                          },
                        },
                        {
                          match_phrase_prefix: {
                            fullName: { query: term, boost: 2 },
                          },
                        },
                      ],
                      minimum_should_match: 1,
                    },
                  },
                ],
              }
            : {}),
        },
      },
      sort: term
        ? ['_score', { 'fullName.keyword': 'asc' }]
        : [{ role: 'asc' }, { 'fullName.keyword': 'asc' }],
    });
    return res.hits.hits.map((h) => ({
      id: h._source!.userId,
      fullName: h._source!.fullName,
      shortName: h._source!.shortName,
      email: h._source!.email,
      avatarUrl: h._source!.avatarUrl,
      role: h._source!.role,
      score: h._score ?? 0,
    }));
  }

  private async ensureIndex(): Promise<void> {
    if (this.indexReady || !this.client) return;
    const exists = await this.client.indices.exists({ index: INDEX });
    if (!exists) {
      await this.client.indices.create({
        index: INDEX,
        settings: {
          analysis: {
            filter: { edge: { type: 'edge_ngram', min_gram: 1, max_gram: 15 } },
            analyzer: {
              vi_folding: {
                type: 'custom',
                tokenizer: 'standard',
                filter: ['lowercase', 'asciifolding'],
              },
              vi_prefix: {
                type: 'custom',
                tokenizer: 'standard',
                filter: ['lowercase', 'asciifolding', 'edge'],
              },
              vi_prefix_search: {
                type: 'custom',
                tokenizer: 'standard',
                filter: ['lowercase', 'asciifolding'],
              },
            },
          },
        },
        mappings: {
          properties: {
            projectId: { type: 'keyword' },
            userId: { type: 'keyword' },
            role: { type: 'keyword' },
            fullName: {
              type: 'text',
              analyzer: 'vi_folding',
              fields: {
                prefix: {
                  type: 'text',
                  analyzer: 'vi_prefix',
                  search_analyzer: 'vi_prefix_search',
                },
                keyword: { type: 'keyword' },
              },
            },
            shortName: {
              type: 'text',
              analyzer: 'vi_folding',
              fields: {
                prefix: {
                  type: 'text',
                  analyzer: 'vi_prefix',
                  search_analyzer: 'vi_prefix_search',
                },
              },
            },
            email: {
              type: 'text',
              analyzer: 'vi_folding',
              fields: {
                prefix: {
                  type: 'text',
                  analyzer: 'vi_prefix',
                  search_analyzer: 'vi_prefix_search',
                },
              },
            },
            avatarUrl: { type: 'keyword', index: false },
          },
        },
      });
      this.logger.log(`Đã tạo index ${INDEX}`);
    }
    this.indexReady = true;
  }

  /** Nạp lại toàn bộ thành viên của dự án (xoá cũ, ghi mới) — ≤ 200 người nên rẻ hơn nối mọi sự kiện. */
  private async syncProject(projectId: string): Promise<void> {
    if (!this.client) return;
    const last = this.syncedAt.get(projectId) ?? 0;
    if (Date.now() - last < REFRESH_MS) return;
    const members = await this.prisma.projectMember.findMany({
      where: { projectId, user: { isActive: true } },
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
    });
    await this.client.deleteByQuery({
      index: INDEX,
      query: { term: { projectId } },
      refresh: true,
      conflicts: 'proceed',
    });
    if (members.length) {
      const body = members.flatMap((m) => [
        { index: { _index: INDEX, _id: `${projectId}:${m.user.id}` } },
        {
          projectId,
          userId: m.user.id,
          role: m.role,
          fullName: m.user.fullName,
          shortName: m.user.shortName,
          email: m.user.email,
          avatarUrl: m.user.avatarUrl,
        } satisfies MemberDoc,
      ]);
      await this.client.bulk({ operations: body, refresh: 'wait_for' });
    }
    this.syncedAt.set(projectId, Date.now());
  }

  /** Làm mới ngay (gọi khi thêm/gỡ thành viên hoặc đổi hồ sơ) */
  invalidate(projectId: string): void {
    this.syncedAt.delete(projectId);
  }
}

interface MemberDoc {
  projectId: string;
  userId: string;
  role: string;
  fullName: string;
  shortName: string | null;
  email: string;
  avatarUrl: string | null;
}
