// Los 4 avisos de RETIRO EN EL LOCAL de Zattia (`secuencia-retiro-zattia.ts`):
// los DIBUJA con pedidos reales por el mismo camino que el procesador y, con
// `--escribir`, los crea en `PAUSADO`.
//
// 🔴 EL ORDEN: `add-trigger-retiro.ts` → `vercel --prod --yes` → recién ahí
//    `--escribir`. Al revés, la Prisma de producción no conoce el trigger y se
//    cae `/automations` al leer la fila.
// 🔴 PRENDERLOS se hace DESDE LA UI (`/automations`): es lo que registra los
//    webhooks `order/packed` y `order/fulfilled` en TN. Un UPDATE a mano los deja
//    activos y sordos.
//
// Correr:  node --env-file=.env --import tsx scripts/crear-retiro-zattia.ts [--pedidos=7396,7394] [--escribir]
//
// Sólo LEE de TN. Sin `--escribir` no toca la base.
import { mkdirSync, writeFileSync } from 'node:fs';
import { prisma } from '../lib/prisma.ts';
import { tnGet } from '../lib/tn/client.ts';
import { leerContenido } from '../lib/email/esquema.ts';
import { renderEmailHtml, renderEmailTexto, aplicarMergeTags, type ProductoEmail } from '../lib/email/render.ts';
import { conCarrito } from '../lib/email/prueba.ts';
import { marcaDe } from '../lib/marca.ts';
import {
  esRetiroEnLocal, lineasDePedido, pedidoDeOrden, resolverPedidoEnBloques, resolverPedidoEnTexto,
  type OrdenTnRetiro, type ProductoDeOrden,
} from '../lib/email/pedido.ts';
import { armarRetiroZattia, PREFIJO_RETIRO } from './secuencia-retiro-zattia.ts';

const DIR = '.mirar/retiro-zattia';
const escribir = process.argv.includes('--escribir');
const pedidos = (process.argv.find((a) => a.startsWith('--pedidos='))?.split('=')[1] ?? '7396,7394').split(',');

async function main() {
  const cuenta = await prisma.cuenta.findFirst({ where: { slug: 'zattia' } });
  if (!cuenta?.tnStoreId || !cuenta.tnToken) throw new Error('Zattia sin tienda conectada');

  // El logo de la tienda, del 1º de la bienvenida (la familia visual de la serie).
  const bienv = await prisma.automation.findFirst({ where: { cuentaId: cuenta.id, nombre: { startsWith: 'Bienvenida Z 1/4' } } });
  const enc = bienv ? leerContenido(bienv.contenido).bloques.find((b) => b.tipo === 'encabezado') : undefined;
  if (!enc) throw new Error('no encontré el encabezado de «Bienvenida Z 1/4»');

  const mails = armarRetiroZattia(enc);
  const marca = marcaDe(cuenta, process.env.APP_URL ?? 'https://areben-mailer.vercel.app');
  mkdirSync(DIR, { recursive: true });

  for (const numero of pedidos) {
    const { data: r } = await tnGet<unknown>(cuenta.tnStoreId, cuenta.tnToken, 'orders', { q: numero });
    const o = (Array.isArray(r) ? r : [r]).find((x: { number?: number }) => String(x?.number) === numero) as
      (OrdenTnRetiro & { products?: ProductoDeOrden[] }) | undefined;
    if (!o) { console.log(`⚠️ no encontré el pedido #${numero}`); continue; }
    const pedido = pedidoDeOrden(o);
    const { productos, restantes } = lineasDePedido(o.products);
    console.log(`\n▶ #${numero} · retiro en el local: ${esRetiroEnLocal(o) ? 'sí' : '⛔ NO (este pedido no dispararía nada)'} · efectivo: ${pedido.efectivo || '—'}`);
    console.log(`   ${pedido.local} · ${pedido.direccion} · ${pedido.horario} · ${productos.length} prendas${restantes ? ` (+${restantes})` : ''}`);

    for (const [i, m] of mails.entries()) {
      // El MISMO orden que el procesador: prendas → `${pedido.…}` → dibujo.
      let bloques = conCarrito(m.contenido.bloques, productos as ProductoEmail[], { restantes });
      bloques = resolverPedidoEnBloques(bloques, pedido);
      const opts = { ...marca, preheader: resolverPedidoEnTexto(m.preheader, pedido) || undefined, unsubscribeUrl: 'https://links.zattia.com.ar/baja?c=ENSAYO' };
      const contacto = { email: 'ensayo@zattia.com.ar', nombre: 'Ensayo' } as never;
      const html = aplicarMergeTags(renderEmailHtml({ ...m.contenido, bloques }, opts), contacto);
      const texto = aplicarMergeTags(renderEmailTexto({ ...m.contenido, bloques }, opts), contacto);
      const asunto = resolverPedidoEnTexto(m.asunto, pedido);
      writeFileSync(`${DIR}/${numero}-mail-${i + 1}.html`, html);
      writeFileSync(`${DIR}/${numero}-mail-${i + 1}.txt`, `Asunto: ${asunto}\nPreheader: ${opts.preheader ?? ''}\n\n${texto}`);
      // Lo que nunca puede llegar a una casilla.
      const crudo = [/\$\{[a-z]+\.[a-zA-Z]+\}/.exec(html + texto + asunto)?.[0], /href=""/.test(html) ? 'href vacío' : null].filter(Boolean);
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
    where: { cuentaId: cuenta.id, nombre: { startsWith: PREFIJO_RETIRO } },
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
  console.log('\n✅ Prenderlas desde /automations (registra los webhooks en TN).\n');
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
