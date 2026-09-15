export interface SignedUpload {
  /** Trình duyệt PUT thẳng vào đây (không qua API với Supabase) */
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  storagePath: string;
  expiresAt: Date;
}

export interface StorageProvider {
  readonly name: string;
  createSignedUpload(
    storagePath: string,
    mime: string,
    sizeBytes: number,
  ): Promise<SignedUpload>;
  createDownloadUrl(
    storagePath: string,
    fileName: string,
  ): Promise<{ url: string; expiresAt: Date }>;
  exists(storagePath: string): Promise<boolean>;
  remove(storagePath: string): Promise<void>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const SIGNED_TTL_SECONDS = 15 * 60;
