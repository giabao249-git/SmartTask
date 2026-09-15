import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { createReadStream, mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import {
  CurrentUser,
  type JwtUser,
} from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AttachmentsService } from './attachments.service';
import { ConfirmAttachmentDto, SignAttachmentDto } from './dto/attachment.dto';
import { LocalStorageProvider } from './storage/local-storage.provider';
import {
  MAX_ATTACHMENT_BYTES,
  STORAGE_PROVIDER,
  type StorageProvider,
} from './storage/storage.provider';

@ApiTags('Đính kèm')
@ApiBearerAuth()
@Controller()
export class AttachmentsController {
  constructor(
    private readonly attachments: AttachmentsService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  @Post('tasks/:id/attachments/sign')
  @ApiOperation({
    summary:
      'Bước 1: ký URL upload (≤ 10 MB); trình duyệt PUT thẳng lên Storage (UC-19)',
  })
  sign(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SignAttachmentDto,
  ) {
    return this.attachments.sign(user.id, id, dto);
  }

  @Post('tasks/:id/attachments')
  @ApiOperation({ summary: 'Bước 2: xác nhận đã tải lên, ghi metadata' })
  confirm(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmAttachmentDto,
  ) {
    return this.attachments.confirm(user.id, id, dto);
  }

  @Get('tasks/:id/attachments')
  list(@CurrentUser() user: JwtUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.attachments.list(user.id, id);
  }

  @Get('attachments/:id/download-url')
  @ApiOperation({ summary: 'URL tải có hạn 15 phút' })
  downloadUrl(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.attachments.downloadUrl(user.id, id);
  }

  @Delete('attachments/:id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.attachments.remove(user.id, id);
  }

  // ── Chỉ dùng khi STORAGE=local (dev/test): nhận PUT và trả GET theo URL đã ký ──

  @Public()
  @Put('attachments/local/:path')
  @ApiExcludeEndpoint()
  localUpload(
    @Param('path') path: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    const local = this.local();
    if (!local || !local.verify('put', path, Number(exp), sig ?? '')) {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: 'URL upload không hợp lệ hoặc đã hết hạn',
      });
      return;
    }
    const body: unknown = (req as Request & { body?: unknown }).body;
    if (
      !Buffer.isBuffer(body) ||
      body.length === 0 ||
      body.length > MAX_ATTACHMENT_BYTES
    ) {
      res.status(422).json({
        code: 'ATTACHMENT_TOO_LARGE',
        message: 'Nội dung rỗng hoặc vượt 10 MB',
      });
      return;
    }
    const disk = local.diskPath(path);
    mkdirSync(dirname(disk), { recursive: true });
    writeFileSync(disk, body);
    res
      .status(200)
      .json({ ok: true, storagePath: path, sizeBytes: body.length });
  }

  @Public()
  @Get('attachments/local/:path')
  @ApiExcludeEndpoint()
  localDownload(
    @Param('path') path: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ): void {
    const local = this.local();
    if (!local || !local.verify('get', path, Number(exp), sig ?? '')) {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: 'URL tải không hợp lệ hoặc đã hết hạn',
      });
      return;
    }
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${path.split('/').pop() ?? 'tep'}"`,
    );
    createReadStream(local.diskPath(path))
      .on('error', () => res.status(404).end())
      .pipe(res);
  }

  private local(): LocalStorageProvider | null {
    return this.storage instanceof LocalStorageProvider ? this.storage : null;
  }
}
