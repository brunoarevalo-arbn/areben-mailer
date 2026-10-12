// Crea la bienvenida de BDI de CINCO mails (11-oct-2026) en PAUSADO, al lado de la de
// un mail que sale hoy (`cms6kpmqg…`, ACTIVA). No toca la de hoy ni manda nada:
// Resorty sólo le encola runs a las automations ACTIVAS.
//
//   node --env-file=.env --import tsx scripts/crear-bienvenida-5.ts            # mira y dibuja, no escribe
//   node --env-file=.env --import tsx scripts/crear-bienvenida-5.ts --escribir
//   node --env-file=.env --import tsx scripts/crear-bienvenida-5.ts --escribir --reescribir
//
// `--reescribir` (12-oct-2026) pisa el contenido, el asunto y el preheader de las
// cinco que YA EXISTEN, y sólo si siguen PAUSADAS: una ACTIVA está mandando y se
// toca desde /automations. Guarda antes una copia del Json en
// `.mirar/bienvenida5/respaldo-<id>.json` y escribe con `docVersion` en el WHERE
// (como el editor): si alguien la guardó en el medio, no la pisa y lo dice.
// 🔴 Va DESPUÉS del deploy de las piezas nuevas (`lista`, los cupones `barra` y
// `grande`, `pegadas`): un panel viejo no conoce `lista` y la tira al guardar.
//
// Sin `--escribir` dibuja los cinco con el último lead REAL (su código, su premio) por
// el mismo camino que el procesador —cupón del trigger, datos de la tienda, merge
// tags— y los deja en `.mirar/bienvenida5/mail-N.html` para LEERLOS.
//
// Idempotente: una automation con el mismo nombre ya creada se saltea — nunca se pisa,
// porque después de creada se edita en /automations.
//
// 🔴 Prenderla es OTRO script (`cambiar-bienvenida.ts`) y es decisión de Bruno: con
// la de hoy y las cinco activas, cada lead recibiría DOS mails al instante.
import { mkdirSync, writeFileSync } from 'node:fs';
import { prisma } from '../lib/prisma.ts';
import { armarBienvenida5, PREFIJO } from './secuencia-bienvenida-5.ts';
import { aplicarCuponDelTrigger } from '../lib/email/cupon-trigger.ts';
import { renderEmailHtml, renderEmailTexto, aplicarMergeTags } from '../lib/email/render.ts';
import { marcaDe } from '../lib/marca.ts';
import { resolverProductosDinamicos } from '../lib/email/productos-dinamicos.ts';
import { cadaBloque } from '../lib/email/bloques.ts';
import { faltaCuponObligatorio, mailVencido } from '../lib/secuencia-bienvenida.ts';
import { diaLocal } from '../lib/fechas.ts';

const slug = process.argv.find((a) => a.startsWith('--cuenta='))?.split('=')[1] ?? 'bdi';
const escribir = process.argv.includes('--escribir');
const reescribir = process.argv.includes('--reescribir');
const VIEJA = 'cms6kpmqg000004l4s4tg6djo';

