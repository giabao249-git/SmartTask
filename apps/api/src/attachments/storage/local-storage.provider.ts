import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, resolve } from 'path';
import {
  SIGNED_TTL_SECONDS,
  type SignedUpload,
  type StorageProvider,
} from './storage.provider';

/**
 * Lưu tệp trên đĩa máy dev/test khi chưa cấu hình Supabase. URL ký bằng HMAC có hạn, cùng hợp đồng với Supabase
 * (PUT để tải lên, GET để tải về) nên frontend không phân biệt. Không dùng trên Render (đĩa không bền).
 */
@Injectable()
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';
  private readonly logger = new Logger(LocalStorageProvider.name);
  readonly root: string;

  constructor(
    private readonly secret: string,
    private readonly baseUrl: string,
    root = 'uploads',
  ) {
    this.root = resolve(root);
    mkdirSync(this.root, { recursive: true });
    this.logger.log(`Storage: thư mục cục bộ ${this.root}`);
  }

  createSignedUpload(storagePath: string, mime: string): Promise<SignedUpload> {
    const exp = Math.floor(Date.now() / 1000) + SIGNED_TTL_SECONDS;
    const sig = this.sign('put', storagePath, exp);
    return Promise.resolve({
      uploadUrl: `${this.baseUrl}/attachments/local/${encodeURIComponent(storagePath)}?exp=${exp}&sig=${sig}`,
      method: 'PUT',
      headers: { 'Content-Type': mime },
      storagePath,
      expiresAt: new Date(exp * 1000),
    });
  }

  createDownloadUrl(
    storagePath: string,
  ): Promise<{ url: string; expiresAt: Date }> {
    const exp = Math.floor(Date.now() / 1000) + SIGNED_TTL_SECONDS;
    const sig = this.sign('get', storagePath, exp);
    return Promise.resolve({
      url: `${this.baseUrl}/attachments/local/${encodeURIComponent(storagePath)}?exp=${exp}&sig=${sig}`,
      expiresAt: new Date(exp * 1000),
    });
  }

  exists(storagePath: string): Promise<boolean> {
    return Promise.resolve(existsSync(this.diskPath(storagePath)));
  }

  remove(storagePath: string): Promise<void> {
    const p = this.diskPath(storagePath);
    if (existsSync(p)) unlinkSync(p);
    return Promise.resolve();
  }

  /** Đường dẫn đĩa luôn nằm trong root — chặn ../ */
  diskPath(storagePath: string): string {
    const p = resolve(join(this.root, storagePath));
    if (!p.startsWith(this.root)) throw new Error('storagePath không hợp lệ');
    return p;
  }

  verify(
    op: 'put' | 'get',
    storagePath: string,
    exp: number,
    sig: string,
  ): boolean {
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000))
      return false;
    const expected = this.sign(op, storagePath, exp);
    return (
      expected.length === sig.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
    );
  }

  private sign(op: string, storagePath: string, exp: number): string {
    return createHmac('sha256', this.secret)
      .update(`${op}:${storagePath}:${exp}`)
      .digest('base64url');
  }
}
