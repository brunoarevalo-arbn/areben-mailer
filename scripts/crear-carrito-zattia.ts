// Crea los dos mails del carrito de Zattia (`secuencia-carrito-zattia.ts`) en
// PAUSADO. ⛔ No prende nada: eso es `cambiar-secuencia-carrito.ts --cuenta=zattia`.
//
//   node --env-file=.env --import tsx scripts/crear-carrito-zattia.ts                 # mira
//   node --env-file=.env --import tsx scripts/crear-carrito-zattia.ts --escribir      # crea los que falten
//   node --env-file=.env --import tsx scripts/crear-carrito-zattia.ts --escribir --reescribir  # pisa los que estén PAUSADOS
//
// El logo sale del encabezado de la bienvenida vieja de Zattia (el mismo que la
// bienvenida v3). La espera de cada uno (1 h y 24 h) es SU `esperaHoras`: el
// detector de carritos le pone a cada run la espera de su automation.
// ⛔ Una ACTIVA no se pisa nunca: se toca desde /automations.
import { mkdirSync, writeFileSync } from 'node:fs';
import { prisma } from '../lib/prisma.ts';
import { armarCarritoZattia, PREFIJO_CARRITO_ZATTIA } from './secuencia-carrito-zattia.ts';

const escribir = process.argv.includes('--escribir');
const reescribir = process.argv.includes('--reescribir');
const DIR = '.mirar/carrito-zattia';
/** «Carrito Z 1/2 — x» y «Carrito Z 1/2 — y» son el mismo lugar de la serie. */
const mismoLugar = (a: string, b: string) => a.split(' — ')[0] === b.split(' — ')[0];

async function main() {
  const cuenta = await prisma.cuenta.findFirst({ where: { slug: 'zattia' } });
  if (!cuenta) throw new Error('no existe la cuenta zattia');
  const fuente = await prisma.automation.findFirst({
    where: { cuentaId: cuenta.id, trigger: 'NUEVO_SUSCRIPTOR', NOT: { nombre: { startsWith: 'Bienvenida Z' } } },
    orderBy: { createdAt: 'asc' }, select: { contenido: true },
  });
  if (!fuente) throw new Error('zattia: no está la bienvenida vieja (de ahí sale el logo)');
  const vieja = await prisma.automation.findFirst({
    where: { cuentaId: cuenta.id, trigger: 'CARRITO_ABANDONADO', NOT: { nombre: { startsWith: PREFIJO_CARRITO_ZATTIA } } },
    orderBy: { createdAt: 'asc' }, select: { nombre: true, estado: true, capDias: true },
  });
  const existentes = await prisma.automation.findMany({
    where: { cuentaId: cuenta.id, trigger: 'CARRITO_ABANDONADO', nombre: { startsWith: PREFIJO_CARRITO_ZATTIA } },
    select: { id: true, nombre: true, estado: true, docVersion: true, contenido: true },
  });
  const mails = armarCarritoZattia(fuente);

  console.log(`▶ ${cuenta.nombre}${vieja ? ` — la de hoy: «${vieja.nombre}» [${vieja.estado}], no se toca` : ''}`);
  for (const m of mails) {
    const previa = existentes.find((a) => mismoLugar(a.nombre, m.nombre));
    console.log(`   ${previa ? (previa.estado === 'PAUSADO' && reescribir ? '✎' : '=') : '+'} ${m.nombre} · ${m.esperaHoras} h · «${m.asunto}»${previa ? ` [${previa.estado}]` : ''}`);
  }
  if (!escribir) {
    console.log('\n(no se escribió nada: agregá --escribir)\n');
    return;
  }

  mkdirSync(DIR, { recursive: true });
  for (const m of mails) {
    const previa = existentes.find((a) => mismoLugar(a.nombre, m.nombre));
    if (previa) {
      if (!reescribir) continue;
      if (previa.estado !== 'PAUSADO') {
        console.log(`   ⛔ ${m.nombre}: está ${previa.estado}, no se pisa (se toca desde /automations)`);
        continue;
      }
      writeFileSync(`${DIR}/respaldo-${previa.id}.json`, JSON.stringify(previa.contenido, null, 2));
      const { count } = await prisma.automation.updateMany({
        where: { id: previa.id, estado: 'PAUSADO', docVersion: previa.docVersion },
        data: { nombre: m.nombre, contenido: m.contenido as object, asunto: m.asunto, preheader: m.preheader, esperaHoras: m.esperaHoras, docVersion: { increment: 1 } },
      });
      console.log(`   ${count ? '✎ reescrita' : '⚠️ NO se escribió (alguien la guardó en el medio)'}: ${m.nombre}`);
      continue;
    }
    await prisma.automation.create({
      data: {
        cuentaId: cuenta.id,
        nombre: m.nombre,
        trigger: 'CARRITO_ABANDONADO',
        estado: 'PAUSADO',
        esperaHoras: m.esperaHoras,
        capDias: vieja?.capDias ?? 7,
        asunto: m.asunto,
        preheader: m.preheader,
        contenido: m.contenido as object,
        remitenteNombre: m.remitenteNombre,
        responderA: m.responderA,
      },
    });
    console.log(`   + creada en PAUSADO: ${m.nombre}`);
  }
  console.log('\n✅ Hecho. Mirar en /automations y mandar una prueba de cada uno antes de prender.\n');
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