async function main() {
  const cuenta = await prisma.cuenta.findFirst({ where: { slug } });
  if (!cuenta) throw new Error(`no existe la cuenta "${slug}"`);
  const vieja = await prisma.automation.findFirst({ where: { id: VIEJA, cuentaId: cuenta.id } });
  if (!vieja) throw new Error(`no está la bienvenida de hoy (${VIEJA}) en ${slug}`);
  const existentes = await prisma.automation.findMany({
    where: { cuentaId: cuenta.id, trigger: 'NUEVO_SUSCRIPTOR', nombre: { startsWith: PREFIJO } },
    select: { id: true, nombre: true, estado: true, docVersion: true, contenido: true },
  });
  const ya = new Set(existentes.map((a) => a.nombre));
  console.log(`▶ ${cuenta.nombre}: la de hoy es «${vieja.nombre}» [${vieja.estado}] — no se toca`);

  const mails = armarBienvenida5(vieja);

  // El último lead real, para dibujarlos con un código de verdad.
  const run = await prisma.automationRun.findFirst({
    where: { automationId: VIEJA, triggerData: { path: ['cupon'], not: null } },
    orderBy: { createdAt: 'desc' },
    include: { contacto: true },
  });
  const td = (run?.triggerData ?? {}) as Record<string, string | null>;
  const marca = marcaDe(cuenta, process.env.APP_URL ?? 'https://areben-mailer.vercel.app');
  mkdirSync('.mirar/bienvenida5', { recursive: true });

  for (const [i, m] of mails.entries()) {
    const bloques = aplicarCuponDelTrigger(m.contenido.bloques, { origen: 'popup', ...td });
    // Las dos reglas del procesador que hacen que un mail NO salga, contadas acá
    // para el lead real y para uno SIN código.
    const sinCupon = faltaCuponObligatorio(cadaBloque(m.contenido.bloques), cadaBloque(aplicarCuponDelTrigger(m.contenido.bloques, { origen: 'popup', cupon: null })));
    const vencido = mailVencido(m.contenido.saleHasta, diaLocal(new Date()));
    const productosDinamicos = await resolverProductosDinamicos(bloques, cuenta);
    const opts = { ...marca, preheader: m.preheader ?? undefined, unsubscribeUrl: 'https://links.bdiaccesorios.com.ar/baja?c=ENSAYO', productosDinamicos };
    const html = aplicarMergeTags(renderEmailHtml({ ...m.contenido, bloques }, opts), run?.contacto ?? { email: 'ensayo@x.com' } as never);
    const texto = aplicarMergeTags(renderEmailTexto({ ...m.contenido, bloques }, opts), run?.contacto ?? { email: 'ensayo@x.com' } as never);
    writeFileSync(`.mirar/bienvenida5/mail-${i + 1}.html`, html);
    writeFileSync(`.mirar/bienvenida5/mail-${i + 1}.txt`, texto);
    // Lo que nunca puede llegar a una casilla.
    const crudo = [/\$\{[a-z]+\.[a-zA-Z]+\}/.exec(html)?.[0], html.includes('TUCUPON') ? 'TUCUPON' : null, /href=""/.test(html) ? 'href vacío' : null].filter(Boolean);
    const conCodigo = td.cupon ? html.includes(td.cupon) : null;
    const marcaYa = ya.has(m.nombre) ? '=' : '+';
    console.log(`   ${marcaYa} ${m.nombre} · ${m.esperaHoras} h · «${m.asunto}»${m.remitenteNombre ? ` · de ${m.remitenteNombre} → ${m.responderA}` : ''}`);
    console.log(`       ${Math.round(html.length / 1024)} KB · código ${conCodigo ? 'adentro' : conCodigo === false ? '⚠️ NO está' : '(sin lead)'}${crudo.length ? ` · 🔴 ${crudo.join(', ')}` : ''}`
      + `${m.contenido.saleHasta ? ` · sale hasta el ${m.contenido.saleHasta}${vencido ? ' (🔴 YA VENCIÓ)' : ''}` : ''}`
      + ` · a un lead sin código: ${sinCupon ? 'NO sale' : 'sale (sin el cupón)'}`);
  }
  console.log(`   (dibujados con el lead ${run?.contacto.email.replace(/^(.).*@/, '$1…@') ?? '—'}, código ${td.cupon ?? '—'} → .mirar/bienvenida5/)`);

  if (!escribir) {
    console.log('\n(no se escribió nada: agregá --escribir)\n');
    return;
  }
  mkdirSync('.mirar/bienvenida5', { recursive: true });
  for (const m of mails) {
    const previa = existentes.find((a) => a.nombre === m.nombre);
    if (previa) {
      if (!reescribir) continue;
      if (previa.estado !== 'PAUSADO') {
        console.log(`   ⛔ ${m.nombre}: está ${previa.estado}, no se pisa (se toca desde /automations)`);
        continue;
      }
      writeFileSync(`.mirar/bienvenida5/respaldo-${previa.id}.json`, JSON.stringify(previa.contenido, null, 2));
      const { count } = await prisma.automation.updateMany({
        where: { id: previa.id, estado: 'PAUSADO', docVersion: previa.docVersion },
        data: { contenido: m.contenido as object, asunto: m.asunto, preheader: m.preheader, docVersion: { increment: 1 } },
      });
      console.log(`   ${count ? '✎ reescrita' : '⚠️ NO se escribió (alguien la guardó en el medio)'}: ${m.nombre}`);
      continue;
    }
    await prisma.automation.create({
      data: {
        cuentaId: cuenta.id,
        nombre: m.nombre,
        trigger: 'NUEVO_SUSCRIPTOR',
        estado: 'PAUSADO',
        esperaHoras: m.esperaHoras,
        capDias: vieja.capDias,
        asunto: m.asunto,
        preheader: m.preheader,
        contenido: m.contenido as object,
        remitenteNombre: m.remitenteNombre,
        responderA: m.responderA,
      },
    });
  }
  console.log('\n✅ Listo: siguen en PAUSADO. Revisalas en /automations.\n');
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
