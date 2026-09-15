import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ProjectAccessService } from '../common/access/project-access.service';
import { AppError } from '../common/app-error';
import { PrismaService } from '../prisma/prisma.service';
import type {
  ConfirmAttachmentDto,
  SignAttachmentDto,
} from './dto/attachment.dto';
import {
  MAX_ATTACHMENT_BYTES,
  STORAGE_PROVIDER,
  type StorageProvider,
} from './storage/storage.provider';

const ATTACHMENT_SELECT = {
  id: true,
  taskId: true,
  fileName: true,
  mime: true,
  sizeBytes: true,
  storagePath: true,
  createdAt: true,
  uploader: {
    select: { id: true, fullName: true, shortName: true, avatarUrl: true },
  },
} as const;

/** Tên tệp an toàn cho đường dẫn: bỏ dấu/ký tự lạ, giữ đuôi. */
export function safeFileName(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return base || 'tep';
}

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  /** Bước 1: ký URL upload. storagePath = {workspace}/{project}/{task}/{uuid}-{tên}. */
  async sign(userId: string, taskId: string, dto: SignAttachmentDto) {
    const projectId = await this.access.projectOfTask(taskId);
    const access = await this.access.assertEdit(userId, projectId);
    if (dto.sizeBytes > MAX_ATTACHMENT_BYTES)
      throw new AppError(
        'ATTACHMENT_TOO_LARGE',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    const storagePath = `${access.workspaceId}/${projectId}/${taskId}/${randomUUID()}-${safeFileName(dto.fileName)}`;
    const signed = await this.storage.createSignedUpload(
      storagePath,
      dto.mime,
      dto.sizeBytes,
    );
    return { ...signed, provider: this.storage.name };
  }

  /** Bước 2: sau khi trình duyệt PUT xong, ghi metadata. storagePath phải thuộc đúng task và tệp phải tồn tại. */
  async confirm(userId: string, taskId: string, dto: ConfirmAttachmentDto) {
    const projectId = await this.access.projectOfTask(taskId);
    const access = await this.access.assertEdit(userId, projectId);
    const prefix = `${access.workspaceId}/${projectId}/${taskId}/`;
    if (!dto.storagePath.startsWith(prefix) || dto.storagePath.includes('..'))
      throw AppError.forbidden({ reason: 'storagePath không thuộc task này' });
    if (!(await this.storage.exists(dto.storagePath)))
      throw AppError.notFound({ reason: 'Tệp chưa được tải lên' });
    return this.prisma.attachment.create({
      data: {
        taskId,
        uploaderId: userId,
        fileName: dto.fileName,
        mime: dto.mime,
        sizeBytes: dto.sizeBytes,
        storagePath: dto.storagePath,
      },
      select: ATTACHMENT_SELECT,
    });
  }

  async list(userId: string, taskId: string) {
    const projectId = await this.access.projectOfTask(taskId);
    await this.access.assertRead(userId, projectId);
    return this.prisma.attachment.findMany({
      where: { taskId },
      select: ATTACHMENT_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async downloadUrl(userId: string, attachmentId: string) {
    const a = await this.load(attachmentId);
    const projectId = await this.access.projectOfTask(a.taskId);
    await this.access.assertRead(userId, projectId);
    return this.storage.createDownloadUrl(a.storagePath, a.fileName);
  }

  /** Người tải lên hoặc PM. Xoá bản ghi trước, xoá tệp sau (tệp mồ côi vô hại hơn bản ghi mồ côi). */
  async remove(userId: string, attachmentId: string): Promise<void> {
    const a = await this.load(attachmentId);
    const projectId = await this.access.projectOfTask(a.taskId);
    const access = await this.access.assertEdit(userId, projectId);
    if (a.uploader.id !== userId && !access.canManage)
      throw AppError.forbidden({ required: 'người tải lên hoặc PM' });
    await this.prisma.attachment.delete({ where: { id: attachmentId } });
    await this.storage.remove(a.storagePath).catch(() => undefined);
  }

  private async load(id: string) {
    const a = await this.prisma.attachment.findUnique({
      where: { id },
      select: ATTACHMENT_SELECT,
    });
    if (!a) throw AppError.notFound();
    return a;
  }
}
