import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { decrypt } from './session';
import { prisma } from './prisma';

// Data Access Layer: centraliza la verificación de sesión. Memoizado por
// render con cache() para no repetir el decrypt/consulta en un mismo pase.

export const verifySession = cache(async () => {
  const cookie = (await cookies()).get('session')?.value;
  const session = await decrypt(cookie);

  if (!session?.userId) {
    redirect('/login');
  }

  return {
    isAuth: true as const,
    userId: session.userId,
    cuentaId: session.cuentaId,
    rol: session.rol,
  };
});

// Usuario de sesión para la UI (DTO acotado, sin passwordHash).
export const getSessionUser = cache(async () => {
  const session = await verifySession();
  try {
    return await prisma.usuario.findUnique({
      where: { id: session.userId },
      select: { id: true, nombre: true, email: true, rol: true, interno: true },
    });
  } catch {
    return null;
  }
});
