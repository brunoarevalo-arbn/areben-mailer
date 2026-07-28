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

  // ⛔ El `rol` del JWT NO se expone a propósito. El token dura 7 días: si se
  // autorizara con él, degradar a alguien no tendría efecto hasta que se
  // deslogueara. Para autorizar está `autorizar()`/`chequear()` de @/lib/auth,
  // que leen el rol de la base. Sacarlo de acá hace que el compilador impida
  // volver al camino viejo.
  return {
    isAuth: true as const,
    userId: session.userId,
    cuentaId: session.cuentaId,
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
