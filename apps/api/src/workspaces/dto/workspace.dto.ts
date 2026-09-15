import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { WorkspaceRole } from '@prisma/client';

export class CreateWorkspaceDto {
  @ApiProperty({ example: 'Nhóm SmartTask' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({
    example: 'nhom-smarttask',
    description: 'Tự sinh từ tên nếu bỏ trống; chỉ a-z, 0-9, dấu gạch',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @Matches(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/, {
    message: 'slug chỉ gồm a-z, 0-9, dấu gạch; 3–40 ký tự',
  })
  slug?: string;
}

export class UpdateWorkspaceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  logoUrl?: string;
}

export class TransferOwnershipDto {
  @ApiProperty() @IsUUID() userId!: string;
}

export class UpdateMemberRoleDto {
  @ApiProperty({
    enum: ['ADMIN', 'MEMBER', 'VIEWER'],
    description: 'OWNER chỉ đổi qua transfer-ownership',
  })
  @IsEnum(WorkspaceRole)
  role!: WorkspaceRole;
}

export class ListMembersQueryDto {
  @ApiPropertyOptional({ enum: WorkspaceRole })
  @IsOptional()
  @IsEnum(WorkspaceRole)
  role?: WorkspaceRole;
  @ApiPropertyOptional({ description: 'Tìm theo tên hoặc email' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class CreateInvitationDto {
  @ApiPropertyOptional({
    example: 'huy@example.com',
    description: 'Bỏ trống = link mời chung',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    enum: ['ADMIN', 'MEMBER', 'VIEWER'],
    default: 'MEMBER',
  })
  @IsOptional()
  @IsEnum(WorkspaceRole)
  role?: WorkspaceRole;

  @ApiPropertyOptional({ default: 7, minimum: 1, maximum: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  expiresInDays?: number;
}
