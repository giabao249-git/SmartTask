import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiCacheMode,
  AiLogStatus,
  AiPromptType,
  AiProvider,
  AiPurpose,
  PlatformRole,
  Prisma,
  WorkspaceRole,
} from '@prisma/client';
import { WorkspaceAccessService } from '../../common/access/workspace-access.service';
import { AppError } from '../../common/app-error';
import type { Env } from '../../config/env.schema';
import { PrismaService } from '../../prisma/prisma.service';
import { MASTER_PROMPT } from '../prompt/master-prompt';
import {
  advancedParamsSchema,
  parseAdvancedParams,
  type AdvancedParams,
} from './advanced-params';
import { AI_CATALOG_SEED } from './ai-catalog.seed';
import {
  decryptSecret,
  encryptSecret,
  isEncryptionConfigured,
  maskSecret,
} from './crypto.util';
import type {
  CreateAiConfigDto,
  UpdateAiConfigDto,
  UpdateModelCatalogDto,
  UpsertModelCatalogDto,
  UsageCallsQueryDto,
  UsageQueryDto,
} from './dto/ai-config.dto';

/** Nhà cung cấp lúc chạy: enum DB + `FAKE` chỉ từ env cho dev/test. */
export type RuntimeProvider = AiProvider | 'FAKE';

export interface ModelCaps {
  isReasoning: boolean;
  supportsTemperature: boolean;
  supportsStructuredOutput: boolean;
  maxOutputTokenParam: string;
  cacheMode: AiCacheMode;
}

export interface ResolvedAiConfig {
  /** null = dự phòng từ env */
  configId: string | null;
  workspaceId: string | null;
  purpose: AiPurpose;
  provider: RuntimeProvider;
  model: string;
  apiKey: string | null;
  baseUrl: string | null;
  timeoutMs: number;
  caps: ModelCaps;
  /** USD / 1M token */
  prices: { input: number; output: number; cachedInput: number };
  advanced: AdvancedParams;
}

/** Năng lực giả định khi model KHÔNG có trong catalog: phía an toàn (docs 05 §10). */
const DEFAULT_CAPS: ModelCaps = {
  isReasoning: false,
  supportsTemperature: true,
  supportsStructuredOutput: false,
  maxOutputTokenParam: 'maxOutputTokens',
  cacheMode: AiCacheMode.NONE,
};

const CONFIG_SELECT = {
  id: true,
  workspaceId: true,
  name: true,
  catalogId: true,
  apiKeyEncrypted: true,
  baseUrl: true,
  purpose: true,
  advancedParams: true,
  timeoutMs: true,
  isDefault: true,
  isActive: true,
  notes: true,
  createdById: true,
  createdBy: {
    select: {
      id: true,
      fullName: true,
      shortName: true,
      avatarUrl: true,
    },
  },
  createdAt: true,
  updatedAt: true,
  catalog: {
    select: {
      id: true,
      provider: true,
      model: true,
      label: true,
      inputPrice: true,
      outputPrice: true,
      cachedInputPrice: true,
      isReasoning: true,
      supportsTemperature: true,
      supportsStructuredOutput: true,
      maxOutputTokenParam: true,
      cacheMode: true,
      isActive: true,
    },
  },
} as const;
type ConfigRow = Prisma.AiConfigGetPayload<{ select: typeof CONFIG_SELECT }>;

/**
 * Cấu hình AI đọc từ DB mỗi lượt (ai_configs + ai_model_catalog), không viết cứng — đổi model/khoá không cần
 * deploy lại (ELPREP `ai-provider.service.ts` resolveConfig; Table_Calendar `AiConfig.purpose`).
 * Thứ tự chọn: (workspace, purpose) → (workspace, GENERAL) → (hệ thống, purpose) → (hệ thống, GENERAL) → env.
 */
@Injectable()
export class AiConfigService implements OnModuleInit {
  private readonly logger = new Logger(AiConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly wsAccess: WorkspaceAccessService,
  ) {}

  /** Nạp danh mục model đã thử thật (idempotent theo (provider, model); không ghi đè giá Admin đã sửa). */
  async onModuleInit(): Promise<void> {
    try {
      for (const row of AI_CATALOG_SEED) {
        await this.prisma.aiModelCatalog.upsert({
          where: {
            provider_model: { provider: row.provider, model: row.model },
          },
          create: row,
          update: {},
        });
      }
    } catch (e) {
      this.logger.warn(`Không nạp được danh mục model: ${String(e)}`);
    }
  }

