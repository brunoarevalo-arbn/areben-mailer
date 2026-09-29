// EL CAMBIO: pausa los tres mails de carrito de hoy, prende los cuatro de
// «Carrito v2» y enciende el grupo de control. Todo en una transacción.
//
//   node --env-file=.env --import tsx scripts/cambiar-secuencia-carrito.ts                # mira
//   node --env-file=.env --import tsx scripts/cambiar-secuencia-carrito.ts --escribir
//   node --env-file=.env --import tsx scripts/cambiar-secuencia-carrito.ts --volver --escribir   # deshace
//
// ⚠️ Lo que pasa con los carritos que están A MITAD de la secuencia vieja: sus
// runs pendientes salen SALTADOS (el procesador saltea todo run de una
// automation pausada) y la secuencia nueva no los toma — los runs nacen cuando
// el carrito se ve por primera vez. O sea: esos pocos se quedan sin el resto de
// los mails. El script los cuenta antes de hacer nada.
//
// 🔑 Para el carrito no hace falta pasar por la UI: no hay webhook de TN que
// registrar (el detector es un poller que mira el `estado`).
import { prisma } from '../lib/prisma.ts';
import { PREFIJO } from './secuencia-carrito-4.ts';

const slug = process.argv.find((a) => a.startsWith('--cuenta='))?.split('=')[1] ?? 'bdi';
const escribir = process.argv.includes('--escribir');
const volver = process.argv.includes('--volver');
const PCT_CONTROL = 10;

async function main() {
  const cuenta = await prisma.cuenta.findFirst({ where: { slug } });
  if (!cuenta) throw new Error(`no existe la cuenta "${slug}"`);
  const todas = await prisma.automation.findMany({
    where: { cuentaId: cuenta.id, trigger: 'CARRITO_ABANDONADO' },
    orderBy: { esperaHoras: 'asc' },
  });
  const nuevas = todas.filter((a) => a.nombre.startsWith(PREFIJO));
  const viejas = todas.filter((a) => !a.nombre.startsWith(PREFIJO));
  if (nuevas.length !== 4) throw new Error(`hay ${nuevas.length} de «${PREFIJO}», se esperan 4: corré crear-secuencia-carrito-4.ts`);

  const [prender, pausar] = volver ? [viejas, nuevas] : [nuevas, viejas];
  const pendientes = await prisma.automationRun.count({
    where: { estado: 'PENDIENTE', automationId: { in: pausar.map((a) => a.id) } },
  });
  const config = (cuenta.config ?? {}) as Record<string, unknown>;
  const pct = volver ? 0 : PCT_CONTROL;

  console.log(`▶ ${cuenta.nombre}${volver ? ' — VOLVER a la secuencia de 3' : ''}`);
  for (const a of prender) console.log(`   ▶ prender  ${a.nombre} (${a.esperaHoras} h) [hoy ${a.estado}]`);
  for (const a of pausar) console.log(`   ⏸ pausar   ${a.nombre} (${a.esperaHoras} h) [hoy ${a.estado}]`);
  console.log(`   grupo de control: ${config.carritoControlPct ?? 0}% → ${pct}%`);
  console.log(`   ⚠️ ${pendientes} mails pendientes de las que se pausan van a salir SALTADOS`);

  if (!escribir) {
    console.log('\n(no se escribió nada: agregá --escribir)\n');
    return;
  }
  await prisma.$transaction([
    prisma.automation.updateMany({ where: { id: { in: pausar.map((a) => a.id) } }, data: { estado: 'PAUSADO' } }),
    prisma.automation.updateMany({ where: { id: { in: prender.map((a) => a.id) } }, data: { estado: 'ACTIVO' } }),
    // El merge nunca pisa el resto del config: ahí viven el tema, la tienda y la marca.
    prisma.cuenta.update({ where: { id: cuenta.id }, data: { config: { ...config, carritoControlPct: pct } } }),
  ]);
  console.log(`\n✅ Hecho. Medir en ~3 semanas: node --env-file=.env --import tsx scripts/medir-control-carrito.ts\n`);
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
