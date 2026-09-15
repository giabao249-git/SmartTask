import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';

export class ChannelPrefsDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  taskAssigned?: boolean;
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  mentioned?: boolean;
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  taskDue?: boolean;
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  workloadAlert?: boolean;
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  sprint?: boolean;
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ai?: boolean;
}

export class NotificationPrefsDto {
  @ApiPropertyOptional({ type: ChannelPrefsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelPrefsDto)
  inApp?: ChannelPrefsDto;

  @ApiPropertyOptional({ type: ChannelPrefsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelPrefsDto)
  push?: ChannelPrefsDto;
}
