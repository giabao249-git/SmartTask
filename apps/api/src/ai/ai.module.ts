import { Module } from '@nestjs/common';
import { ForecastModule } from '../forecast/forecast.module';
import { TasksModule } from '../tasks/tasks.module';
import { WorkloadModule } from '../workload/workload.module';
import { AiAdminController } from './ai-admin.controller';
import { AiConfigService } from './ai-config/ai-config.service';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ChatController } from './chat/chat.controller';
import { ChatService } from './chat/chat.service';
import { IdentityAdminController } from './chat/identity-admin.controller';
import { IdentityService } from './chat/identity.service';
import { AiQueryController } from './query/query.controller';
import { AiQueryService } from './query/query.service';
import { ContextBuilderService } from './context/context-builder.service';
import { ExecutorService } from './executor/executor.service';
import { ProposalsService } from './proposals/proposals.service';
import { AiProviderService } from './provider/ai-provider.service';
import { GeminiPromptCacheService } from './provider/gemini-prompt-cache.service';
import { QuotaService } from './quota/quota.service';
import { ActionValidatorService } from './validator/action-validator.service';

/**
 * Phase 7 — AI MVP (docs 05): ContextBuilder → PromptAssembler → AiProvider → ResponseParser → ActionValidator →
 * ai_proposals → Executor (TasksService). Cấu hình/catalog/prompt/sổ token đọc từ DB (ai-config).
 */
@Module({
  imports: [WorkloadModule, ForecastModule, TasksModule],
  controllers: [
    AiController,
    AiAdminController,
    ChatController,
    IdentityAdminController,
    AiQueryController,
  ],
  providers: [
    AiConfigService,
    GeminiPromptCacheService,
    AiProviderService,
    ContextBuilderService,
    ActionValidatorService,
    ProposalsService,
    ExecutorService,
    QuotaService,
    AiService,
    ChatService,
    IdentityService,
    AiQueryService,
  ],
  exports: [AiConfigService, AiProviderService],
})
export class AiModule {}
