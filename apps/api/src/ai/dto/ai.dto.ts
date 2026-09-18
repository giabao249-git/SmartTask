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
  @ApiPropertyOptional({ type: ProposalEditsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProposalEditsDto)
  edits?: ProposalEditsDto;
}

export class RejectProposalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
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
