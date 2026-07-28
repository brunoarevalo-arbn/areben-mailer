// Envío deja de ser "algo que solo produce una campaña".
//
// Hasta ahora un Envio exigía campaniaId, así que los mails de automation se
// mandaban sin dejar rastro: sin fila, sin pixel, sin clicks, invisibles en el
// home. Después de esto un Envio cuelga de la CUENTA y apunta, opcionalmente, a
// una campaña o a un run de automation.
//
// ⛔ Por SQL crudo a propósito: la base la comparte areben-popups y `prisma db
//    push` quiere dropear sus tablas. Ver el aviso en prisma/schema.prisma.
//
// Correr:  node --import tsx --env-file=.env scripts/add-envio-automation.ts
//
// Idempotente: se puede correr dos veces sin romper nada.
import { prisma } from '../lib/prisma.ts';

async function main() {
  // 1) cuentaId: primero nullable para poder rellenarlo con lo que ya existe.
  await prisma.$executeRawUnsafe(`ALTER TABLE "Envio" ADD COLUMN IF NOT EXISTS "cuentaId" TEXT`);

  const backfill = await prisma.$executeRawUnsafe(`
    UPDATE "Envio" e SET "cuentaId" = c."cuentaId"
    FROM "Campania" c
    WHERE c.id = e."campaniaId" AND e."cuentaId" IS NULL
  `);
  console.log(`   envíos existentes con cuenta asignada: ${backfill}`);

  // Un huérfano dejaría el SET NOT NULL a mitad de camino: mejor saberlo acá.
  const [{ huerfanos }] = await prisma.$queryRawUnsafe<{ huerfanos: bigint }[]>(
    `SELECT COUNT(*) AS huerfanos FROM "Envio" WHERE "cuentaId" IS NULL`,
  );
  if (Number(huerfanos) > 0) throw new Error(`${huerfanos} envío(s) sin cuenta: abortado`);

  await prisma.$executeRawUnsafe(`ALTER TABLE "Envio" ALTER COLUMN "cuentaId" SET NOT NULL`);

  // 2) campaniaId pasa a opcional: un mail de automation no tiene campaña.
  //    El @@unique([campaniaId, contactoId]) sigue sirviendo tal cual está,
  //    porque Postgres considera distintos a dos NULL.
  await prisma.$executeRawUnsafe(`ALTER TABLE "Envio" ALTER COLUMN "campaniaId" DROP NOT NULL`);

  // 3) De qué run de automation salió (uno a uno).
  await prisma.$executeRawUnsafe(`ALTER TABLE "Envio" ADD COLUMN IF NOT EXISTS "automationRunId" TEXT`);

  // 4) Claves foráneas e índices. Postgres no tiene "ADD CONSTRAINT IF NOT
  //    EXISTS", así que se consulta el catálogo antes.
  const constraints: [string, string][] = [
    ['Envio_cuentaId_fkey', `ALTER TABLE "Envio" ADD CONSTRAINT "Envio_cuentaId_fkey"
       FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"(id) ON DELETE CASCADE ON UPDATE CASCADE`],
    ['Envio_automationRunId_fkey', `ALTER TABLE "Envio" ADD CONSTRAINT "Envio_automationRunId_fkey"
       FOREIGN KEY ("automationRunId") REFERENCES "AutomationRun"(id) ON DELETE CASCADE ON UPDATE CASCADE`],
  ];
  for (const [nombre, sql] of constraints) {
    const existe = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT COUNT(*) AS n FROM pg_constraint WHERE conname = '${nombre}'`,
    );
    if (Number(existe[0].n) === 0) {
      await prisma.$executeRawUnsafe(sql);
      console.log(`   + ${nombre}`);
    }
  }

  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Envio_automationRunId_key" ON "Envio"("automationRunId")`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Envio_cuentaId_enviadoAt_idx" ON "Envio"("cuentaId", "enviadoAt")`,
  );

  const cols = await prisma.$queryRawUnsafe<{ column_name: string; is_nullable: string }[]>(
    `SELECT column_name, is_nullable FROM information_schema.columns
     WHERE table_name = 'Envio' AND column_name IN ('cuentaId','campaniaId','automationRunId')
     ORDER BY column_name`,
  );
  console.log('\n── Envio ──');
  for (const c of cols) console.log(`   ${c.column_name.padEnd(16)} nullable: ${c.is_nullable}`);
  console.log('\n✅ Listo. Falta `npx prisma generate` con el schema actualizado.');
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
