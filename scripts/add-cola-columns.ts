// Columna del lease de la cola de envío del servidor (aditivo, idempotente).
// `procesandoHasta` es un arriendo con vencimiento: el worker que lo toma es el
// único que manda esa campaña. Sin esto, dos invocaciones concurrentes (el cron
// y el auto-encadenamiento) agarrarían los mismos Envio y mandarían duplicados.
//
// OJO: NO usar `prisma db push` en esta base — la comparte con areben-popups
// y push dropearía sus tablas. Cambios de schema por SQL crudo.
// Correr:  node --import tsx --env-file=.env scripts/add-cola-columns.ts
import { prisma } from '../lib/prisma.ts';

const STMTS = [
  'ALTER TABLE "Campania" ADD COLUMN IF NOT EXISTS "procesandoHasta" TIMESTAMP(3);',
  // El worker busca campañas ENVIANDO cuyo lease esté libre o vencido.
  'CREATE INDEX IF NOT EXISTS "Campania_estado_procesandoHasta_idx" ON "Campania"("estado", "procesandoHasta");',
];

async function main() {
  for (const sql of STMTS) {
    await prisma.$executeRawUnsafe(sql);
    console.log('✓', sql);
  }
  console.log('Listo: columna de lease de la cola asegurada.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
