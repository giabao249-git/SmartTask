import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Priority } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class DecomposeDto {
  @ApiProperty({
    example:
      'Xây dựng chức năng quên mật khẩu qua email: nhập email, gửi link 15 phút, đặt mật khẩu mới, khoá sau 5 lần sai.',
    description: 'Mô tả yêu cầu (20–4.000 ký tự)',
  })
  @Transform(trim)
  @IsString()
  @MinLength(20)
  @MaxLength(4000)
  requirement!: string;
  @ApiPropertyOptional({ description: 'Sprint đích; bỏ trống = backlog' })
  @IsOptional()
  @IsUUID()
  sprintId?: string;
  @ApiPropertyOptional({
    enum: ['coarse', 'normal', 'fine'],
    default: 'normal',
  })
  @IsOptional()
  @IsEnum(['coarse', 'normal', 'fine'])
  detail?: 'coarse' | 'normal' | 'fine';
}

export class EditSkillDto {
  @ApiProperty({ description: 'Mã k trong code_map hoặc tên trong danh mục' })
  @IsString()
  @MaxLength(60)
  skill!: string;
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  minLevel?: number;
}

/** Sửa tại chỗ trên thẻ xem trước (05 §5) — chỉ trường người dùng chạm vào. */
export class EditTaskDto {
  @ApiProperty({ example: 'd2' }) @Matches(/^d\d{1,3}$/) draftKey!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(400)
  estimateHours?: number;
  @ApiPropertyOptional({ enum: Priority })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty?: number;
  @ApiPropertyOptional({
    description: 'Mã u trong code_map; null = bỏ người được gợi ý',
    nullable: true,
  })
  @IsOptional()
  @Matches(/^u\d{1,4}$/)
  suggestedAssignee?: string | null;
  @ApiPropertyOptional({ type: [EditSkillDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => EditSkillDto)
  requiredSkills?: EditSkillDto[];
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @Matches(/^d\d{1,3}$/, { each: true })
  dependsOn?: string[];
  @ApiPropertyOptional({ description: 'true = bỏ task này khỏi đề xuất' })
  @IsOptional()
  @IsBoolean()
  remove?: boolean;
}

export class ProposalEditsDto {
  @ApiPropertyOptional({ type: [EditTaskDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => EditTaskDto)
  tasks?: EditTaskDto[];
}

export class ApplyProposalDto {
  @ApiPropertyOptional({
    type: ProposalEditsDto,
    description: 'Sửa tay kiểu form Phase 7 (chỉ DECOMPOSE)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProposalEditsDto)
  edits?: ProposalEditsDto;
  @ApiPropertyOptional({
    type: [String],
    description: 'Duyệt một phần; bỏ trống = mọi item còn DRAFT',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @Matches(/^d\d{1,3}$/, { each: true })
  draftKeys?: string[];
  @ApiPropertyOptional({
    description: 'Khoá lạc quan — lệch → 409 PROPOSAL_VERSION_CONFLICT',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}

export class RejectProposalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
  @ApiPropertyOptional({
    type: [String],
    description: 'Huỷ một phần; bỏ trống = toàn bộ',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @Matches(/^d\d{1,3}$/, { each: true })
  draftKeys?: string[];
}

/** Người sửa tay một item trên panel (docs 12 §5); `patch` theo zod `draftPatchSchema` của shared. */
export class PatchItemDto {
  @ApiProperty({
    example: { estimateHours: 6, suggestedAssignee: 'u2', due: '2026-10-24' },
    description:
      'Trường cần đổi; null = xoá giá trị; mã u/s/k theo code_map của proposal',
  })
  @IsObject()
  patch!: Record<string, unknown>;
  @ApiProperty({ example: 1 }) @IsInt() @Min(1) version!: number;
}

export class ChatDto {
  @ApiProperty() @IsUUID() projectId!: string;
  @ApiPropertyOptional({ description: 'Bỏ trống = tạo phiên mới' })
  @IsOptional()
  @IsUUID()
  sessionId?: string;
  @ApiProperty({ example: 'Cái thứ hai đổi thành 6 giờ, giao Lan' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text!: string;
  @ApiPropertyOptional({
    description: 'Chip người dùng chọn sau ASK_CLARIFICATION',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  selectedCode?: string;
  @ApiPropertyOptional({
    description: 'Sprint đang chọn trên giao diện (ngữ cảnh)',
  })
  @IsOptional()
  @IsUUID()
  sprintId?: string;
}

export class CreateSessionDto {
  @ApiProperty() @IsUUID() projectId!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  title?: string;
}

export class PatchSessionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;
  @ApiPropertyOptional({ description: 'true = lưu trữ, false = mở lại' })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

export class SessionsQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() projectId?: string;
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeArchived?: boolean;
}

export class CreateAliasDto {
  @ApiProperty() @IsUUID() userId!: string;
  @ApiProperty({ example: 'chị Lan' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  alias!: string;
}

export class MemberIdentityDto {
  @ApiPropertyOptional({ example: 'Phòng Phát triển' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  department?: string | null;
  @ApiPropertyOptional({ example: 'Backend' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string | null;
  @ApiPropertyOptional({
    description: 'Quản lý trực tiếp (thành viên workspace); null = bỏ',
  })
  @IsOptional()
  @IsUUID()
  managerUserId?: string | null;
}

export class QuotaQueryDto {
  @ApiPropertyOptional({
    description:
      'Hạn mức theo cài đặt workspace này; bỏ trống = mặc định hệ thống',
  })
  @IsOptional()
  @IsUUID()
  workspaceId?: string;
}
