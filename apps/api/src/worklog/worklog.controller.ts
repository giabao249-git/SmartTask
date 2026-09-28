import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../common/decorators/current-user.decorator';
import {
  CreateTimeEntryDto,
  TaskReviewDto,
  UpdateTimeEntryDto,
} from './dto/worklog.dto';
import { WorklogService } from './worklog.service';

@ApiTags('Giờ làm & đánh giá')
@ApiBearerAuth()
@Controller()
export class WorklogController {
  constructor(private readonly worklog: WorklogService) {}

  @Get('tasks/:id/time-entries')
  @ApiOperation({ summary: 'Giờ đã ghi cho việc (UC-35)' })
  list(@CurrentUser() user: JwtUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.worklog.listEntries(user.id, id);
  }

  @Post('tasks/:id/time-entries')
  @ApiOperation({
    summary: 'Ghi giờ — người được giao hoặc PM, đứng tên người ghi (UC-35)',
  })
  create(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTimeEntryDto,
  ) {
    return this.worklog.createEntry(user.id, id, dto);
  }

  @Patch('time-entries/:id')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTimeEntryDto,
  ) {
    return this.worklog.updateEntry(user.id, id, dto);
  }

  @Delete('time-entries/:id')
  remove(@CurrentUser() user: JwtUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.worklog.deleteEntry(user.id, id);
  }

  @Get('tasks/:id/review')
  @ApiOperation({
    summary: 'Đánh giá việc — chỉ người được giao và PM thấy nội dung (UC-36)',
  })
  getReview(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.worklog.getReview(user.id, id);
  }

  @Put('tasks/:id/review')
  @ApiOperation({
    summary:
      'PM đánh giá việc đã xong: chất lượng, độ khó thực tế, giờ thực tế (UC-36)',
  })
  putReview(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TaskReviewDto,
  ) {
    return this.worklog.putReview(user.id, id, dto);
  }
}
