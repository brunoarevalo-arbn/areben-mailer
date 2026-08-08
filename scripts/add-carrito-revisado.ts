// `CarritoVisto.revisadoAt`: cuándo le preguntamos a Tiendanube, por última vez,
// si este carrito terminó en compra.
//
// QUÉ RESUELVE. Hasta hoy **nada escribía `RECUPERADO`**: el valor estaba en el
// enum desde el día uno y el plan lo llama *"la única métrica que después
// justifica (o no) pagar por mensaje"*, pero no había un solo call site que lo
// pusiera. La pantalla de Resorty tenía que mostrar "—" en esa casilla, porque un
// 0 se lee como *"mandamos y no recuperamos nada"* —una conclusión— cuando lo que
// había era una ausencia de medición.
//
// 🔴 POR QUÉ UNA COLUMNA Y NO `updatedAt`. Es literalmente el problema que ya
// resolvió `syncAt` en `areben-popups/lib/canjes.ts`: **hay que poder distinguir
// "lo miramos y todavía no compró" de "nunca lo miramos"**, y esa es la
// diferencia entre informar y mentir. `updatedAt` no sirve: lo mueve cualquier
// escritura (el poller le pone el `contactoId` al crear la fila), así que una
// fila recién nacida se vería igual que una ya revisada.
//
// Y el barrido **escribe `revisadoAt` en TODAS las que consulta, no sólo en las
// que cambian de estado** — que es la otra mitad de la misma lección. Sin eso,
// una fila que sigue abierta se re-consultaría en cada corrida y el barrido no
// avanzaría nunca.
//
// ⛔ SQL crudo, nunca `db push`: la base la comparte areben-popups (Resorty) y
//    Prisma no conoce sus tablas. Ver AGENTS.md, regla 1.
//
// Correr:  node --env-file=.env --import tsx scripts/add-carrito-revisado.ts
//          node --env-file=.env --import tsx scripts/add-carrito-revisado.ts --aplicar
//
// ▶️ Después de aplicar: reflejar en schema.prisma y **deployar** antes de que el
//    barrido corra. Orden: script → deploy → recién ahí tocar filas.
import { prisma } from '../lib/prisma.ts';

const aplicar = process.argv.includes('--aplicar');

const COLUMNA = `
ALTER TABLE "CarritoVisto"
  ADD COLUMN IF NOT EXISTS "revisadoAt" TIMESTAMP`;

// El índice del barrido. Es PARCIAL sobre `estado = 'ENCOLADO'` porque esa es la
// única población que se consulta —los sembrados, los descartados y los ya
// recuperados no se vuelven a mirar—, y hoy son 244 filas contra un puñado.
//
// ⚠️ Parcial pero **no único**: un índice único parcial cambia el comportamiento
// de un `ON CONFLICT` (es el defecto que se pagó en `areben-dashboard`), y acá el
// `ON CONFLICT` del poller depende del único que ya existe.
//
// `NULLS FIRST` en el orden del barrido: lo nunca revisado va antes que lo
// revisado hace rato. En Postgres el default de `ASC` ya es `NULLS LAST`, así que
// la consulta lo pide explícito y el índice acompaña.
const IDX = `
CREATE INDEX IF NOT EXISTS "CarritoVisto_barrido_idx"
  ON "CarritoVisto" ("revisadoAt" NULLS FIRST, "creadoEnTnAt")
  WHERE "estado" = 'ENCOLADO'`;

const PASOS: [string, string][] = [
  ['columna revisadoAt', COLUMNA],
  ['índice parcial del barrido', IDX],
];

async function main() {
  const [antes] = await prisma.$queryRaw<{ existe: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'CarritoVisto' AND column_name = 'revisadoAt'
    ) AS existe`;

  console.log(`Columna "revisadoAt": ${antes.existe ? 'YA EXISTE' : 'NO EXISTE'}`);

  if (!aplicar) {
    console.log('\nDry-run. Lo que se correría:');
    for (const [nombre, sql] of PASOS) console.log(`\n  -- ${nombre}${sql}`);
    console.log('\nVolvé a correr con --aplicar.');
    return;
  }

  for (const [nombre, sql] of PASOS) {
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✅ ${nombre}`);
  }

  const [n] = await prisma.$queryRaw<{ total: bigint; revisados: bigint; encolados: bigint }[]>`
    SELECT count(*) AS total,
           count("revisadoAt") AS revisados,
           count(*) FILTER (WHERE estado = 'ENCOLADO') AS encolados
    FROM "CarritoVisto"`;

  console.log(`\n✅ Aplicado. ${n.total} carritos, ${n.encolados} ENCOLADO, ${n.revisados} ya revisados.`);
  console.log('   (0 revisados es lo correcto: los escribe el barrido.)');
  console.log('\n▶️ Reflejar en schema.prisma y DEPLOYAR antes de correr el barrido.');
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
