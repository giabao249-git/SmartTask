import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlatformRole, WorkspaceLifecycleStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class UpdateWorkspaceStatusDto {
  @ApiProperty({ enum: WorkspaceLifecycleStatus })
  @IsEnum(WorkspaceLifecycleStatus)
  status: WorkspaceLifecycleStatus;

  @ApiProperty({ description: 'Lý do thay đổi trạng thái (phục vụ Audit Log)' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional({
    description: 'Mã ticket hỗ trợ / khiếu nại (ví dụ TIK-992)',
  })
  @IsOptional()
  @IsString()
  ticketReference?: string;
}

export class UpdateUserPlatformRoleDto {
  @ApiPropertyOptional({ description: 'Quyền Super Admin tối cao' })
  @IsOptional()
  @IsBoolean()
  isSuperAdmin?: boolean;

  @ApiPropertyOptional({ enum: PlatformRole, nullable: true })
  @IsOptional()
  @IsEnum(PlatformRole)
  platformRole?: PlatformRole | null;

  @ApiProperty({
    description: 'Lý do phân quyền (bắt buộc cho kiểm toán SOC 2)',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class UpdateUserStatusDto {
  @ApiProperty({
    description:
      'Trạng thái hoạt động (true: mở khóa, false: khóa toàn cục / Global Ban)',
  })
  @IsBoolean()
  isActive: boolean;

  @ApiPropertyOptional({ description: 'Lý do khóa / mở khóa tài khoản' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export type MaintenanceLevel = 'DISABLED' | 'READ_ONLY' | 'FULL';

export class SetMaintenanceModeDto {
  @ApiProperty({ enum: ['DISABLED', 'READ_ONLY', 'FULL'] })
  @IsString()
  mode: MaintenanceLevel;

  @ApiPropertyOptional({ description: 'Lý do kích hoạt bảo trì' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Dự kiến thời gian bảo trì (phút)',
    default: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  expectedDurationMinutes?: number;
}

export class CreateSupportSessionDto {
  @ApiProperty({ description: 'ID của Workspace cần truy cập hỗ trợ' })
  @IsUUID()
  workspaceId: string;

  @ApiProperty({ description: 'Mã ticket hỗ trợ CSKH (ví dụ SUP-104)' })
  @IsString()
  @IsNotEmpty()
  ticketReference: string;

  @ApiProperty({ description: 'Mục đích truy cập hỗ trợ kỹ thuật' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional({
    description: 'Thời gian hiệu lực (giờ, tối đa 8 tiếng)',
    default: 2,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  durationHours?: number;
}

export class QueryWorkspacesDto {
  @ApiPropertyOptional({ description: 'Tìm theo tên hoặc slug' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: WorkspaceLifecycleStatus })
  @IsOptional()
  @IsEnum(WorkspaceLifecycleStatus)
  status?: WorkspaceLifecycleStatus;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;
}

export class QueryUsersDto {
  @ApiPropertyOptional({ description: 'Tìm theo tên hoặc email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: PlatformRole })
  @IsOptional()
  @IsEnum(PlatformRole)
  platformRole?: PlatformRole;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;
}

export class SetAiCircuitBreakerDto {
  @ApiPropertyOptional({
    description:
      'Ngưỡng ngân sách chi phí AI theo ngày (USD), mặc định 100',
  })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  dailyBudgetUsd?: number;

  @ApiPropertyOptional({
    description:
      'Mô phỏng ngắt mạch phục vụ kiểm thử (true: ngắt, false: reset)',
  })
  @IsOptional()
  @IsBoolean()
  simulateTrip?: boolean;

  @ApiPropertyOptional({
    description: 'Lý do thay đổi cấu hình ngắt mạch',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

