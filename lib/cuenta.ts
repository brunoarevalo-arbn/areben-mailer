import { cache } from 'react';
import { prisma } from './prisma';
import { decrypt } from './jwt';

// Multi-marca: la cuenta activa sale del `cuentaId` de la sesión (selector de marca).
// OJO: este archivo lo importan también los scripts (sin sesión), por eso NO se
// importa next/headers arriba — se hace import dinámico dentro de getCuentaActiva.

/** Busca una cuenta por slug (para scripts y fallback). Sin sesión. */
export async function getCuentaBySlug(slug: string) {
  const cuenta = await prisma.cuenta.findUnique({ where: { slug } });
  if (!cuenta) throw new Error(`No existe la cuenta con slug "${slug}".`);
  return cuenta;
}

/** Cuenta por defecto cuando no hay sesión válida (bootstrap / fallback). */
async function cuentaFallback() {
  const cuenta =
    (await prisma.cuenta.findUnique({ where: { slug: 'bdi' } })) ??
    (await prisma.cuenta.findFirst({ orderBy: { createdAt: 'asc' } }));
  if (!cuenta) throw new Error('No hay ninguna cuenta creada. Corré scripts/seed.ts');
  return cuenta;
}

/**
 * Cuenta activa según la sesión (marca seleccionada). Memoizada por request.
 * Solo se llama en contexto de request (server components / actions / route handlers).
 */
export const getCuentaActiva = cache(async () => {
  // Import dinámico para que este módulo siga siendo usable desde scripts.
  const { cookies } = await import('next/headers');
  const token = (await cookies()).get('session')?.value;
  const session = await decrypt(token);

  if (session?.cuentaId) {
    const cuenta = await prisma.cuenta.findUnique({ where: { id: session.cuentaId } });
    if (cuenta) return cuenta;
  }
  return cuentaFallback();
});

/** Todas las cuentas/marcas (para el selector). Memoizada por request. */
export const getCuentas = cache(async () => {
  return prisma.cuenta.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, nombre: true, slug: true },
  });
});
