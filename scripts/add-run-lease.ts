// Le da un arriendo a cada `AutomationRun`, como el que ya tiene `Campania`.
//
// EL PROBLEMA QUE RESUELVE: `/api/automations/procesar` leía los runs
// `PENDIENTE` y recién los marcaba `ENVIADO` **después** de mandar el mail. Dos
// invocaciones simultáneas se llevaban los mismos 30 runs y le mandaban el mail
// **dos veces a la misma persona**. Estaba dormido porque el único que llamaba a
// ese endpoint era el cron, que corre solo; deja de estarlo en cuanto Resorty lo
// pincha en cada lead — la Ruleta de BDI hace ~40 por día y dos leads en el
// mismo segundo alcanzan.
//
// Es un lease y no un estado `PROCESANDO` nuevo por dos razones: una columna
// nullable se saca, un valor de enum **no**; y un lease vencido se recupera solo,
// mientras que un run que quedó en `PROCESANDO` porque la función se murió a la
// mitad no vuelve nunca sin un barrendero que lo rescate.
//
// ⛔ SQL crudo, nunca `db push`: la base la comparte areben-popups (Resorty) y
//    Prisma no conoce sus tablas. Ver AGENTS.md, regla 1.
//
// Correr:  node --env-file=.env --import tsx scripts/add-run-lease.ts
//          node --env-file=.env --import tsx scripts/add-run-lease.ts --aplicar
//
// Idempotente: `IF NOT EXISTS` en la columna y en el índice.
import { prisma } from '../lib/prisma.ts';

const aplicar = process.argv.includes('--aplicar');

async function main() {
  const [antes] = await prisma.$queryRaw<{ existe: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'AutomationRun' AND column_name = 'procesandoHasta'
    ) AS existe`;

  console.log(`Columna "AutomationRun"."procesandoHasta": ${antes.existe ? 'YA EXISTE' : 'NO EXISTE'}`);

  if (!aplicar) {
    console.log('\nDry-run. Lo que se correría:');
    console.log('  ALTER TABLE "AutomationRun" ADD COLUMN IF NOT EXISTS "procesandoHasta" TIMESTAMP;');
    console.log('  CREATE INDEX IF NOT EXISTS "AutomationRun_estado_procesandoHasta_idx"');
    console.log('    ON "AutomationRun" (estado, "procesandoHasta");');
    console.log('\nVolvé a correr con --aplicar.');
    return;
  }

  // TIMESTAMP sin zona, igual que `proximoAt` y `createdAt` (verificado contra
  // information_schema): Prisma guarda UTC en esas columnas. Una columna con
  // zona en la misma tabla sería una bomba de husos horarios en el dato del que
  // depende que un mail salga una sola vez.
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "AutomationRun" ADD COLUMN IF NOT EXISTS "procesandoHasta" TIMESTAMP`,
  );
  // El claim filtra por estado + lease; sin este índice hace un seq scan sobre
  // una tabla que crece un run por lead.
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "AutomationRun_estado_procesandoHasta_idx"
     ON "AutomationRun" (estado, "procesandoHasta")`,
  );

  const [despues] = await prisma.$queryRaw<{ existe: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'AutomationRun' AND column_name = 'procesandoHasta'
    ) AS existe`;
  const conLease = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM "AutomationRun" WHERE "procesandoHasta" IS NOT NULL`;

  console.log(`\n✅ Aplicado. Existe ahora: ${despues.existe}. Runs con lease tomado: ${conLease[0].n}`);
  console.log('   (0 es lo correcto: la columna nace NULL para todos.)');
  console.log('\n▶️ Reflejar en schema.prisma y DEPLOYAR antes de que nadie pinche el procesador.');
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
