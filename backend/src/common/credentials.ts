import {randomBytes, createHash, scrypt, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';

const derive = promisify(scrypt);
export const digest = (value: string): string => createHash('sha256').update(value).digest('hex');
export const secret = (): string => randomBytes(32).toString('base64url');

/** Python hashlib.scrypt's default output is 64 bytes, not Node's usual 32. */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const valid = stored?.match(/^([a-f0-9]{32}):([a-f0-9]{128})$/);
  const salt = Buffer.from(valid?.[1] ?? '0'.repeat(32), 'hex');
  const saved = Buffer.from(valid?.[2] ?? '0'.repeat(128), 'hex');
  const actual = (await derive(password, salt, 64)) as Buffer;
  return timingSafeEqual(actual, saved) && Boolean(valid);
}

export function safeReturnPath(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length > 2048 ||
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\r\n]/.test(value)
  )
    return '/';
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith('//') || /[\\\r\n]/.test(decoded)) return '/';
    const url = new URL(value, 'https://local.invalid');
    return url.origin === 'https://local.invalid' ? `${url.pathname}${url.search}${url.hash}` : '/';
  } catch {
    return '/';
  }
}
