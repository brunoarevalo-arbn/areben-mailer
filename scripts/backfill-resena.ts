// El pedido de reseña para los pedidos que pagaron mientras el webhook rebotaba.
//
// Del 27-ago-2026 (se prendió la automation de reseña de BDI) al 13-sep-2026 (se
// deployó `d3a8ba7`) **todos** los `order/paid` rebotaron con 401: TN firma en hex
// y `verifyTnWebhook` comparaba base64. Ninguno de esos pedidos tiene su run.
//
// Correr:  node --env-file=.env --import tsx scripts/backfill-resena.ts            (dry, por defecto)
//          node --env-file=.env --import tsx scripts/backfill-resena.ts --aplicar
//
// 🔴 **Cada pedido se pide DE A UNO (`GET /orders/{id}`), no se lee del listado.**
//    Medido el 12-sep: en `GET /orders` 238 de 262 pagados traen `paid_at` en null
//    —sólo lo trae lo de los últimos 3 días— y el mismo pedido pedido por id sí lo
//    tiene. Filtrar por el listado dejaba afuera 9 de cada 10. Y de paso el estado
//    se relee fresco: un pedido cancelado o reembolsado DESPUÉS de pagar no entra.
//
// 🔑 Lo que hace con cada pedido es lo MISMO que `app/api/tn/eventos/route.ts`
//    (upsert del contacto, cap de `capDias`, `productosDeOrden`, `restantes: 0`),
//    salvo UNA cosa: la espera se cuenta desde **cuándo pagó**, no desde hoy. Un
//    pedido del 28-ago no espera 10 días más; uno del 11-sep sale el 21-sep.
// ⚠️ Consentimiento y supresión NO se filtran acá, igual que en el webhook: los
//    decide el procesador al enviar. El dry los cuenta para saber cuántos salen.
// ⚠️ Idempotente: un pedido que ya tiene run (el de la prueba del 13-sep, o uno
//    que el webhook ya arregló creó) se saltea.
import { prisma } from '../lib/prisma.ts';
import { tnGet, tnPaginate } from '../lib/tn/client.ts';
import { productosDeOrden, type ProductoDeTn } from '../lib/tn/ordenes.ts';

const STORE = '1096065';
const AUTOMATION = 'cmt332zi7000004l4afyf6e0i'; // «Pedir una reseña», BDI
const DESDE = '2026-08-27T00:00:00-03:00';
const APLICAR = process.argv.includes('--aplicar');
const PISO = new Date('2026-09-13T13:00:00Z').getTime(); // domingo 13-sep, 10:00 ART

interface Orden {
  id: number;
  number: number;
  status?: string;
  payment_status?: string;
  cancelled_at?: string | null;
  paid_at?: string | null;
  customer?: { id?: number; email?: string | null; name?: string | null; accepts_marketing?: boolean };
  products?: ProductoDeTn[];
}

/**
 * 🔴 **El límite de TN se COMPARTE con el monitor, Resorty y el mailer en producción.**
 * La primera corrida de este script cortó con 429 a los ~40 pedidos. Van de a uno, con
 * pausa, y ante un 429 se espera y se reintenta: cortar a la mitad dejaría el backfill
 * partido y habría que volver a leer todo.
 * ⚠️ `productosDeOrden` hace sus propios GET y **se come los errores** (un producto sin
 * ficha se cae del mail) ⇒ por eso la pausa también va después de cada pedido.
 */
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function conPausa<T>(fn: () => Promise<T>): Promise<T> {
  for (let intento = 0; ; intento++) {
    try {
      const r = await fn();
      await dormir(700);
      return r;
    } catch (e) {
      if (!/→ 429/.test(String(e)) || intento >= 6) throw e;
      await dormir(5000 * (intento + 1));
    }
  }
}

