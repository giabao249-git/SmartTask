import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../common/decorators/current-user.decorator';
import { ForecastService } from './forecast.service';

@ApiTags('Tiến độ')
@ApiBearerAuth()
@Controller('sprints/:id')
export class ForecastController {
  constructor(private readonly forecast: ForecastService) {}

  @Get('burndown')
  @ApiOperation({
    summary: 'Đường lý tưởng / thực tế, vận tốc, ngày scope tăng (UC-30)',
  })
  burndown(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.forecast.burndown(user.id, id);
  }

  @Get('forecast')
  @ApiOperation({
    summary:
      'ETA, mức rủi ro, nguyên nhân đo được — số do backend tính (UC-31)',
  })
  forecastOf(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.forecast.forecast(user.id, id);
  }
}
