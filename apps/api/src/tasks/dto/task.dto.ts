import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Priority, TaskType } from '@prisma/client';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RequiredSkillDto {
  @ApiProperty() @IsUUID() skillId!: string;
  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  minLevel?: number;
}

export class CreateTaskDto {
  @ApiProperty({ example: 'Đăng nhập bằng Google' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string;
  @ApiPropertyOptional({
    enum: TaskType,
    default: 'TASK',
    description: 'Loại công việc: STORY (tính năng) | TASK (việc chung) | BUG (lỗi)',
  })
  @IsOptional()
  @IsEnum(TaskType)
  type?: TaskType;
  @ApiPropertyOptional({ enum: Priority, default: 'MEDIUM' })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isUrgent?: boolean;
  @ApiPropertyOptional({ default: 3, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty?: number;
  @ApiPropertyOptional({ example: '2026-10-13' })
  @IsOptional()
  @IsDateString()
  startDate?: string;
  @ApiPropertyOptional({ example: '2026-10-20' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
  @ApiPropertyOptional({ example: 8, minimum: 0, maximum: 400 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(400)
  estimateHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() sprintId?: string;
  @ApiPropertyOptional({ description: 'Bỏ trống = cột đầu tiên' })
  @IsOptional()
  @IsUUID()
  columnId?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  labelIds?: string[];
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  assigneeIds?: string[];
  @ApiPropertyOptional({ type: [RequiredSkillDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => RequiredSkillDto)
  requiredSkills?: RequiredSkillDto[];
}

/** Mọi PATCH task mang version hiện có (khoá lạc quan). */
export class VersionedDto {
  @ApiProperty({ example: 3 }) @IsInt() @Min(1) version!: number;
}

export class UpdateTaskDto extends VersionedDto {
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
  @MaxLength(20000)
  description?: string | null;
  @ApiPropertyOptional({ enum: TaskType })
  @IsOptional()
  @IsEnum(TaskType)
  type?: TaskType;
  @ApiPropertyOptional({ enum: Priority })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isUrgent?: boolean;
  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startDate?:
    string | null;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dueDate?: string | null;
  @ApiPropertyOptional({ minimum: 0, maximum: 400 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(400)
  estimateHours?: number | null;
  @ApiPropertyOptional({ description: 'null = về backlog' })
  @IsOptional()
  @IsUUID()
  sprintId?: string | null;
  @ApiPropertyOptional({
    description: 'Gán người thực hiện duy nhất (hoặc null để gỡ)',
  })
  @IsOptional()
  @IsUUID('4')
  assigneeId?: string | null;
  @ApiPropertyOptional({
    type: [String],
    description: 'Danh sách ID người thực hiện',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  assigneeIds?: string[];
}

export class MoveTaskDto extends VersionedDto {
  @ApiProperty() @IsUUID() columnId!: string;
  @ApiPropertyOptional({
    description: 'Bỏ trống = cuối cột. Client tính trung bình hai thẻ lân cận.',
  })
  @IsOptional()
  @IsNumber()
  position?: number;
  @ApiPropertyOptional({
    description: 'Đồng thời chuyển sprint (Gantt/backlog)',
  })
  @IsOptional()
  @IsUUID()
  sprintId?: string | null;
}

export class ProgressDto extends VersionedDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;
  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(400)
  remainingHours?: number;
}

export class AssigneesDto extends VersionedDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  userIds!: string[];
}

export class TaskSkillsDto extends VersionedDto {
  @ApiProperty({ type: [RequiredSkillDto] })
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => RequiredSkillDto)
  skills!: RequiredSkillDto[];
}

export class TaskLabelsDto extends VersionedDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  labelIds!: string[];
}

export class TaskDependenciesDto extends VersionedDto {
  @ApiProperty({
    type: [String],
    description:
      'Task phải xong trước (cùng dự án, không tự trỏ, không tạo vòng)',
  })
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  dependsOnIds!: string[];
}

export class CreateSubtaskDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(400)
  estimateHours?: number;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  assigneeIds?: string[];
}

export class DuplicateTaskDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  withSubtasks?: boolean;
}

export class ListTasksQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() sprintId?: string;
  @ApiPropertyOptional({ description: '"backlog" = chưa thuộc sprint' })
  @IsOptional()
  @IsString()
  backlog?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() assigneeId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() labelId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() columnId?: string;
  @ApiPropertyOptional({ enum: Priority })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;
  @ApiPropertyOptional({ enum: TaskType })
  @IsOptional()
  @IsEnum(TaskType)
  type?: TaskType;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dueFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dueTo?: string;
  @ApiPropertyOptional({ description: 'Tìm trong tiêu đề' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
  @ApiPropertyOptional({ description: 'Chỉ subtask của task này' })
  @IsOptional()
  @IsUUID()
  parentId?: string;
  @ApiPropertyOptional({
    description:
      'ISO time: chỉ trả task đổi sau thời điểm này + deletedIds (đồng bộ sau reconnect)',
  })
  @IsOptional()
  @IsDateString()
  since?: string;
  @ApiPropertyOptional({
    default: false,
    description: 'Kèm subtask trong danh sách phẳng',
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  includeSubtasks?: boolean;
}

export class MyTasksQueryDto {
  @ApiPropertyOptional({ enum: ['open', 'done', 'all'], default: 'open' })
  @IsOptional()
  @IsString()
  status?: 'open' | 'done' | 'all';
  @ApiPropertyOptional() @IsOptional() @IsDateString() dueTo?: string;
}