async function main() {
  const cuenta = await prisma.cuenta.findUnique({ where: { tnStoreId: STORE } });
  const automation = await prisma.automation.findUnique({ where: { id: AUTOMATION } });
  if (!cuenta?.tnToken || !automation) throw new Error('falta la cuenta, su token o la automation');
  if (automation.estado !== 'ACTIVO') throw new Error(`la automation está ${automation.estado}`);

  // El listado sirve sólo para saber QUÉ ids mirar; la verdad sale del GET por id.
  const candidatos: number[] = [];
  for await (const page of tnPaginate<Orden>(STORE, cuenta.tnToken, 'orders', { created_at_min: DESDE } as never)) {
    for (const o of page as Orden[]) if (o.payment_status === 'paid' && o.status !== 'cancelled') candidatos.push(o.id);
  }

  const yaTienen = new Set(
    (await prisma.automationRun.findMany({ where: { automationId: AUTOMATION }, select: { triggerData: true } }))
      .map((r) => String((r.triggerData as { orderId?: string } | null)?.orderId)),
  );

  const motivos: Record<string, number> = {};
  const saltear = (m: string) => { motivos[m] = (motivos[m] ?? 0) + 1; };
  const ahora = Date.now();
  let creados = 0, mandables = 0;
  const porDiaDeEnvio: Record<string, number> = {};

  for (const id of candidatos) {
    if (yaTienen.has(String(id))) { saltear('ya tiene run'); continue; }
    const o = await conPausa(() => tnGet<Orden>(STORE, cuenta.tnToken!, `orders/${id}`)).then((r) => r.data);
    if (o.status === 'cancelled' || o.cancelled_at) { saltear('cancelado'); continue; }
    if (o.payment_status !== 'paid') { saltear(`pago ${o.payment_status}`); continue; }
    if (!o.paid_at || new Date(o.paid_at).getTime() < new Date(DESDE).getTime()) { saltear('pagó antes del 27-ago'); continue; }
    const email = o.customer?.email?.toLowerCase();
    if (!email) { saltear('sin email'); continue; }

    const existente = await prisma.contacto.findUnique({
      where: { cuentaId_email: { cuentaId: cuenta.id, email } },
      select: { id: true, estado: true, tnAcceptsMkt: true },
    });
    if (existente) {
      const reciente = await prisma.automationRun.findFirst({
        where: { automationId: AUTOMATION, contactoId: existente.id, createdAt: { gte: new Date(ahora - automation.capDias * 86400000) } },
      });
      if (reciente) { saltear(`ya tiene run en ${automation.capDias} días (otro pedido)`); continue; }
    }
    const saldria = existente ? existente.estado === 'ACTIVO' && existente.tnAcceptsMkt : o.customer?.accepts_marketing === true;

    const productos = await productosDeOrden(o.products ?? [], STORE, cuenta.tnToken);
    // ⚠️ Piso a las 10 de la mañana de Argentina: medido en el dry, 111 de 231 ya pasaron sus
    // 10 días y saldrían en el acto — a las 22 h de un sábado, cuando se corrió.
    const proximoAt = new Date(Math.max(new Date(o.paid_at).getTime() + automation.esperaHoras * 3600000, ahora, PISO));
    const dia = proximoAt.toISOString().slice(0, 10);

    if (saldria) { mandables++; porDiaDeEnvio[dia] = (porDiaDeEnvio[dia] ?? 0) + 1; }
    else saltear('se crea pero NO sale (no acepta marketing o suprimido)');
    // Contado por mail, no por pedido: dos pedidos del mismo mail dan un solo run.
    yaTienen.add(String(id));
    if (!APLICAR) { creados++; continue; }

    const contacto = await prisma.contacto.upsert({
      where: { cuentaId_email: { cuentaId: cuenta.id, email } },
      update: { tnCustomerId: o.customer?.id?.toString() ?? undefined, nombre: o.customer?.name ?? undefined },
      create: {
        cuentaId: cuenta.id, email, nombre: o.customer?.name ?? null,
        tnCustomerId: o.customer?.id?.toString() ?? null, source: 'tiendanube',
        tnAcceptsMkt: o.customer?.accepts_marketing === true,
      },
    });
    // El cap otra vez, ya con el contacto creado: dos pedidos del mismo mail en esta corrida.
    const reciente = await prisma.automationRun.findFirst({
      where: { automationId: AUTOMATION, contactoId: contacto.id, createdAt: { gte: new Date(ahora - automation.capDias * 86400000) } },
    });
    if (reciente) { saltear('mismo mail, otro pedido de esta corrida'); continue; }
    await prisma.automationRun.create({
      data: { automationId: AUTOMATION, contactoId: contacto.id, proximoAt, triggerData: { orderId: String(o.id), productos, restantes: 0 } },
    });
    creados++;
  }

  console.log({
    modo: APLICAR ? 'APLICADO' : 'dry (no escribió nada)',
    pagadosEnElListado: candidatos.length,
    [APLICAR ? 'runsCreados' : 'runsQueSeCrearian']: creados,
    deEsosSalen: mandables,
    salteados: motivos,
    enviosPorDia: Object.fromEntries(Object.entries(porDiaDeEnvio).sort()),
  });
  await prisma.$disconnect();
}
main();
