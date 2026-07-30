import { prisma } from './prisma';

/**
 * Remitente a usar en el envío de una marca: el principal, o el más antiguo.
 *
 * ⛔ **`null` significa "esta marca no manda", no "usá el default".** No hay
 * fallback a `SES_FROM_EMAIL`: esa env es una sola para todo el proyecto y
 * hacía que un mail de Stunned saliera firmado por BDI. Ver `armarFrom()`.
 */
export async function getRemitenteEnvio(cuentaId: string) {
  return prisma.remitente.findFirst({
    where: { cuentaId },
    orderBy: [{ esPrincipal: 'desc' }, { createdAt: 'asc' }],
    select: { nombre: true, email: true, responderA: true },
  });
}