  // ── Chọn cấu hình lúc chạy ─────────────────────────────────

  async resolve(
    workspaceId: string | null,
    purpose: AiPurpose,
    userId?: string,
  ): Promise<ResolvedAiConfig> {
    // Chỉ e2e/CI mới ép provider giả; môi trường thường ưu tiên cấu hình AI của workspace.
    if (this.config.get('AI_FORCE_FAKE', { infer: true }))
      return this.fromEnv(purpose);
    const rows = await this.prisma.aiConfig.findMany({
      where: {
        isActive: true,
        purpose: { in: [purpose, AiPurpose.GENERAL] },
        OR: [{ workspaceId: workspaceId ?? undefined }, { workspaceId: null }],
      },
      select: CONFIG_SELECT,
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });

    // 1. Ưu tiên cấu hình BYOK cá nhân của user trước (nếu có cấu hình riêng đang bật cho purpose này hoặc GENERAL)
    const personalPick = userId
      ? rows.find(
          (r) =>
            r.workspaceId === workspaceId &&
            r.createdById === userId &&
            r.purpose === purpose,
        ) ??
        rows.find(
          (r) =>
            r.workspaceId === workspaceId &&
            r.createdById === userId &&
            r.purpose === AiPurpose.GENERAL,
        )
      : null;

    if (personalPick) return this.fromRow(personalPick, purpose);

    // 2. Dự phòng cấu hình dùng chung của Workspace
    const pick =
      rows.find(
        (r) => r.workspaceId === workspaceId && r.purpose === purpose,
      ) ??
      rows.find(
        (r) => r.workspaceId === workspaceId && r.purpose === AiPurpose.GENERAL,
      ) ??
      rows.find((r) => r.workspaceId === null && r.purpose === purpose) ??
      rows.find(
        (r) => r.workspaceId === null && r.purpose === AiPurpose.GENERAL,
      );
    if (pick) return this.fromRow(pick, purpose);
    return this.fromEnv(purpose);
  }

  private fromRow(row: ConfigRow, purpose: AiPurpose): ResolvedAiConfig {
    const c = row.catalog;
    let apiKey: string | null = null;
    if (row.apiKeyEncrypted) {
      try {
        apiKey = decryptSecret(row.apiKeyEncrypted);
      } catch (e) {
        throw new AppError(
          'AI_CONFIG_INVALID',
          HttpStatus.SERVICE_UNAVAILABLE,
          { configId: row.id },
          (e as Error).message,
        );
      }
    }
    // Gemini cho phép cấu hình DB không kèm khoá → dùng GEMINI_API_KEY của máy chủ (một khoá dùng chung khi demo)
    if (!apiKey && c.provider === AiProvider.GEMINI)
      apiKey = this.config.get('GEMINI_API_KEY', { infer: true }) ?? null;
    return {
      configId: row.id,
      workspaceId: row.workspaceId,
      purpose,
      provider: c.provider,
      model: c.model,
      apiKey,
      baseUrl: row.baseUrl,
      timeoutMs: row.timeoutMs,
      caps: {
        isReasoning: c.isReasoning,
        supportsTemperature: c.supportsTemperature,
        supportsStructuredOutput: c.supportsStructuredOutput,
        maxOutputTokenParam: c.maxOutputTokenParam,
        cacheMode: c.cacheMode,
      },
      prices: this.prices(c),
      advanced: this.safeAdvanced(row.advancedParams),
    };
  }

