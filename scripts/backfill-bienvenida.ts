// Encola la bienvenida para los leads de pop-up que quedaron sin ella.
//
// Al 30-jul-2026 eran 197 contactos —175 de BDI, 22 de Zattia— capturados por
// Resorty que nunca recibieron un solo mail: el único camino que creaba un
// AutomationRun era el webhook `customer/created` de Tiendanube, y un lead de
// pop-up no crea un cliente en TN. Desde ahora los leads NUEVOS los encola
// Resorty solo (`areben-popups/lib/mailer.ts`); esto es para los de antes.
//
// ⚠️ SIN CUPÓN a propósito. Los códigos que sacaron esos leads ya vencieron —24 h
//    en BDI, 7 días en Zattia—, así que el run va sin `cupon` y el procesador
//    ELIMINA el bloque en vez de mandar un código muerto (lib/email/cupon-trigger.ts).
//
// 🔴 EL GATE TIENE QUE ESTAR EN `real` ANTES DE CORRER ESTO. Con el gate cerrado
//    o en `ensayo`, `procesarLote` marca cada run como ENVIADO/"dry-run" y se
//    consume SIN MANDAR NADA Y SIN REINTENTO. Mirá /envio primero.
//
// Correr:  node --import tsx --env-file=.env scripts/backfill-bienvenida.ts --marca=bdi
//          node --import tsx --env-file=.env scripts/backfill-bienvenida.ts --marca=bdi --aplicar
//
// Idempotente: un contacto que ya tuvo un run de esa automation se saltea, así
// que correrlo dos veces no manda dos mails.
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma.ts';

const marca = process.argv.find((a) => a.startsWith('--marca='))?.split('=')[1];
// Dry-run por default: esto encola mails a gente real. Se pide el opuesto.
const aplicar = process.argv.includes('--aplicar');

async function main() {
  if (!marca) {
    console.error('❌ Falta --marca=<slug>. Se hace de a una marca: BDI y Zattia no comparten proveedor verificado.');
    process.exit(1);
  }

  const cuenta = await prisma.cuenta.findFirst({ where: { slug: marca } });
  if (!cuenta) {
    console.error(`❌ No existe la cuenta "${marca}".`);
    process.exit(1);
  }

  // Se exige `asunto` porque el procesador saltea el run que no lo tenga: sin
  // esto encolaríamos runs que nacen muertos.
  // Los dos triggers, igual que `dispararBienvenida()` en areben-popups: si acá
  // mirara uno solo, el backfill y el camino en vivo encolarían cosas distintas
  // para el mismo lead.
  const autos = await prisma.automation.findMany({
    where: {
      cuentaId: cuenta.id,
      trigger: { in: ['NUEVO_CLIENTE', 'NUEVO_SUSCRIPTOR'] },
      estado: 'ACTIVO',
      asunto: { not: null },
    },
  });

  console.log(`\n▶ ${cuenta.nombre} — ${autos.length} bienvenida(s) ACTIVA(s)`);
  if (autos.length === 0) {
    console.log('   Nada que encolar: prendé la bienvenida desde /automations primero.');
    console.log('   ⚠️ Si hay más de una activa, cada lead recibe un mail por cada una.');
    return;
  }
  if (autos.length > 1) {
    console.log(`   ⚠️ HAY ${autos.length} ACTIVAS: cada lead va a recibir ${autos.length} mails.`);
    for (const a of autos) console.log(`      · ${a.id} — "${a.asunto}"`);
  }

  // Los mismos filtros que aplica el procesador antes de mandar (estado y
  // consentimiento), para no encolar runs que va a saltear igual.
  const leads = await prisma.contacto.findMany({
    where: { cuentaId: cuenta.id, source: 'popup', estado: 'ACTIVO', tnAcceptsMkt: true },
    select: { id: true, email: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`   ${leads.length} leads de pop-up mandables`);

  let encolados = 0, yaTenian = 0;
  for (const a of autos) {
    for (const lead of leads) {
      // Una bienvenida es una sola vez en la vida: se mira si hubo ALGÚN run,
      // sin ventana de días. Mismo criterio que usa Resorty al disparar.
      const ya = await prisma.automationRun.findFirst({
        where: { automationId: a.id, contactoId: lead.id },
        select: { id: true },
      });
      if (ya) { yaTenian++; continue; }

      if (aplicar) {
        await prisma.automationRun.create({
          data: {
            id: randomUUID(),
            automationId: a.id,
            contactoId: lead.id,
            proximoAt: new Date(Date.now() + a.esperaHoras * 3600000),
            // `origen:'popup'` sin `cupon` es lo que le dice al procesador que
            // saque el bloque del cupón en vez de mandar el placeholder.
            triggerData: { origen: 'popup', backfill: true },
          },
        });
      }
      encolados++;
    }
  }

  console.log(`\n   ${aplicar ? 'Encolados' : 'Se encolarían'}: ${encolados}`);
  if (yaTenian) console.log(`   Ya tenían run (salteados): ${yaTenian}`);
  if (!aplicar) {
    console.log('\n   DRY-RUN. Para aplicarlo de verdad: --aplicar');
    console.log('   Antes: confirmá en /envio que el gate dice `real`, o los runs se queman.');
  } else {
    // El cron procesa de a 30 runs (BATCH en app/api/automations/procesar), así
    // que 175 leads tardan unas 3 corridas ≈ 45 min en salir todos.
    console.log(`\n   Salen de a 30 por corrida del cron (cada 15 min): ~${Math.ceil(encolados / 30)} corrida(s).`);
  }
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
