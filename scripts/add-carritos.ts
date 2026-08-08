// La tabla del poller de carritos abandonados: `CarritoVisto`.
//
// QUÉ RESUELVE: Tiendanube **no tiene webhook de checkout** (su lista de eventos
// no incluye ninguno de cart ni de checkout), así que la ingesta es un poller
// sobre `GET /checkouts` cada 15 minutos. Un poller necesita dos cosas que un
// webhook trae de fábrica: saber **por dónde iba** y saber **a quién ya le
// escribió**. Las dos salen de esta tabla.
//
// 🔴 EL RIESGO QUE ESTA TABLA EXISTE PARA TAPAR: la primera corrida ve 30 días
// de historia. En BDI eso son 163 carritos, muchos de hace semanas. Mandarles un
// "te olvidaste algo" a todos de golpe es la peor forma posible de estrenar el
// canal. Por eso hay un estado `SEMBRADO`: la primera corrida de una cuenta
// marca todo y **no encola un solo run**. Y la condición de "primera corrida" se
// **deriva** de que la cuenta no tenga filas acá, sin un flag que alguien pueda
// prender por accidente.
//
// Por qué `tnCheckoutId` es BIGINT y no TEXT como los otros ids de TN de esta
// base: es el **cursor**. El poller hace `MAX("tnCheckoutId")` y se lo pasa a TN
// como `since_id`. Sobre TEXT ese MAX sería lexicográfico y devolvería "999…"
// como mayor que "1000…".
//
// ⛔ SQL crudo, nunca `db push`: la base la comparte areben-popups (Resorty) y
//    Prisma no conoce sus tablas. Ver AGENTS.md, regla 1.
//
// Correr:  node --env-file=.env --import tsx scripts/add-carritos.ts
//          node --env-file=.env --import tsx scripts/add-carritos.ts --aplicar
//
// Idempotente: `IF NOT EXISTS` en todo, y el tipo se crea con un DO block.
//
// ▶️ Después de aplicar: reflejar en schema.prisma y **deployar** antes de que
//    exista una fila que Prisma tenga que leer.
import { prisma } from '../lib/prisma.ts';

const aplicar = process.argv.includes('--aplicar');

// `CREATE TYPE` no tiene `IF NOT EXISTS` en Postgres. El DO block es la forma
// idempotente, y la misma que usan los otros add-*.
const TIPO = `
DO $$ BEGIN
  CREATE TYPE "EstadoCarrito" AS ENUM ('SEMBRADO','ENCOLADO','SIN_CONTACTO','RECUPERADO','DESCARTADO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$`;

const TABLA = `
CREATE TABLE IF NOT EXISTS "CarritoVisto" (
  "id"           TEXT PRIMARY KEY,
  "cuentaId"     TEXT NOT NULL REFERENCES "Cuenta"("id") ON DELETE CASCADE,
  "tnCheckoutId" BIGINT NOT NULL,
  "contactoId"   TEXT REFERENCES "Contacto"("id") ON DELETE SET NULL,
  "estado"       "EstadoCarrito" NOT NULL DEFAULT 'SEMBRADO',
  "email"        TEXT,
  "telefono"     TEXT,
  "total"        DECIMAL(12,2),
  "abandonedUrl" TEXT NOT NULL DEFAULT '',
  "creadoEnTnAt" TIMESTAMP,
  "completadoAt" TIMESTAMP,
  "createdAt"    TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
  "updatedAt"    TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')
)`;

// El UNIQUE no es prolijidad: **es la idempotencia del poller**. Inserta con
// `ON CONFLICT DO NOTHING RETURNING id` y sólo encola lo que devolvió fila, así
// dos crons simultáneos se reparten el trabajo sin necesidad de un lease.
const UNICO = `
CREATE UNIQUE INDEX IF NOT EXISTS "CarritoVisto_cuentaId_tnCheckoutId_key"
  ON "CarritoVisto" ("cuentaId", "tnCheckoutId")`;

// Para el cursor (`MAX(tnCheckoutId)` por cuenta) y para la siembra
// (`COUNT(*) = 0` por cuenta), que son las dos consultas de cada corrida.
const IDX_CURSOR = `
CREATE INDEX IF NOT EXISTS "CarritoVisto_cuentaId_tnCheckoutId_idx"
  ON "CarritoVisto" ("cuentaId", "tnCheckoutId" DESC)`;

// Para el panel: cuántos carritos y cuántos recuperados por día.
const IDX_FECHA = `
CREATE INDEX IF NOT EXISTS "CarritoVisto_cuentaId_creadoEnTnAt_idx"
  ON "CarritoVisto" ("cuentaId", "creadoEnTnAt")`;

const PASOS: [string, string][] = [
  ['tipo EstadoCarrito', TIPO],
  ['tabla CarritoVisto', TABLA],
  ['índice único (cuentaId, tnCheckoutId)', UNICO],
  ['índice del cursor', IDX_CURSOR],
  ['índice por fecha', IDX_FECHA],
];

async function main() {
  const [antes] = await prisma.$queryRaw<{ existe: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_name = 'CarritoVisto'
    ) AS existe`;

  console.log(`Tabla "CarritoVisto": ${antes.existe ? 'YA EXISTE' : 'NO EXISTE'}`);

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

  const [n] = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM "CarritoVisto"`;
  const [cols] = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM information_schema.columns WHERE table_name = 'CarritoVisto'`;

  console.log(`\n✅ Aplicado. ${cols.n} columnas, ${n.n} filas.`);
  console.log('   (0 filas es lo correcto: la puebla el poller.)');
  console.log('\n▶️ Reflejar en schema.prisma y DEPLOYAR antes de correr el poller.');
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
