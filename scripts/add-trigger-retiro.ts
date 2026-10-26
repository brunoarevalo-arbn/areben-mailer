// Dos valores nuevos en `TriggerTipo`: `RETIRO_LISTO` y `RETIRADO`.
//
// POR QUÉ. Tiendanube tiene su «Listo para retirar» prendido en Zattia y no lo
// manda (5 de 5 retiros empaquetados sin el mail en el historial, 26-oct-2026).
// Estos mails los manda el mailer: `order/packed` → listo para retirar y los dos
// recordatorios; `order/fulfilled` → gracias por pasar. Ver `lib/email/pedido.ts`.
//
// ⛔ Por SQL crudo a propósito: la base la comparte areben-popups y `prisma db
//    push` quiere dropear sus tablas. Ver el aviso en prisma/schema.prisma.
//
// 🔴 EL ORDEN IMPORTA: este script → `vercel --prod --yes` → recién ahí crear las
//    automations (`crear-retiro-zattia.ts`). Al revés, la Prisma de producción no
//    conoce el valor y revienta al LEER esa fila: se cae `/automations` en vivo.
//    (areben-popups ⛔ lee `TriggerTipo` con Prisma: no hace falta redeployarlo.)
//
// Correr:  node --import tsx --env-file=.env scripts/add-trigger-retiro.ts
//
// Idempotente: `IF NOT EXISTS` sobre cada valor del enum.
import { prisma } from '../lib/prisma.ts';

const NUEVOS = ['RETIRO_LISTO', 'RETIRADO'];

async function main() {
  // ⚠️ `ALTER TYPE … ADD VALUE` no puede ir adentro de una transacción: de a uno.
  for (const v of NUEVOS) {
    await prisma.$executeRawUnsafe(`ALTER TYPE "TriggerTipo" ADD VALUE IF NOT EXISTS '${v}'`);
  }

  const valores = await prisma.$queryRawUnsafe<{ valor: string }[]>(
    `SELECT e.enumlabel AS valor
       FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'TriggerTipo'
      ORDER BY e.enumsortorder`,
  );
  console.log('\n── TriggerTipo ──');
  for (const v of valores) console.log(`   ${v.valor}`);
  for (const v of NUEVOS) if (!valores.some((x) => x.valor === v)) throw new Error(`${v} no quedó en el enum`);

  console.log('\n✅ Listo. Ahora: `vercel --prod --yes`, y RECIÉN DESPUÉS crear las automations.\n');
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
