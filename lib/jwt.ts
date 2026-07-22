import { SignJWT, jwtVerify } from 'jose';

// Firma/verificación de la sesión (JWT HS256). Runtime-neutral (sin next/headers
// ni server-only) para poder usarse tanto en el proxy como en el server.

export interface SessionPayload {
  userId: string;
  cuentaId: string;
  rol: string;
  [key: string]: unknown;
}

const encodedKey = new TextEncoder().encode(process.env.SESSION_SECRET);

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey);
}

export async function decrypt(
  session: string | undefined = ''
): Promise<SessionPayload | null> {
  if (!session) return null;
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ['HS256'],
    });
    return payload as SessionPayload;
  } catch {
    return null;
  }
}
