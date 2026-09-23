import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AiCacheMode,
  AiLogStatus,
  AiProvider,
  AiPurpose,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** `advanced_params` của ai_configs (docs 07 §3, 08 §2) — validate bằng zod trong service. */
export class CreateAiConfigDto {
  @ApiProperty({ example: 'Gemini Flash cho phân rã' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;
  @ApiProperty({ description: 'ai_model_catalog.id' })
  @IsUUID()
  catalogId!: string;
  @ApiPropertyOptional({
    description: 'Khoá API — mã hoá khi lưu, không bao giờ trả lại',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) baseUrl?:
    string | null;
  @ApiPropertyOptional({ enum: AiPurpose, default: 'GENERAL' })
  @IsOptional()
  @IsEnum(AiPurpose)
  purpose?: AiPurpose;
  @ApiPropertyOptional({
    example: {
      temperature: 0.4,
      maxOutputTokens: 4096,
      promptCache: { enabled: false, ttlSeconds: 3600, minStaticChars: 8000 },
      trace: { enabled: false },
    },
  })
  @IsOptional()
  @IsObject()
  advancedParams?: Record<string, unknown>;
  @ApiPropertyOptional({ default: 30000, minimum: 1000, maximum: 120000 })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(120_000)
  timeoutMs?: number;
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?:
    string | null;
}

export class UpdateAiConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() catalogId?: string;
  @ApiPropertyOptional({
    description: 'Gửi chuỗi mới để thay khoá; bỏ trống = giữ',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) baseUrl?:
    string | null;
  @ApiPropertyOptional({ enum: AiPurpose })
  @IsOptional()
  @IsEnum(AiPurpose)
  purpose?: AiPurpose;
  @ApiPropertyOptional() @IsOptional() @IsObject() advancedParams?: Record<
    string,
    unknown
  >;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(120_000)
  timeoutMs?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?:
    string | null;
}

export class UpsertModelCatalogDto {
  @ApiProperty({ enum: AiProvider }) @IsEnum(AiProvider) provider!: AiProvider;
  @ApiProperty({ example: 'gemini-2.5-flash' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  model!: string;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;
  @ApiPropertyOptional({ description: 'USD / 1M token' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  inputPrice?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) outputPrice?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) cachedInputPrice?:
    number | null;
  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsDateString()
  priceEffectiveFrom?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) contextWindow?:
    number | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isReasoning?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  supportsTemperature?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  supportsStructuredOutput?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() supportsVision?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  maxOutputTokenParam?: string;
  @ApiPropertyOptional({ enum: AiCacheMode })
  @IsOptional()
  @IsEnum(AiCacheMode)
  cacheMode?: AiCacheMode;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}

export class UpdateModelCatalogDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) inputPrice?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) outputPrice?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) cachedInputPrice?:
    number | null;
  @ApiPropertyOptional() @IsOptional() @IsDateString() priceEffectiveFrom?:
    string | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) contextWindow?:
    number | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isReasoning?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  supportsTemperature?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  supportsStructuredOutput?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() supportsVision?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  maxOutputTokenParam?: string;
  @ApiPropertyOptional({ enum: AiCacheMode })
  @IsOptional()
  @IsEnum(AiCacheMode)
  cacheMode?: AiCacheMode;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}

export class PutPromptDto {
  @ApiProperty({ description: '≤ 8.000 ký tự' })
  @IsString()
  @MaxLength(8000)
  content!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  changeNote?: string;
}

export class UsageCallsQueryDto {
  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsDateString()
  from?: string;
  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsDateString()
  to?: string;
  @ApiPropertyOptional({ enum: AiPurpose })
  @IsOptional()
  @IsEnum(AiPurpose)
  purpose?: AiPurpose;
  @ApiPropertyOptional({ description: 'Lọc theo người gọi' })
  @IsOptional()
  @IsUUID()
  userId?: string;
  @ApiPropertyOptional({ enum: AiLogStatus })
  @IsOptional()
  @IsEnum(AiLogStatus)
  status?: AiLogStatus;
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
  @ApiPropertyOptional({ default: 25, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
  @ApiPropertyOptional({ default: 26263 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  usdVnd?: number;
}

export class UsageQueryDto {
  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @IsDateString()
  from?: string;
  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @IsDateString()
  to?: string;
  @ApiPropertyOptional({ enum: ['day', 'purpose', 'user'], default: 'day' })
  @IsOptional()
  @IsEnum(['day', 'purpose', 'user'])
  groupBy?: 'day' | 'purpose' | 'user';
  @ApiPropertyOptional({ default: 26263, description: 'Tỷ giá đổi ra VND' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  usdVnd?: number;
}
