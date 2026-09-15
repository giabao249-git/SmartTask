import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { ElasticMemberSearch } from './search/elastic-member-search';
import { MemberSearchService } from './search/member-search.service';
import { PgTrgmMemberSearch } from './search/pg-trgm-member-search';

@Module({
  controllers: [CommentsController],
  providers: [
    CommentsService,
    MemberSearchService,
    ElasticMemberSearch,
    PgTrgmMemberSearch,
  ],
  exports: [MemberSearchService],
})
export class CommentsModule {}
