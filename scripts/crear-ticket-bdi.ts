// Crea en BDI la automation TICKET «Ticket del local» (`secuencia-ticket-bdi.ts`),
// con espera 0 y en PAUSADO. ⛔ No prende nada: prenderla es desde /automations,
// cuando la Caja de BDI mande tickets.
//
//   node --env-file=.env --import tsx scripts/crear-ticket-bdi.ts              # mira, no escribe
//   node --env-file=.env --import tsx scripts/crear-ticket-bdi.ts --escribir   # la crea
//
// 🔴 ⛔ Pisa nada: si BDI ya tiene una automation TICKET (la que sea, activa o no),
// sale con aviso. Hay UNA por trigger (`automationDelTrigger`), y la que exista se
// edita en /automations, que es donde vive el documento.
// El remitente es el de la cuenta (BDI ya tiene el suyo, AUTENTICADO).
import { prisma } from '../lib/prisma.ts';
import { armarTicketBdi, FUENTE_TICKET_BDI } from './secuencia-ticket-bdi.ts';

const escribir = process.argv.includes('--escribir');

async function main() {
  const cuenta = await prisma.cuenta.findFirst({ where: { slug: 'bdi' } });
  if (!cuenta) throw new Error('no existe la cuenta bdi');
  const existente = await prisma.automation.findFirst({
    where: { cuentaId: cuenta.id, trigger: 'TICKET' },
    select: { id: true, nombre: true, estado: true },
  });
  if (existente) {
    console.log(`⛔ ${cuenta.nombre} ya tiene una automation TICKET: «${existente.nombre}» [${existente.estado}] (${existente.id}). No se pisa: se edita en /automations.`);
    return;
  }
  const fuente = await prisma.automation.findFirst({
    where: { id: FUENTE_TICKET_BDI, cuentaId: cuenta.id },
    select: { contenido: true },
  });
  if (!fuente) throw new Error(`bdi: no está la bienvenida ${FUENTE_TICKET_BDI} (de ahí salen el logo y las redes)`);
  const remitente = await prisma.remitente.findFirst({ where: { cuentaId: cuenta.id }, select: { email: true, estado: true } });

  const m = armarTicketBdi(fuente);
  console.log(`▶ ${cuenta.nombre}`);
  console.log(`   + ${m.nombre} · TICKET · espera ${m.esperaHoras} h · PAUSADO`);
  console.log(`     asunto «${m.asunto}» · preheader «${m.preheader}»`);
  console.log(`     ${m.contenido.bloques.length} bloques: ${m.contenido.bloques.map((b) => b.tipo).join(', ')}`);
  console.log(`     remitente: ${remitente ? `${remitente.email} [${remitente.estado}]` : '⚠️ NINGUNO (no podría mandar)'}`);
  if (!escribir) {
    console.log('\n(no se escribió nada: agregá --escribir)\n');
    return;
  }

  const creada = await prisma.automation.create({
    data: {
      cuentaId: cuenta.id,
      nombre: m.nombre,
      trigger: 'TICKET',
      estado: 'PAUSADO',
      esperaHoras: m.esperaHoras,
      asunto: m.asunto,
      preheader: m.preheader,
      contenido: m.contenido as object,
      remitenteNombre: m.remitenteNombre,
      responderA: m.responderA,
    },
    select: { id: true },
  });
  console.log(`   + creada en PAUSADO: ${m.nombre} (${creada.id})`);
  console.log('\n✅ Hecho. Mirarla en /automations y mandar una prueba antes de prenderla.\n');
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
