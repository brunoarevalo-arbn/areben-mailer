// Crea la secuencia de carrito de 4 mails (29-sep-2026) en PAUSADO, al lado de
// los tres que salen hoy. No toca los tres de hoy ni manda nada: el detector de
// carritos sólo le encola runs a las automations ACTIVAS.
//
//   node --env-file=.env --import tsx scripts/crear-secuencia-carrito-4.ts            # mira, no escribe
//   node --env-file=.env --import tsx scripts/crear-secuencia-carrito-4.ts --escribir
//
// 🔴 Va DESPUÉS de `add-remitente-automation.ts` y del deploy: escribe las
// columnas `remitenteNombre` y `responderA`.
//
// Idempotente: una automation con el mismo nombre ya creada se saltea — nunca se
// pisa, porque después de creada se edita en /automations.
// Para verlos antes: `ensayo-secuencia.ts --nueva`.
import { prisma } from '../lib/prisma.ts';
import { armarSecuencia4, PREFIJO } from './secuencia-carrito-4.ts';

const slug = process.argv.find((a) => a.startsWith('--cuenta='))?.split('=')[1] ?? 'bdi';
const escribir = process.argv.includes('--escribir');

async function main() {
  const cuenta = await prisma.cuenta.findFirst({ where: { slug } });
  if (!cuenta) throw new Error(`no existe la cuenta "${slug}"`);

  const todas = await prisma.automation.findMany({
    where: { cuentaId: cuenta.id, trigger: 'CARRITO_ABANDONADO' },
    orderBy: { esperaHoras: 'asc' },
  });
  const viejas = todas.filter((a) => !a.nombre.startsWith(PREFIJO));
  const ya = new Set(todas.filter((a) => a.nombre.startsWith(PREFIJO)).map((a) => a.nombre));
  console.log(`▶ ${cuenta.nombre}: ${viejas.length} mails de carrito de hoy (${viejas.map((a) => `${a.nombre} [${a.estado}]`).join(' · ')})`);

  const nuevos = armarSecuencia4(viejas);
  for (const m of nuevos) {
    if (ya.has(m.nombre)) {
      console.log(`   = ${m.nombre}: ya existe, no se toca`);
      continue;
    }
    console.log(`   + ${m.nombre} · ${m.esperaHoras} h · «${m.asunto}»${m.remitenteNombre ? ` · de ${m.remitenteNombre} → ${m.responderA}` : ''}`);
    if (!escribir) continue;
    await prisma.automation.create({
      data: {
        cuentaId: cuenta.id,
        nombre: m.nombre,
        trigger: 'CARRITO_ABANDONADO',
        estado: 'PAUSADO',
        esperaHoras: m.esperaHoras,
        capDias: viejas[0]?.capDias ?? 30,
        asunto: m.asunto,
        preheader: m.preheader,
        contenido: m.contenido as object,
        remitenteNombre: m.remitenteNombre,
        responderA: m.responderA,
      },
    });
  }
  console.log(escribir ? '\n✅ Creadas en PAUSADO. Revisalas en /automations y mandate la prueba del 2/4.\n' : '\n(no se escribió nada: agregá --escribir)\n');
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
