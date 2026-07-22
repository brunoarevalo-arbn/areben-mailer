import { prisma } from './prisma';

// Single-brand por ahora: devolvemos la cuenta BDI (o la primera que exista).
// Cuando sumemos multi-marca, esto pasa a resolverse por sesión/selector.
export async function getCuentaActiva() {
  const cuenta =
    (await prisma.cuenta.findUnique({ where: { slug: 'bdi' } })) ??
    (await prisma.cuenta.findFirst({ orderBy: { createdAt: 'asc' } }));
  if (!cuenta) throw new Error('No hay ninguna cuenta creada. Corré scripts/seed.ts');
  return cuenta;
}
