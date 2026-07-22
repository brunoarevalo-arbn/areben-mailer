// (Sin `import 'server-only'`: node:crypto ya lo hace server-only de hecho —
// un import desde el cliente fallaría al bundlear. Además así corre en scripts.)
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const KEYLEN = 64;

// Hash con scrypt (nativo, sin dependencias frágiles). Formato "salt:hash" en hex.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  stored: string | null | undefined
): Promise<boolean> {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const hashBuf = Buffer.from(hash, 'hex');
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  if (derived.length !== hashBuf.length) return false;
  return timingSafeEqual(derived, hashBuf);
}
