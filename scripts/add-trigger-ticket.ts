// Un séptimo valor en `TriggerTipo`: `TICKET`.
//
// POR QUÉ. La Caja del monitor (el POS propio del local de Zattia, plan del
// 3-oct-2026) le pide el mail a la clienta al cobrar y le manda el ticket. Ese
// mail NO es marketing: es el comprobante de una compra que ya se hizo. Por eso
// es un trigger aparte y no un `COMPRA` —que cuelga de `order/paid` de TN y
// respeta el consentimiento de marketing—: el procesador lo deja pasar aunque el
// contacto esté en `BAJA`, y lo frena sólo con `REBOTADO` o `SPAM`.
//
// Igual que `NUEVO_SUSCRIPTOR`, ⛔ tiene evento de Tiendanube en `TRIGGER_EVENT`:
// lo encola el monitor por `POST /api/externo/ticket`, nunca el webhook.
//
// ⛔ Por SQL crudo a propósito: la base la comparte areben-popups y `prisma db
//    push` quiere dropear sus tablas. Ver el aviso en prisma/schema.prisma.
//
// 🔴 EL ORDEN IMPORTA: este script → `vercel --prod --yes` (y redeploy de
//    areben-popups, que lee la misma base) → recién ahí crear la automation
//    `TICKET`. Al revés, la Prisma de producción no conoce el valor y revienta al
//    LEER esa fila: se cae `/automations` en vivo.
//
// Correr:  node --import tsx --env-file=.env scripts/add-trigger-ticket.ts
//
// Idempotente: `IF NOT EXISTS` sobre el valor del enum.
import { prisma } from '../lib/prisma.ts';

async function main() {
  // ⚠️ `ALTER TYPE … ADD VALUE` no puede ir adentro de una transacción.
  await prisma.$executeRawUnsafe(`ALTER TYPE "TriggerTipo" ADD VALUE IF NOT EXISTS 'TICKET'`);

  const valores = await prisma.$queryRawUnsafe<{ valor: string }[]>(
    `SELECT e.enumlabel AS valor
       FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'TriggerTipo'
      ORDER BY e.enumsortorder`,
  );
  console.log('\n── TriggerTipo ──');
  for (const v of valores) console.log(`   ${v.valor}`);
  if (!valores.some((v) => v.valor === 'TICKET')) throw new Error('el valor no quedó en el enum');

  const [{ n }] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT COUNT(*) AS n FROM "Automation" WHERE trigger = 'TICKET'`,
  );
  console.log(`\n   automations con el trigger nuevo: ${Number(n)}`);
  console.log('\n✅ Listo. Ahora: `vercel --prod --yes` (y areben-popups), y RECIÉN DESPUÉS');
  console.log('   crear la automation del ticket en Zattia.\n');
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
