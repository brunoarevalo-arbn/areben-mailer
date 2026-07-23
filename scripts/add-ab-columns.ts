// Agrega las columnas de A/B de asunto por SQL crudo (aditivo, idempotente).
// OJO: NO usar `prisma db push` en esta base — la comparte con areben-popups
// y push dropearía sus tablas. Cambios de schema por SQL crudo.
// Correr:  node --env-file=.env scripts/add-ab-columns.ts
import { prisma } from '../lib/prisma.ts';

const STMTS = [
  'ALTER TABLE "Campania" ADD COLUMN IF NOT EXISTS "asuntoB" TEXT;',
  'ALTER TABLE "Campania" ADD COLUMN IF NOT EXISTS "abTestPct" INTEGER;',
  'ALTER TABLE "Campania" ADD COLUMN IF NOT EXISTS "abGanador" TEXT;',
  'ALTER TABLE "Campania" ADD COLUMN IF NOT EXISTS "abResueltoAt" TIMESTAMP(3);',
  'ALTER TABLE "Envio" ADD COLUMN IF NOT EXISTS "variante" TEXT;',
];

async function main() {
  for (const sql of STMTS) {
    await prisma.$executeRawUnsafe(sql);
    console.log('✓', sql);
  }
  console.log('Listo: columnas A/B aseguradas.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
