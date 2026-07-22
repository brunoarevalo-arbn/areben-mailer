import 'server-only';
import { cookies } from 'next/headers';
import { encrypt } from './jwt';

export type { SessionPayload } from './jwt';
export { encrypt, decrypt } from './jwt';

// Manejo de la cookie de sesión (server-only). La firma/verificación vive en
// lib/jwt.ts para que el proxy pueda reusarla sin arrastrar next/headers.

const SESSION_COOKIE = 'session';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export async function createSession(
  userId: string,
  cuentaId: string,
  rol: string
): Promise<void> {
  const expiresAt = new Date(Date.now() + MAX_AGE_MS);
  const session = await encrypt({ userId, cuentaId, rol });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  });
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
