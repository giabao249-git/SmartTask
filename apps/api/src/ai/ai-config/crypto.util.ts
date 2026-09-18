import * as crypto from 'crypto';

/**
 * Mã hoá khoá API nhà cung cấp AI trước khi lưu `ai_configs.api_key_encrypted` (docs 08 §2).
 * Kế thừa ELPREP `ai/crypto.util.ts`: AES-256-GCM (có thẻ xác thực — bản mã bị sửa một byte là phát hiện,
 * không giải ra rác rồi lặng lẽ gửi đi làm khoá). Khoá AES = sha256(APP_KEY) để APP_KEY là chuỗi bí mật bất kỳ.
 * CỐ Ý không có khoá mặc định: thiếu APP_KEY → không lưu được khoá (lỗi rõ), không phải "mã hoá hình thức".
 * Định dạng lưu: base64(iv):base64(authTag):base64(cipher).
 */
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

export function isEncryptionConfigured(): boolean {
  return (process.env.APP_KEY ?? '').length >= 8;
}

function key(): Buffer {
  const raw = process.env.APP_KEY;
  if (!raw || raw.length < 8)
    throw new Error(
      'APP_KEY chưa đặt (≥ 8 ký tự) — cần để mã hoá khoá API AI lưu trong CSDL.',
    );
  return crypto.createHash('sha256').update(raw).digest();
}

export function encryptSecret(plain: string): string {
  if (!plain) throw new Error('Khoá rỗng, không mã hoá được.');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    enc.toString('base64'),
  ].join(':');
}

/** Ném lỗi khi hỏng — không trả lại bản mã để rồi nhà cung cấp báo 401 sai hướng điều tra. */
export function decryptSecret(encrypted: string): string {
  const parts = (encrypted ?? '').split(':');
  if (parts.length !== 3)
    throw new Error(
      'Khoá API trong CSDL không đúng định dạng iv:tag:cipher — nhập lại ở màn Cấu hình AI.',
    );
  try {
    const [iv, tag, data] = parts;
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key(),
      Buffer.from(iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(data, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new Error(
      'Không giải mã được khoá API — thường do APP_KEY đã đổi từ lúc lưu. Nhập lại khoá ở màn Cấu hình AI.',
    );
  }
}

/** Chỉ lộ 4 ký tự cuối — đủ nhận ra khoá nào, không đủ dùng lại. */
export function maskSecret(
  encrypted: string | null | undefined,
): string | null {
  if (!encrypted) return null;
  try {
    return `••••${decryptSecret(encrypted).slice(-4)}`;
  } catch {
    return '•••• (không đọc được — cần nhập lại)';
  }
}

/** Vân tay prompt: 32 ký tự đầu SHA-256 (docs 07 §2) — trả lời "hai lượt có cùng prompt không" mà không lưu prompt. */
export function hashPrompt(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 32);
}
