// EL CAMBIO: pausa la bienvenida de un mail de hoy (`cms6kpmqg…`), prende los cinco de
// «Bienvenida 5» y enciende el grupo de control. Todo en una transacción.
// 🔴 Decisión de Bruno: después de ver cuántas respuestas junta el 2/4 del carrito.
//
//   node --env-file=.env --import tsx scripts/cambiar-bienvenida.ts                # mira
//   node --env-file=.env --import tsx scripts/cambiar-bienvenida.ts --escribir
//   node --env-file=.env --import tsx scripts/cambiar-bienvenida.ts --volver --escribir   # deshace
//
// 🔑 No hace falta pasar por la UI: `NUEVO_SUSCRIPTOR` no tiene webhook de TN que
// registrar (los runs los inserta Resorty, que lee `estado = 'ACTIVO'` en cada lead).
//
// ⚠️ Los leads que ya recibieron la de un mail NO entran a la secuencia: los runs nacen
// en el alta. La secuencia arranca con los leads nuevos desde el momento del cambio.
// ⚠️ Antes de prender, mirar el LEEME de docs/disenio/bienvenida-bdi: el 3/5 nombra la
// escalera de Resorty, que vence el 31-oct, y el 5/5 sin código tiene que saltarse.
import { prisma } from '../lib/prisma.ts';
import { PREFIJO } from './secuencia-bienvenida-5.ts';
import { PREFIJO_ZATTIA } from './secuencia-bienvenida-zattia.ts';

const slug = process.argv.find((a) => a.startsWith('--cuenta='))?.split('=')[1] ?? 'bdi';
const escribir = process.argv.includes('--escribir');
const volver = process.argv.includes('--volver');
// La serie de cada marca (ver `crear-bienvenida-5.ts`). En Zattia la vieja se busca:
// es la única NUEVO_SUSCRIPTOR que no es de la serie (12-oct-2026).
const SERIES: Record<string, { vieja: string | null; prefijo: string; n: number }> = {
  bdi: { vieja: 'cms6kpmqg000004l4s4tg6djo', prefijo: PREFIJO, n: 5 },
  zattia: { vieja: null, prefijo: PREFIJO_ZATTIA, n: 4 },
};
const serie = SERIES[slug];
if (!serie) throw new Error(`no hay serie de bienvenida para «${slug}»`);
const PCT_CONTROL = 10;

async function main() {
  const cuenta = await prisma.cuenta.findFirst({ where: { slug } });
  if (!cuenta) throw new Error(`no existe la cuenta "${slug}"`);
  const todas = await prisma.automation.findMany({
    where: { cuentaId: cuenta.id, trigger: { in: ['NUEVO_SUSCRIPTOR', 'NUEVO_CLIENTE'] } },
    orderBy: { esperaHoras: 'asc' },
  });
  const nuevas = todas.filter((a) => a.nombre.startsWith(serie.prefijo));
  const vieja = todas.filter((a) => (serie.vieja ? a.id === serie.vieja : a.trigger === 'NUEVO_SUSCRIPTOR' && !a.nombre.startsWith(serie.prefijo)));
  if (nuevas.length !== serie.n) throw new Error(`hay ${nuevas.length} de «${serie.prefijo}», se esperan ${serie.n}: corré crear-bienvenida-5.ts`);
  if (vieja.length !== 1) throw new Error(`se esperaba UNA bienvenida de hoy y hay ${vieja.length}`);
  const VIEJA = vieja[0].id;
  // Cualquier OTRA bienvenida activa le sumaría un mail más a cada lead.
  const otras = todas.filter((a) => a.estado === 'ACTIVO' && a.id !== VIEJA && !a.nombre.startsWith(serie.prefijo));
  if (otras.length) throw new Error(`hay otra bienvenida ACTIVA: ${otras.map((a) => a.nombre).join(', ')}`);

  const [prender, pausar] = volver ? [vieja, nuevas] : [nuevas, vieja];
  const config = (cuenta.config ?? {}) as Record<string, unknown>;
  const pct = volver ? 0 : PCT_CONTROL;
  const pendientes = await prisma.automationRun.count({ where: { estado: 'PENDIENTE', automationId: { in: pausar.map((a) => a.id) } } });

  console.log(`▶ ${cuenta.nombre}${volver ? ' — VOLVER a la bienvenida de un mail' : ''}`);
  for (const a of prender) console.log(`   ▶ prender  ${a.nombre} (${a.esperaHoras} h) [hoy ${a.estado}]`);
  for (const a of pausar) console.log(`   ⏸ pausar   ${a.nombre} (${a.esperaHoras} h) [hoy ${a.estado}]`);
  console.log(`   grupo de control: ${config.bienvenidaControlPct ?? 0}% → ${pct}%`);
  console.log(`   ⚠️ ${pendientes} mails pendientes de las que se pausan van a salir SALTADOS`);

  if (!escribir) {
    console.log('\n(no se escribió nada: agregá --escribir)\n');
    return;
  }
  await prisma.$transaction([
    prisma.automation.updateMany({ where: { id: { in: pausar.map((a) => a.id) } }, data: { estado: 'PAUSADO' } }),
    prisma.automation.updateMany({ where: { id: { in: prender.map((a) => a.id) } }, data: { estado: 'ACTIVO' } }),
    // El merge nunca pisa el resto del config: ahí viven el tema, la tienda y la marca.
    prisma.cuenta.update({ where: { id: cuenta.id }, data: { config: { ...config, bienvenidaControlPct: pct } } }),
  ]);
  console.log(`\n✅ Hecho. Medir en ~2 semanas: node --env-file=.env --import tsx scripts/medir-control-bienvenida.ts\n`);
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
