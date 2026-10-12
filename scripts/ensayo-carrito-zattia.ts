// Los dos mails del carrito de Zattia (`secuencia-carrito-zattia.ts`) dibujados con
// carritos REALES de la tienda, por el MISMO camino que el procesador. No manda ni
// escribe nada: lee la base (el encabezado de la bienvenida de hoy) y TN.
//
//   node --env-file=.env --import tsx scripts/ensayo-carrito-zattia.ts
//
// Dibuja cada mail con dos carritos: el más reciente de UNA prenda a domicilio y el
// más reciente de 3+ prendas que RETIRA en el local — son las dos ramas de
// `${cart.retiro}` y de la tercera garantía. Deja los HTML en `.mirar/carrito-zattia/`.
//
// ⚠️ Réplica de `app/api/automations/procesar/route.ts` (conCarrito →
// productos dinámicos → prepararCarrito → render → merge tags → `${cart.url}`). Si
// el procesador cambia cómo arma el mail, esto queda mintiendo.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { prisma } from '../lib/prisma.ts';
import { renderEmailHtml, renderEmailTexto, aplicarMergeTags } from '../lib/email/render.ts';
import { marcaDe, hostDeEnvio } from '../lib/marca.ts';
import { listarAbandonados } from '../lib/tn/checkouts.ts';
import { conCarrito } from '../lib/email/prueba.ts';
import { resolverProductosDinamicos } from '../lib/email/productos-dinamicos.ts';
import { prepararCarrito, resolverCarritoEnTexto, resolverTagsCarrito } from '../lib/email/tags-carrito.ts';
import { armarCarritoZattia } from './secuencia-carrito-zattia.ts';

const SALIDA = join(process.cwd(), '.mirar', 'carrito-zattia');

async function main() {
  const appUrl = process.env.APP_URL ?? 'https://areben-mailer.vercel.app';
  mkdirSync(SALIDA, { recursive: true });
  const cuenta = await prisma.cuenta.findFirst({ where: { slug: 'zattia' } });
  if (!cuenta?.tnStoreId || !cuenta.tnToken) throw new Error('zattia: sin tienda conectada');
  const vieja = await prisma.automation.findFirst({
    where: { cuentaId: cuenta.id, trigger: 'NUEVO_SUSCRIPTOR', NOT: { nombre: { startsWith: 'Bienvenida Z' } } },
    orderBy: { createdAt: 'asc' }, select: { contenido: true },
  });
  if (!vieja) throw new Error('zattia: no está la bienvenida vieja (de ahí sale el logo)');
  const mails = armarCarritoZattia(vieja);

  const { checkouts } = await listarAbandonados(cuenta.tnStoreId, cuenta.tnToken);
  const recientes = [...checkouts].filter((c) => c.productos.length).sort((a, b) => +(b.creadoEnTnAt ?? 0) - +(a.creadoEnTnAt ?? 0));
  const casos = [
    ['una', recientes.find((c) => c.productos.length === 1 && !c.retiroEnLocal)],
    ['retira', recientes.find((c) => c.productos.length >= 3 && c.retiroEnLocal)],
  ] as const;

  const marca = marcaDe(cuenta, appUrl);
  const host = hostDeEnvio(cuenta, appUrl);
  const errores: string[] = [];
  for (const [nombreCaso, c] of casos) {
    if (!c) { console.log(`⚠️  sin carrito para el caso «${nombreCaso}»`); continue; }
    console.log(`\n${nombreCaso}: ${c.productos.length} prendas · subtotal $${c.subtotal?.toLocaleString('es-AR')} · ${c.retiroEnLocal ? 'retira en el local' : 'a domicilio'}`);
    for (const [i, m] of mails.entries()) {
      let bloques = conCarrito(m.contenido.bloques, c.productos, { restantes: c.restantes ?? 0 });
      const productosDinamicos = await resolverProductosDinamicos(bloques, cuenta);
      const datos = { productos: c.productos, restantes: c.restantes, subtotal: c.subtotal, cantidad: c.cantidad, retiroEnLocal: c.retiroEnLocal, tienda: marca.tienda };
      bloques = prepararCarrito(bloques, datos);
      const opts = { ...marca, preheader: resolverCarritoEnTexto(m.preheader, datos), unsubscribeUrl: `${host}/baja?c=ENSAYO`, productosDinamicos };
      const carrito = { url: c.abandonedUrl || marca.urlCuenta || '#', productos: c.productos, restantes: c.restantes };
      const contacto = { email: 'ensayo@ejemplo.com', nombre: '' } as never;
      const html = resolverTagsCarrito(aplicarMergeTags(renderEmailHtml({ ...m.contenido, bloques }, opts), contacto), carrito, 'html');
      const texto = resolverTagsCarrito(aplicarMergeTags(renderEmailTexto({ ...m.contenido, bloques }, opts), contacto), carrito, 'texto');
      const archivo = join(SALIDA, `mail-${i + 1}--${nombreCaso}.html`);
      writeFileSync(archivo, html);
      writeFileSync(archivo.replace(/\.html$/, '.txt'), texto);

      const chequeos: [boolean, string][] = [
        [!/\$\{[a-z]+\.[a-zA-Z]+\}/.test(html.replace(/\$\{cart\.url\}/g, '')) && !texto.includes('${'), 'ningún tag sin resolver'],
        [!/href="(#|)"/.test(html), 'ningún href vacío'],
        [c.productos.slice(0, i === 0 ? 99 : 3).every((p) => html.includes(p.nombre)), 'salen las prendas del carrito'],
        [!/te faltan/i.test(html + texto), '⛔ nunca «te faltan»'],
        [!/descuento|% ?off|cup[oó]n|c[oó]digo/i.test(`${m.asunto} ${m.preheader} ${texto}`), 'ni cupón ni código en ningún lado'],
        [c.retiroEnLocal ? html.includes('Lo retirás por el local') : !html.includes('Lo retirás'), c.retiroEnLocal ? 'dice cuándo lo retira' : 'a domicilio no habla de retirar'],
        [i === 0 ? (c.retiroEnLocal ? />RETIRO</i.test(html) : /ENVÍO GRATIS<|Envío gratis</.test(html)) : true, 'la tercera garantía es la que corresponde'],
        [i === 1 ? Object.values(productosDinamicos).some((ps) => ps.length > 0) : true, 'el estante de NEW IN trae prendas'],
        [html.length < 100_000, `pesa ${(html.length / 1024).toFixed(0)} KB (Gmail recorta a ~102)`],
      ];
      console.log(`  ${m.nombre} · ${m.esperaHoras} h · «${m.asunto}» · pre: ${opts.preheader}`);
      for (const [ok, msg] of chequeos) {
        console.log(`    ${ok ? '✅' : '🔴'} ${msg}`);
        if (!ok) errores.push(`${m.nombre}/${nombreCaso}: ${msg}`);
      }
      console.log(`    → ${archivo}`);
    }
  }
  console.log(`\n${errores.length ? `🔴 ${errores.length} para mirar` : '✅ los dos mails pasan lo que un script puede ver'}\n`);
  if (errores.length) process.exitCode = 1;
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
