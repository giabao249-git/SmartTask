import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateSkillDto {
  @ApiProperty({ example: 'GraphQL' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;
  @ApiPropertyOptional({ example: 'Backend' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(40)
  category?: string;
  @ApiPropertyOptional({ type: [String], example: ['GQL'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  aliases?: string[];
}

export class UpdateSkillDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(40)
  category?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional({
    type: [String],
    description: 'Thay toàn bộ danh sách alias',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  aliases?: string[];
}

export class MergeSkillDto {
  @ApiProperty({
    description:
      'Kỹ năng đích; kỹ năng nguồn bị xoá, tên của nó thành alias của đích',
  })
  @IsUUID()
  intoSkillId!: string;
}

export class UserSkillItemDto {
  @ApiProperty() @IsUUID() skillId!: string;
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  level!: number;
}

export class PutMySkillsDto {
  @ApiProperty({
    type: [UserSkillItemDto],
    description: 'Thay toàn bộ kỹ năng của tôi trong workspace này',
  })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => UserSkillItemDto)
  skills!: UserSkillItemDto[];
}

export class VerifySkillDto {
  @ApiProperty({
    minimum: 1,
    maximum: 5,
    description: 'Mức PM xác nhận (có thể khác mức tự khai)',
  })
  @IsInt()
  @Min(1)
  @Max(5)
  level!: number;
}

export class SkillMatrixQueryDto {
  @ApiPropertyOptional({ description: 'Lọc thành viên dự án (Phase 3)' })
  @IsOptional()
  @IsUUID()
  projectId?: string;
  @ApiPropertyOptional({ default: 3, description: 'Ngưỡng tính bus factor' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  minLevel?: number;
}
