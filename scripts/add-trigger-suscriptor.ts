// Un cuarto valor en `TriggerTipo`: `NUEVO_SUSCRIPTOR`.
//
// POR QUÉ. `NUEVO_CLIENTE` mezcla dos públicos que no tienen nada que ver: el
// que se anota en un pop-up y el que compra por primera vez. La bienvenida de
// Zattia le tiene que llegar solo al primero, y hoy no hay forma de decirlo.
//
// Se llama por el EVENTO ("alguien se anotó a la lista") y NO `LEAD_POPUP`, a
// propósito: la fuente vive en `triggerData.origen`. Ya hay una segunda
// superficie de captura viva —los formularios `/f/[slug]`— y con el widget en el
// nombre cada una pediría un valor de enum nuevo, que es DDL + deploy y **no se
// puede sacar**.
//
// Lo que compra gratis: `TRIGGER_EVENT` (lib/tn/eventos.ts) mapea trigger →
// evento de Tiendanube y no lo incluye ⇒ un `NUEVO_SUSCRIPTOR` es *incapaz* de
// dispararse desde el webhook de TN. No hay que acordarse de filtrar en ningún
// lado: no hay evento que lo alcance.
//
// ⛔ Por SQL crudo a propósito: la base la comparte areben-popups y `prisma db
//    push` quiere dropear sus tablas. Ver el aviso en prisma/schema.prisma.
//
// 🔴 EL ORDEN IMPORTA: este script → `vercel --prod --yes` → recién ahí tocar la
//    fila de una automation. Al revés, la Prisma que corre en producción no
//    conoce el valor nuevo y revienta al LEER esa fila: se cae `/automations`
//    en vivo por una automation sola.
//
// Correr:  node --import tsx --env-file=.env scripts/add-trigger-suscriptor.ts
//
// Idempotente: `IF NOT EXISTS` sobre el valor del enum.
import { prisma } from '../lib/prisma.ts';

async function main() {
  // ⚠️ `ALTER TYPE … ADD VALUE` no puede ir adentro de una transacción en
  // Postgres, así que va por `$executeRawUnsafe` (autocommit) y solo. Meterlo en
  // un `$transaction` con cualquier otra cosa lo hace fallar.
  await prisma.$executeRawUnsafe(
    `ALTER TYPE "TriggerTipo" ADD VALUE IF NOT EXISTS 'NUEVO_SUSCRIPTOR'`,
  );

  const valores = await prisma.$queryRawUnsafe<{ valor: string }[]>(
    `SELECT e.enumlabel AS valor
       FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'TriggerTipo'
      ORDER BY e.enumsortorder`,
  );
  console.log('\n── TriggerTipo ──');
  for (const v of valores) console.log(`   ${v.valor}`);

  if (!valores.some((v) => v.valor === 'NUEVO_SUSCRIPTOR')) {
    throw new Error('el valor no quedó en el enum');
  }

  // Cuántas automations lo usan hoy. Tiene que dar 0: el valor se agrega ANTES
  // de que exista una sola fila que lo use, y las filas se tocan después del
  // deploy.
  const [{ n }] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT COUNT(*) AS n FROM "Automation" WHERE trigger = 'NUEVO_SUSCRIPTOR'`,
  );
  console.log(`\n   automations con el trigger nuevo: ${Number(n)}`);

  console.log('\n✅ Listo. Ahora: commit + `vercel --prod --yes`, y RECIÉN DESPUÉS');
  console.log('   cambiarle el trigger a la bienvenida de Zattia.\n');
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
