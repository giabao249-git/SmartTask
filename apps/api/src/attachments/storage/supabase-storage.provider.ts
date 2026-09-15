import { Injectable, Logger } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  SIGNED_TTL_SECONDS,
  type SignedUpload,
  type StorageProvider,
} from './storage.provider';

/** Supabase Storage: API ký URL, trình duyệt upload/tải thẳng — API không cõng byte tệp. */
@Injectable()
export class SupabaseStorageProvider implements StorageProvider {
  readonly name = 'supabase';
  private readonly logger = new Logger(SupabaseStorageProvider.name);
  private readonly client: SupabaseClient;

  constructor(
    url: string,
    serviceRoleKey: string,
    private readonly bucket: string,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- generic của supabase-js không khớp khi không khai kiểu Database
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    });
    this.logger.log(`Storage: Supabase bucket "${bucket}"`);
  }

  async createSignedUpload(
    storagePath: string,
    mime: string,
  ): Promise<SignedUpload> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUploadUrl(storagePath);
    if (error || !data)
      throw new Error(`Supabase sign upload: ${error?.message ?? 'no data'}`);
    return {
      uploadUrl: data.signedUrl,
      method: 'PUT',
      headers: { 'Content-Type': mime, 'x-upsert': 'false' },
      storagePath,
      expiresAt: new Date(Date.now() + SIGNED_TTL_SECONDS * 1000),
    };
  }

  async createDownloadUrl(
    storagePath: string,
    fileName: string,
  ): Promise<{ url: string; expiresAt: Date }> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(storagePath, SIGNED_TTL_SECONDS, { download: fileName });
    if (error || !data)
      throw new Error(`Supabase sign download: ${error?.message ?? 'no data'}`);
    return {
      url: data.signedUrl,
      expiresAt: new Date(Date.now() + SIGNED_TTL_SECONDS * 1000),
    };
  }

  async exists(storagePath: string): Promise<boolean> {
    const dir = storagePath.split('/').slice(0, -1).join('/');
    const name = storagePath.split('/').pop();
    const { data } = await this.client.storage
      .from(this.bucket)
      .list(dir, { search: name });
    return !!data?.some((f) => f.name === name);
  }

  async remove(storagePath: string): Promise<void> {
    await this.client.storage.from(this.bucket).remove([storagePath]);
  }
}
