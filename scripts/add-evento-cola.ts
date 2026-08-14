// La bitácora de la cola de envío (aditivo, idempotente).
//
// Por qué existe (14-ago-2026): el T06 y el T07 se cortaron en el medio —476 s y
// 49 s de silencio— y las dos veces el diagnóstico chocó con la misma pared: lo
// único que dejaba rastro era un `console.log`, y **los runtime logs de Vercel no
// se pueden leer en el plan Hobby** (`vercel logs` sólo transmite lo nuevo y los
// endpoints de la API dan 404). Un evento que nadie puede leer no es evidencia.
//
// 🔑 La fila que importa no es la del error, es la de ANTES. Si la invocación la
// mata el `maxDuration` en pleno relevo, el `cadena-cortada` tampoco se escribe;
// lo que distingue ese caso de "la escalera corrió entera y el sucesor no vino"
// es un `relevo-inicio` sin fila de cierre. Por eso se registra el intento, no
// sólo el fracaso.
//
// OJO: NO usar `prisma db push` en esta base — la comparte con areben-popups
// y push dropearía sus tablas. Cambios de schema por SQL crudo.
// Correr:  node --import tsx --env-file=.env scripts/add-evento-cola.ts
import { prisma } from '../lib/prisma.ts';

const STMTS = [
  `CREATE TABLE IF NOT EXISTS "EventoCola" (
     "id"         TEXT NOT NULL,
     "campaniaId" TEXT,
     "ev"         TEXT NOT NULL,
     "meta"       JSONB NOT NULL DEFAULT '{}',
     "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "EventoCola_pkey" PRIMARY KEY ("id")
   );`,
  // Se lee siempre igual: "qué le pasó a ESTA campaña, en orden".
  'CREATE INDEX IF NOT EXISTS "EventoCola_campaniaId_createdAt_idx" ON "EventoCola"("campaniaId", "createdAt");',
  // Y "¿se cortó alguna cadena últimamente?", sin campaña de por medio.
  'CREATE INDEX IF NOT EXISTS "EventoCola_ev_createdAt_idx" ON "EventoCola"("ev", "createdAt");',
  // ⚠️ Sin FK a Campania a propósito: la bitácora tiene que sobrevivir al borrado
  // de la campaña. Justo el caso raro —una campaña que alguien borró en el
  // medio— es de los que hay que poder mirar después.
];

async function main() {
  for (const sql of STMTS) {
    await prisma.$executeRawUnsafe(sql);
    console.log('✓', sql.split('\n')[0]);
  }
  console.log('Listo: bitácora de la cola asegurada.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