  private async fromEnv(purpose: AiPurpose): Promise<ResolvedAiConfig> {
    const providerEnv = this.config.get('AI_PROVIDER', { infer: true });
    if (providerEnv === 'fake' || providerEnv === 'mock')
      return {
        configId: null,
        workspaceId: null,
        purpose,
        provider: 'FAKE',
        model: providerEnv,
        apiKey: null,
        baseUrl: null,
        timeoutMs: 5000,
        caps: { ...DEFAULT_CAPS, supportsStructuredOutput: true },
        prices: { input: 0, output: 0, cachedInput: 0 },
        advanced: parseAdvancedParams({}),
      };
    const provider =
      providerEnv === 'ollama' ? AiProvider.OLLAMA : AiProvider.GEMINI;
    const model =
      provider === AiProvider.OLLAMA
        ? this.config.get('OLLAMA_MODEL', { infer: true })
        : this.config.get('GEMINI_MODEL', { infer: true });
    const catalog = await this.prisma.aiModelCatalog.findUnique({
      where: { provider_model: { provider, model } },
    });
    return {
      configId: null,
      workspaceId: null,
      purpose,
      provider,
      model,
      apiKey:
        provider === AiProvider.GEMINI
          ? (this.config.get('GEMINI_API_KEY', { infer: true }) ?? null)
          : null,
      baseUrl:
        provider === AiProvider.OLLAMA
          ? this.config.get('OLLAMA_BASE_URL', { infer: true })
          : null,
      timeoutMs: 30_000,
      caps: catalog
        ? {
            isReasoning: catalog.isReasoning,
            supportsTemperature: catalog.supportsTemperature,
            supportsStructuredOutput: catalog.supportsStructuredOutput,
            maxOutputTokenParam: catalog.maxOutputTokenParam,
            cacheMode: catalog.cacheMode,
          }
        : DEFAULT_CAPS,
      prices: catalog
        ? this.prices(catalog)
        : { input: 0, output: 0, cachedInput: 0 },
      advanced: parseAdvancedParams({}),
    };
  }

  private prices(c: {
    provider: AiProvider;
    inputPrice: number;
    outputPrice: number;
    cachedInputPrice: number | null;
  }) {
    // Không có giá riêng cho token đã cache → Gemini ~25%, còn lại 50% giá thường (docs 07 §5)
    const ratio = c.provider === AiProvider.GEMINI ? 0.25 : 0.5;
    return {
      input: c.inputPrice,
      output: c.outputPrice,
      cachedInput: c.cachedInputPrice ?? c.inputPrice * ratio,
    };
  }

  private safeAdvanced(raw: unknown): AdvancedParams {
    try {
      return parseAdvancedParams(raw);
    } catch {
      return parseAdvancedParams({});
    }
  }

  // ── Catalog ────────────────────────────────────────────────

