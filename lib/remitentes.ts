import { prisma } from './prisma';

/**
 * Remitente a usar en el envío de una marca: el principal, o el más antiguo.
 * Si no hay ninguno, el envío cae al SES_FROM_EMAIL por env (fallback).
 */
export async function getRemitenteEnvio(cuentaId: string) {
  return prisma.remitente.findFirst({
    where: { cuentaId },
    orderBy: [{ esPrincipal: 'desc' }, { createdAt: 'asc' }],
    select: { nombre: true, email: true, responderA: true },
  });
}
