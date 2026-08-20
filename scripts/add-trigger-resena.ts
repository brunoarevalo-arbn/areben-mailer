// Un quinto valor en `TriggerTipo`: `RESENA`.
//
// POR QUÉ. El pedido de reseña post-compra sale del MISMO evento de Tiendanube
// que "Gracias por tu compra" (`order/paid`) y a los diez días, no a la hora. No
// se puede colgar de `COMPRA` porque es una automation por trigger: reusarla es
// perder el agradecimiento inmediato, que es el mail que sí conviene mandar el
// día que alguien pagó.
//
// 🔑 SE LLAMA POR EL TRABAJO Y NO POR EL EVENTO, al revés que los otros cuatro,
// y es la única forma que hay: el evento ya tiene nombre y está tomado. Dos
// triggers sobre `order/paid` que se distinguen por lo que MANDAN es exactamente
// lo que este valor modela.
//
// 🔴 Lo que NO sale gratis: `EVENT_TRIGGER` (lib/tn/eventos.ts) era el inverso de
// `TRIGGER_EVENT` armado con `Object.fromEntries`, o sea uno-a-uno. Con dos
// triggers sobre el mismo evento, el último ganaba y el otro **dejaba de
// dispararse en silencio**. Por eso el mapa inverso pasó a ser uno-a-muchos en
// el mismo commit que este script. Si estás leyendo esto porque un trigger nuevo
// comparte evento con otro: ya está resuelto, no lo rompas.
//
// ⛔ Por SQL crudo a propósito: la base la comparte areben-popups y `prisma db
//    push` quiere dropear sus tablas. Ver el aviso en prisma/schema.prisma.
//
// 🔴 EL ORDEN IMPORTA: este script → `vercel --prod --yes` → recién ahí crear la
//    automation. Al revés, la Prisma que corre en producción no conoce el valor
//    nuevo y revienta al LEER esa fila: se cae `/automations` en vivo por una
//    automation sola.
//
// Correr:  node --import tsx --env-file=.env scripts/add-trigger-resena.ts
//
// Idempotente: `IF NOT EXISTS` sobre el valor del enum.
import { prisma } from '../lib/prisma.ts';

async function main() {
  // ⚠️ `ALTER TYPE … ADD VALUE` no puede ir adentro de una transacción en
  // Postgres, así que va por `$executeRawUnsafe` (autocommit) y solo. Meterlo en
  // un `$transaction` con cualquier otra cosa lo hace fallar.
  await prisma.$executeRawUnsafe(`ALTER TYPE "TriggerTipo" ADD VALUE IF NOT EXISTS 'RESENA'`);

  const valores = await prisma.$queryRawUnsafe<{ valor: string }[]>(
    `SELECT e.enumlabel AS valor
       FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'TriggerTipo'
      ORDER BY e.enumsortorder`,
  );
  console.log('\n── TriggerTipo ──');
  for (const v of valores) console.log(`   ${v.valor}`);

  if (!valores.some((v) => v.valor === 'RESENA')) {
    throw new Error('el valor no quedó en el enum');
  }

  // Tiene que dar 0: el valor se agrega ANTES de que exista una sola fila que lo
  // use, y las filas se tocan después del deploy.
  const [{ n }] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT COUNT(*) AS n FROM "Automation" WHERE trigger = 'RESENA'`,
  );
  console.log(`\n   automations con el trigger nuevo: ${Number(n)}`);

  console.log('\n✅ Listo. Ahora: commit + `vercel --prod --yes`, y RECIÉN DESPUÉS');
  console.log('   crear la automation de reseña desde /automations.\n');
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
