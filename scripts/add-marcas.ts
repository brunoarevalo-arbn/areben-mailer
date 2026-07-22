// Crea las cuentas/marcas nuevas (Zattia, Stunned). Idempotente (upsert por slug).
// Correr:  node --env-file=.env scripts/add-marcas.ts
import { prisma } from '../lib/prisma.ts';

const MARCAS = [
  { slug: 'zattia', nombre: 'Zattia' },
  { slug: 'stunned', nombre: 'Stunned' },
];

async function main() {
  for (const m of MARCAS) {
    const c = await prisma.cuenta.upsert({
      where: { slug: m.slug },
      update: {},
      create: { slug: m.slug, nombre: m.nombre },
    });
    console.log(`✓ ${c.nombre} (${c.slug}) — id ${c.id}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
