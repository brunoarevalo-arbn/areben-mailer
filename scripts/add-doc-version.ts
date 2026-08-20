// `docVersion` en los tres documentos que se editan a mano: Campania,
// Automation y Plantilla.
//
// POR QUÉ. Guardar en el mailer escribe el registro ENTERO con lo que tenía la
// pantalla. Sin historial y sin chequeo de conflicto, una pantalla cargada
// ANTES de un cambio y guardada DESPUÉS lo borra: sin error, sin aviso y sin
// rastro. El 8-ago-2026 pasó dos veces — una se comió el bloque `cupon` de
// GIRLHOOD (hubo que reconstruirlo a ojo desde una captura) y la otra revirtió
// el destino de una campaña de Zattia, que de no verse salía a 178 personas que
// ya tenían ese mismo mail.
//
// 🔑 POR QUÉ UNA COLUMNA Y NO `updatedAt`, que ya existe. Porque `updatedAt` lo
// mueve CUALQUIER escritura, y a estas tablas les escribe mucha gente que no es
// el editor: `toggleAutomation` (prender/pausar), el panel de carrito de Resorty
// (espera y cap), y sobre todo el lease de la cola de envío, que renueva
// `procesandoHasta` cada pocos segundos mientras una campaña sale. Con
// `updatedAt` de marcador, tener el editor abierto durante un envío haría
// imposible guardar, y prender una automation invalidaría la pantalla de quien
// estaba escribiendo el mail. Un aviso que salta cuando no pasó nada se aprende
// a ignorar, y ahí el arreglo empeora el lugar que venía a arreglar.
//
// `docVersion` la mueve SOLO el guardado del editor, así que un conflicto es
// siempre un conflicto de verdad: otra persona guardó ese documento.
//
// ⛔ Por SQL crudo a propósito: la base la comparte areben-popups y `prisma db
//    push` quiere dropear sus tablas.
//
// 🔴 EL ORDEN IMPORTA: este script → `vercel --prod --yes`. Al revés, el código
//    nuevo pide una columna que la base todavía no tiene y revienta TODO
//    guardado, que es peor que el problema que viene a resolver.
//
// Correr:  node --import tsx --env-file=.env scripts/add-doc-version.ts
//
// Idempotente: `ADD COLUMN IF NOT EXISTS`.
import { prisma } from '../lib/prisma.ts';

const TABLAS = ['Campania', 'Automation', 'Plantilla'] as const;

async function main() {
  for (const t of TABLAS) {
    // NOT NULL DEFAULT 0: las filas que ya existen arrancan en 0, que es
    // exactamente lo que el editor va a leer la primera vez que las abra.
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "docVersion" INTEGER NOT NULL DEFAULT 0`,
    );
  }

  console.log('\n── docVersion ──');
  for (const t of TABLAS) {
    const [c] = await prisma.$queryRawUnsafe<{ tipo: string; nulo: string; def: string | null }[]>(
      `SELECT data_type AS tipo, is_nullable AS nulo, column_default AS def
         FROM information_schema.columns
        WHERE table_name = $1 AND column_name = 'docVersion'`,
      t,
    );
    if (!c) throw new Error(`${t}: la columna no quedó`);
    const [{ n }] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT COUNT(*) AS n FROM "${t}" WHERE "docVersion" <> 0`,
    );
    console.log(`   ${t.padEnd(12)} ${c.tipo} · nulo=${c.nulo} · default=${c.def} · filas ya movidas: ${Number(n)}`);
  }

  console.log('\n✅ Listo. Ahora: commit + `vercel --prod --yes`.\n');
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