  listModels(includeInactive = false) {
    return this.prisma.aiModelCatalog.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { provider: 'asc' }, { model: 'asc' }],
    });
  }

  /**
   * Danh mục model là dữ liệu toàn nền tảng: cho phép hai lớp (docs 13 §2 "Dual-Tier Hybrid") —
   * email trong SYSTEM_ADMIN_EMAILS (lá chắn hạ tầng) HOẶC tài khoản Platform Admin trong CSDL.
   */
  async assertSystemAdmin(user: { id: string; email: string }): Promise<void> {
    const admins = this.config.get('SYSTEM_ADMIN_EMAILS', { infer: true });
    if (admins.includes(user.email.toLowerCase())) return;
    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { isSuperAdmin: true, platformRole: true, isActive: true },
    });
    const ok =
      !!row &&
      row.isActive &&
      (row.isSuperAdmin || row.platformRole === PlatformRole.ROOT_ADMIN);
    if (!ok)
      throw AppError.forbidden({
        required: 'Quản trị nền tảng (SYSTEM_ADMIN_EMAILS hoặc ROOT_ADMIN)',
      });
  }

  upsertModel(dto: UpsertModelCatalogDto) {
    const { provider, model, priceEffectiveFrom, ...rest } = dto;
    const data = {
      ...rest,
      priceEffectiveFrom: priceEffectiveFrom
        ? new Date(priceEffectiveFrom)
        : priceEffectiveFrom === null
          ? null
          : undefined,
    };
    return this.prisma.aiModelCatalog.upsert({
      where: { provider_model: { provider, model } },
      create: { provider, model, ...data },
      update: data,
    });
  }

  async updateModel(id: string, dto: UpdateModelCatalogDto) {
    const { priceEffectiveFrom, ...rest } = dto;
    const found = await this.prisma.aiModelCatalog.findUnique({
      where: { id },
    });
    if (!found) throw AppError.notFound({ id });
    return this.prisma.aiModelCatalog.update({
      where: { id },
      data: {
        ...rest,
        priceEffectiveFrom:
          priceEffectiveFrom === undefined
            ? undefined
            : priceEffectiveFrom
              ? new Date(priceEffectiveFrom)
              : null,
      },
    });
  }

  // ── ai_configs theo workspace (UC-40) ──────────────────────

  async listConfigs(workspaceId: string, userId?: string) {
    let whereClause: Prisma.AiConfigWhereInput = { workspaceId };

    if (userId) {
      const role = await this.wsAccess.roleOf(userId, workspaceId);
      // Nếu là MEMBER: Chỉ thấy cấu hình do workspace cấp (ADMIN/OWNER tạo hoặc hệ thống) + cấu hình của chính mình
      if (role === WorkspaceRole.MEMBER) {
        const admins = await this.prisma.workspaceMember.findMany({
          where: {
            workspaceId,
            role: { in: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN] },
          },
          select: { userId: true },
        });
        const adminUserIds = admins.map((a) => a.userId);

        whereClause = {
          workspaceId,
          OR: [
            { createdById: userId },
            { createdById: null },
            { createdById: { in: adminUserIds } },
          ],
        };
      }
    }

    const rows = await this.prisma.aiConfig.findMany({
      where: whereClause,
      select: CONFIG_SELECT,
      orderBy: [
        { purpose: 'asc' },
        { isDefault: 'desc' },
        { createdAt: 'asc' },
      ],
    });
    return rows.map((r) => this.view(r));
  }

  async createConfig(
    workspaceId: string,
    userId: string,
    dto: CreateAiConfigDto,
  ) {
    const catalog = await this.catalogOrThrow(dto.catalogId);
    const advanced = this.validateAdvanced(dto.advancedParams, catalog);
    const apiKeyEncrypted = this.encryptOrNull(dto.apiKey);
    // Cấu hình ĐANG BẬT phải có khoá dùng được: khoá riêng của workspace hoặc khoá hệ thống trong .env.
    // Cấu hình tạo sẵn ở trạng thái tắt thì cho phép chưa có khoá (điền sau rồi mới bật).
    if (
      dto.isActive !== false &&
      !apiKeyEncrypted &&
      !this.hasSystemKey(catalog.provider)
    )
      throw AppError.unprocessable('AI_CONFIG_INVALID', {
        fields: [
          `Chưa có khoá cho ${catalog.provider}: điền apiKey, hoặc tạo cấu hình ở trạng thái tắt rồi điền sau`,
        ],
      });
    const purpose = dto.purpose ?? AiPurpose.GENERAL;
    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await this.clearDefault(tx, workspaceId, purpose);
      return tx.aiConfig.create({
        data: {
          workspaceId,
          name: dto.name,
          catalogId: catalog.id,
          apiKeyEncrypted,
          baseUrl: dto.baseUrl ?? null,
          purpose,
          advancedParams: advanced,
          timeoutMs: dto.timeoutMs ?? 30_000,
          isDefault: dto.isDefault ?? false,
          isActive: dto.isActive ?? true,
          notes: dto.notes ?? null,
          createdById: userId,
        },
        select: CONFIG_SELECT,
      });
    });
    return this.view(row);
  }

  async updateConfig(userId: string, id: string, dto: UpdateAiConfigDto) {
    const current = await this.configForAdmin(userId, id);
    const catalog = dto.catalogId
      ? await this.catalogOrThrow(dto.catalogId)
      : current.catalog;
    const advanced =
      dto.advancedParams !== undefined
        ? this.validateAdvanced(dto.advancedParams, catalog)
        : undefined;
    const purpose = dto.purpose ?? current.purpose;
    // Bật một cấu hình chưa có khoá (và máy chủ cũng không có khoá hệ thống) là chắc chắn lỗi lúc gọi
    if (
      dto.isActive === true &&
      !dto.apiKey &&
      !current.apiKeyEncrypted &&
      !this.hasSystemKey(catalog.provider)
    )
      throw AppError.unprocessable('AI_CONFIG_INVALID', {
        fields: [
          `Điền khoá API cho ${catalog.provider} trước khi bật cấu hình`,
        ],
      });
    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault)
        await this.clearDefault(tx, current.workspaceId!, purpose, id);
      return tx.aiConfig.update({
        where: { id },
        data: {
          name: dto.name,
          catalogId: catalog.id,
          apiKeyEncrypted: dto.apiKey
            ? this.encryptOrNull(dto.apiKey)
            : undefined,
          baseUrl: dto.baseUrl,
          purpose,
          advancedParams: advanced,
          timeoutMs: dto.timeoutMs,
          isDefault: dto.isDefault,
          isActive: dto.isActive,
          notes: dto.notes,
        },
        select: CONFIG_SELECT,
      });
    });
    return this.view(row);
  }

  async deleteConfig(userId: string, id: string): Promise<void> {
    await this.configForAdmin(userId, id);
    await this.prisma.aiConfig.delete({ where: { id } });
  }

  /** Cấu hình đã giải mã để `POST /ai-configs/:id/test` gọi thử. */
  async resolveById(userId: string, id: string): Promise<ResolvedAiConfig> {
    const row = await this.configForAdmin(userId, id);
    return this.fromRow(row, row.purpose);
  }

  private async configForAdmin(userId: string, id: string): Promise<ConfigRow> {
    const row = await this.prisma.aiConfig.findUnique({
      where: { id },
      select: CONFIG_SELECT,
    });
    if (!row || !row.workspaceId) throw AppError.notFound({ id });

    // Hỗ trợ BYOK cá nhân: Người tạo được toàn quyền sửa/xóa/gọi thử cấu hình của chính mình
    if (row.createdById === userId) {
      await this.wsAccess.assertRole(userId, row.workspaceId, [
        WorkspaceRole.OWNER,
        WorkspaceRole.ADMIN,
        WorkspaceRole.MEMBER,
      ]);
      return row;
    }

    // Nếu không phải người tạo, yêu cầu vai trò OWNER hoặc ADMIN của workspace
    await this.wsAccess.assertRole(userId, row.workspaceId, [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
    ]);
    return row;
  }

  /** Máy chủ có sẵn khoá hệ thống cho nhà cung cấp này không (để cấu hình không cần khoá riêng). */
  private hasSystemKey(provider: AiProvider): boolean {
    const key =
      provider === AiProvider.GEMINI
        ? this.config.get('GEMINI_API_KEY', { infer: true })
        : provider === AiProvider.DEEPSEEK
          ? this.config.get('DEEPSEEK_API_KEY', { infer: true })
          : provider === AiProvider.OPENAI
            ? this.config.get('OPENAI_API_KEY', { infer: true })
            : 'ollama-không-cần-khoá';
    return !!key;
  }

  private async catalogOrThrow(id: string) {
    const c = await this.prisma.aiModelCatalog.findUnique({ where: { id } });
    if (!c || !c.isActive) throw AppError.notFound({ catalogId: id });
    return c;
  }

  private validateAdvanced(
    raw: unknown,
    catalog: { provider: AiProvider; cacheMode: AiCacheMode },
  ): AdvancedParams {
    const parsed = advancedParamsSchema.safeParse(raw ?? {});
    if (!parsed.success)
      throw AppError.unprocessable('AI_CONFIG_INVALID', {
        fields: parsed.error.issues.map(
          (i) => `advancedParams.${i.path.join('.')}: ${i.message}`,
        ),
      });
    // Guard hopVoiNhaCungCap (docs 07 §3): bật cache mà model không khai cache_mode → từ chối, không đoán
    if (
      parsed.data.promptCache.enabled &&
      catalog.cacheMode === AiCacheMode.NONE
    )
      throw AppError.unprocessable('AI_CONFIG_INVALID', {
        fields: [
          `Model ${catalog.provider} này khai cache_mode = NONE, không bật promptCache được`,
        ],
      });
    return parsed.data;
  }

  private encryptOrNull(apiKey?: string): string | null {
    if (!apiKey) return null;
    if (!isEncryptionConfigured())
      throw new AppError(
        'AI_KEY_ENCRYPTION_MISSING',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    return encryptSecret(apiKey);
  }

  private async clearDefault(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    purpose: AiPurpose,
    exceptId?: string,
  ) {
    await tx.aiConfig.updateMany({
      where: {
        workspaceId,
        purpose,
        isDefault: true,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      data: { isDefault: false },
    });
  }

  private view(r: ConfigRow) {
    const { apiKeyEncrypted, ...rest } = r;
    return {
      ...rest,
      apiKeyMasked: maskSecret(apiKeyEncrypted),
      hasApiKey: !!apiKeyEncrypted,
      // Không có khoá riêng thì có dùng được khoá hệ thống trong .env không — để UI nói đúng
      // "Dùng khoá hệ thống" hay "Chưa có khoá, điền để bật".
      usesSystemKey: !apiKeyEncrypted && this.hasSystemKey(r.catalog.provider),
    };
  }

  // ── Prompt có phiên bản ────────────────────────────────────

  /** MASTER: bản active hệ thống (workspace null) hoặc mặc định trong mã (version 0). WORKSPACE: bản active của workspace. */
  async getPrompt(workspaceId: string, type: AiPromptType) {
    const row = await this.prisma.aiPromptConfig.findFirst({
      where: {
        type,
        isActive: true,
        workspaceId: type === AiPromptType.MASTER ? null : workspaceId,
      },
      orderBy: { version: 'desc' },
    });
    if (row)
      return {
        type,
        content: row.content,
        version: row.version,
        changeNote: row.changeNote,
        updatedAt: row.createdAt,
        readOnly: type === AiPromptType.MASTER,
      };
    return {
      type,
      content: type === AiPromptType.MASTER ? MASTER_PROMPT : '',
      version: 0,
      changeNote: null,
      updatedAt: null,
      readOnly: type === AiPromptType.MASTER,
    };
  }

  /** Mỗi lần PUT là một phiên bản mới; bản cũ giữ lại để ai_token_logs.workspace_prompt_version còn tra được. */
  async putPrompt(
    workspaceId: string,
    userId: string,
    type: AiPromptType,
    content: string,
    changeNote?: string,
  ) {
    if (type === AiPromptType.MASTER)
      throw AppError.forbidden({ reason: 'MASTER prompt chỉ đọc' });
    const row = await this.prisma.$transaction(async (tx) => {
      const last = await tx.aiPromptConfig.findFirst({
        where: { workspaceId, type },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      await tx.aiPromptConfig.updateMany({
        where: { workspaceId, type, isActive: true },
        data: { isActive: false },
      });
      return tx.aiPromptConfig.create({
        data: {
          workspaceId,
          type,
          version: (last?.version ?? 0) + 1,
          content,
          changeNote: changeNote ?? null,
          updatedById: userId,
          isActive: true,
        },
      });
    });
    return {
      type,
      content: row.content,
      version: row.version,
      changeNote: row.changeNote,
      updatedAt: row.createdAt,
      readOnly: false,
    };
  }

  /** Prompt đang hiệu lực + phiên bản — ContextBuilder gọi mỗi lượt. */
  async activePrompts(workspaceId: string) {
    const [master, ws] = await Promise.all([
      this.getPrompt(workspaceId, AiPromptType.MASTER),
      this.getPrompt(workspaceId, AiPromptType.WORKSPACE),
    ]);
    return { master, workspace: ws };
  }

  // ── Sổ token / chi phí (UC-32, 40) ─────────────────────────

  /**
   * Nhật ký TỪNG LƯỢT gọi AI (không gộp): ai gọi, mục đích, model, token vào/ra, chi phí,
   * thời gian, trạng thái. Sổ gộp theo ngày/mục đích/người vẫn giữ ở `usage()`.
   */
  async usageCalls(workspaceId: string, q: UsageCallsQueryDto) {
    const to = q.to ? new Date(q.to) : new Date();
    const from = q.from
      ? new Date(q.from)
      : new Date(to.getTime() - 30 * 86_400_000);
    const toEnd = new Date(to);
    toEnd.setUTCHours(23, 59, 59, 999);
    const where = {
      workspaceId,
      createdAt: { gte: from, lte: toEnd },
      ...(q.purpose ? { purpose: q.purpose } : {}),
      ...(q.userId ? { userId: q.userId } : {}),
      ...(q.status ? { status: q.status } : {}),
    };
    const page = q.page ?? 1;
    const limit = Math.min(q.limit ?? 25, 200);
    const usdVnd = q.usdVnd ?? 26_263;
    const [rows, total] = await Promise.all([
      this.prisma.aiTokenLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          createdAt: true,
          endpoint: true,
          purpose: true,
          provider: true,
          model: true,
          inputTokens: true,
          cachedInputTokens: true,
          outputTokens: true,
          totalTokens: true,
          estimatedCost: true,
          durationMs: true,
          status: true,
          errorMessage: true,
          userMessage: true,
          masterPromptVersion: true,
          workspacePromptVersion: true,
          user: { select: { id: true, fullName: true, shortName: true } },
        },
      }),
      this.prisma.aiTokenLog.count({ where }),
    ]);
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      usdVnd,
      page,
      limit,
      total,
      items: rows.map((r) => ({
        ...r,
        costUsd: round6(r.estimatedCost),
        costVnd: Math.round(r.estimatedCost * usdVnd),
      })),
    };
  }

  async usage(workspaceId: string, q: UsageQueryDto) {
    const to = q.to ? new Date(q.to) : new Date();
    const from = q.from
      ? new Date(q.from)
      : new Date(to.getTime() - 30 * 86_400_000);
    const toEnd = new Date(to);
    toEnd.setUTCHours(23, 59, 59, 999);
    const rows = await this.prisma.aiTokenLog.findMany({
      where: { workspaceId, createdAt: { gte: from, lte: toEnd } },
      select: {
        createdAt: true,
        purpose: true,
        userId: true,
        inputTokens: true,
        cachedInputTokens: true,
        outputTokens: true,
        totalTokens: true,
        estimatedCost: true,
        durationMs: true,
        status: true,
        user: { select: { fullName: true } },
      },
    });
    const usdVnd = q.usdVnd ?? 26_263;
    const groupBy = q.groupBy ?? 'day';
    const keyOf = (r: (typeof rows)[number]) =>
      groupBy === 'day'
        ? r.createdAt.toISOString().slice(0, 10)
        : groupBy === 'purpose'
          ? r.purpose
          : (r.userId ?? '—');
    const acc = new Map<string, ReturnType<typeof emptyRow>>();
    for (const r of rows) {
      const k = keyOf(r);
      const row =
        acc.get(k) ??
        emptyRow(k, groupBy === 'user' ? r.user?.fullName : undefined);
      row.calls += 1;
      row.tokens += r.totalTokens;
      row.cachedTokens += r.cachedInputTokens;
      row.inputTokens += r.inputTokens;
      row.outputTokens += r.outputTokens;
      row.costUsd += r.estimatedCost;
      row.durationMs += r.durationMs;
      if (r.status !== AiLogStatus.SUCCESS) row.errors += 1;
      acc.set(k, row);
    }
    const out = [...acc.values()]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((r) => ({
        ...r,
        costUsd: round6(r.costUsd),
        costVnd: Math.round(r.costUsd * usdVnd),
        avgMs: r.calls ? Math.round(r.durationMs / r.calls) : 0,
        errorRate: r.calls ? round4(r.errors / r.calls) : 0,
        cachedRate: r.inputTokens ? round4(r.cachedTokens / r.inputTokens) : 0,
      }));
    const totals = out.reduce(
      (t, r) => ({
        calls: t.calls + r.calls,
        tokens: t.tokens + r.tokens,
        cachedTokens: t.cachedTokens + r.cachedTokens,
        costUsd: round6(t.costUsd + r.costUsd),
        errors: t.errors + r.errors,
        durationMs: t.durationMs + r.durationMs,
      }),
      {
        calls: 0,
        tokens: 0,
        cachedTokens: 0,
        costUsd: 0,
        errors: 0,
        durationMs: 0,
      },
    );
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      groupBy,
      usdVnd,
      rows: out,
      totals: {
        ...totals,
        costVnd: Math.round(totals.costUsd * usdVnd),
        errorRate: totals.calls ? round4(totals.errors / totals.calls) : 0,
        avgMs: totals.calls ? Math.round(totals.durationMs / totals.calls) : 0,
      },
    };
  }
}

function emptyRow(key: string, label?: string | null) {
  return {
    key,
    label: label ?? key,
    calls: 0,
    tokens: 0,
    inputTokens: 0,
    cachedTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    durationMs: 0,
    errors: 0,
  };
}
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
const round4 = (n: number) => Math.round(n * 1e4) / 1e4;
