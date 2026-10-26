// Los 4 avisos de RETIRO EN EL LOCAL de BDI (`secuencia-retiro-bdi.ts`): los
// DIBUJA con pedidos reales por el mismo camino que el procesador y, con
// `--escribir`, los crea en `PAUSADO`.
//
// 🔴 PRENDERLOS se hace DESDE LA UI (`/automations`): es lo que registra los
//    webhooks `order/packed` y `order/fulfilled` en TN. Un UPDATE a mano los deja
//    activos y sordos. Y el MISMO día se apaga «Listo para retirar» en el admin de
//    TN de BDI (Configuración › Mensajes automatizados), o salen dos.
//
// Correr:  node --env-file=.env --import tsx scripts/crear-retiro-bdi.ts [--pedidos=22060,22036] [--escribir]
//
// Sólo LEE de TN. Sin `--escribir` no toca la base.
import { mkdirSync, writeFileSync } from 'node:fs';
import { prisma } from '../lib/prisma.ts';
import { tnGet } from '../lib/tn/client.ts';
import { renderEmailHtml, renderEmailTexto, aplicarMergeTags, type ProductoEmail } from '../lib/email/render.ts';
import { conCarrito } from '../lib/email/prueba.ts';
import { marcaDe } from '../lib/marca.ts';
import {
  esRetiroEnLocal, lineasDePedido, pedidoDeOrden, resolverPedidoEnBloques, resolverPedidoEnTexto,
  type OrdenTnRetiro, type ProductoDeOrden,
} from '../lib/email/pedido.ts';
import { FUENTE_TICKET_BDI } from './secuencia-ticket-bdi.ts';
import { armarRetiroBdi, PREFIJO_RETIRO_BDI } from './secuencia-retiro-bdi.ts';

const DIR = '.mirar/retiro-bdi/motor';
const escribir = process.argv.includes('--escribir');
const pedidos = (process.argv.find((a) => a.startsWith('--pedidos='))?.split('=')[1] ?? '22060,22036').split(',');

async function main() {
  const cuenta = await prisma.cuenta.findFirst({ where: { slug: 'bdi' } });
  if (!cuenta?.tnStoreId || !cuenta.tnToken) throw new Error('BDI sin tienda conectada');

  const fuente = await prisma.automation.findUnique({ where: { id: FUENTE_TICKET_BDI } });
  if (!fuente || fuente.cuentaId !== cuenta.id) throw new Error('no encontré la bienvenida de BDI de la que se clonan logo y redes');

  // 🔴 El WhatsApp se HEREDA de un mail de BDI que ya lo tiene (el carrito), nunca a mano.
  const autos = await prisma.automation.findMany({ where: { cuentaId: cuenta.id }, select: { contenido: true } });
  const was = new Set(autos.flatMap((a) => JSON.stringify(a.contenido).match(/https:\/\/wa\.me\/\d+/g) ?? []));
  if (was.size !== 1) throw new Error(`esperaba UN WhatsApp en los mails de BDI y hay ${was.size}: ${[...was].join(', ')}`);
  const [whatsapp] = was;

  const mails = armarRetiroBdi(fuente, whatsapp);
  const marca = marcaDe(cuenta, process.env.APP_URL ?? 'https://areben-mailer.vercel.app');
  mkdirSync(DIR, { recursive: true });
  console.log(`WhatsApp: ${whatsapp}`);

  for (const numero of pedidos) {
    const { data: r } = await tnGet<unknown>(cuenta.tnStoreId, cuenta.tnToken, 'orders', { q: numero });
    const o = (Array.isArray(r) ? r : [r]).find((x: { number?: number }) => String(x?.number) === numero) as
      (OrdenTnRetiro & { products?: ProductoDeOrden[] }) | undefined;
    if (!o) { console.log(`⚠️ no encontré el pedido #${numero}`); continue; }
    const pedido = pedidoDeOrden(o);
    const { productos, restantes } = lineasDePedido(o.products);
    console.log(`\n▶ #${numero} · retiro en el local: ${esRetiroEnLocal(o) ? 'sí' : '⛔ NO (este pedido no dispararía nada)'} · efectivo: ${pedido.efectivo || '—'}`);
    console.log(`   ${pedido.local} · ${pedido.direccion} · ${pedido.horario} · ${productos.length} productos${restantes ? ` (+${restantes})` : ''}`);

    for (const [i, m] of mails.entries()) {
      // El MISMO orden que el procesador: productos → `${pedido.…}` → dibujo.
      let bloques = conCarrito(m.contenido.bloques, productos as ProductoEmail[], { restantes });
      bloques = resolverPedidoEnBloques(bloques, pedido);
      const opts = { ...marca, preheader: resolverPedidoEnTexto(m.preheader, pedido) || undefined, unsubscribeUrl: 'https://links.bdiaccesorios.com.ar/baja?c=ENSAYO' };
      const contacto = { email: 'ensayo@bdiaccesorios.com.ar', nombre: 'Ensayo' } as never;
      const html = aplicarMergeTags(renderEmailHtml({ ...m.contenido, bloques }, opts), contacto);
      const texto = aplicarMergeTags(renderEmailTexto({ ...m.contenido, bloques }, opts), contacto);
      const asunto = resolverPedidoEnTexto(m.asunto, pedido);
      writeFileSync(`${DIR}/${numero}-mail-${i + 1}.html`, html);
      writeFileSync(`${DIR}/${numero}-mail-${i + 1}.txt`, `Asunto: ${asunto}\nPreheader: ${opts.preheader ?? ''}\n\n${texto}`);
      // Lo que nunca puede llegar a una casilla. «cambio»: en BDI no hay cambios.
      const crudo = [
        /\$\{[a-z]+\.[a-zA-Z]+\}/.exec(html + texto + asunto)?.[0],
        /href=""/.test(html) ? 'href vacío' : null,
        /cambio/i.test(texto + asunto + (opts.preheader ?? '')) ? 'nombra CAMBIOS' : null,
        /prenda/i.test(texto) ? 'dice «prendas»' : null,
      ].filter(Boolean);
      const pagar = html.includes('A PAGAR') ? 'con A PAGAR' : 'sin A PAGAR';
      console.log(`   ${m.nombre} · ${m.trigger} · ${m.esperaHoras} h · «${asunto}» · ${Math.round(html.length / 1024)} KB · ${pagar}${crudo.length ? ` · 🔴 ${crudo.join(', ')}` : ''}`);
    }
  }
  console.log(`\n   → ${DIR}/`);

  if (!escribir) {
    console.log('\n(no se escribió nada: agregá --escribir)\n');
    return;
  }
  const existentes = await prisma.automation.findMany({
    where: { cuentaId: cuenta.id, nombre: { startsWith: PREFIJO_RETIRO_BDI } },
    select: { nombre: true },
  });
  const ya = new Set(existentes.map((a) => a.nombre));
  for (const m of mails) {
    if (ya.has(m.nombre)) { console.log(`   = ya existe: ${m.nombre} (no se pisa)`); continue; }
    await prisma.automation.create({
      data: {
        cuentaId: cuenta.id, nombre: m.nombre, trigger: m.trigger, estado: 'PAUSADO',
        esperaHoras: m.esperaHoras, capDias: 0, asunto: m.asunto, preheader: m.preheader,
        contenido: m.contenido as object, remitenteNombre: m.remitenteNombre, responderA: m.responderA,
      },
    });
    console.log(`   + creada en PAUSADO: ${m.nombre}`);
  }
  console.log('\n✅ Prenderlas desde /automations (registra los webhooks en TN) y apagar el «Listo para retirar» de TN.\n');
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
