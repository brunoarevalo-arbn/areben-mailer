// ¿La secuencia de bienvenida VENDE más que el mail del código solo? Compara a los
// leads con secuencia contra los del grupo de control (sólo recibieron el 1º). Sólo lee.
//
//   node --env-file=.env --import tsx scripts/medir-control-bienvenida.ts [--cuenta=bdi]
//
// El grupo sale de lo que `prepararNacidos` escribió en el run al nacer
// (`triggerData.grupo`), no de recalcularlo: si el % cambió, manda lo que se decidió.
// El oráculo de «compró» es el MISMO para los dos grupos —`yaCompro` contra las órdenes
// de TN, por el código o por una orden pagada con su mail— en los 7 días desde el alta.
// ⚠️ Lee las órdenes de 8 días ⇒ mide los leads de los últimos ~8 días que ya
// cumplieron sus 7. Para una serie más larga, correrlo cada semana y anotar.
//
// 🔑 ~150 leads por día y 10% al control son ~15 de control por día: con un canje base
// del 3,2%, recién con unos 500 de control (~5 semanas) la diferencia dice algo.
import { prisma } from '../lib/prisma.ts';
import { comprasRecientes } from '../lib/email/secuencia.ts';
import { yaCompro } from '../lib/secuencia-bienvenida.ts';
import { PREFIJO } from './secuencia-bienvenida-5.ts';

const slug = process.argv.find((a) => a.startsWith('--cuenta='))?.split('=')[1] ?? 'bdi';
const DIA = 86_400_000;

async function main() {
  const cuenta = await prisma.cuenta.findFirst({ where: { slug } });
  if (!cuenta?.tnStoreId || !cuenta.tnToken) throw new Error(`la cuenta "${slug}" no tiene TN`);
  const ahora = new Date();
  const compras = await comprasRecientes(cuenta.tnStoreId, cuenta.tnToken, ahora);
  if (!compras) throw new Error('TN no contestó: sin órdenes no se mide (no es «nadie compró»)');

  // Un lead = su run del día 1 (el 2/5): ahí quedó escrito el grupo al nacer.
  const runs = await prisma.automationRun.findMany({
    where: {
      automation: { cuentaId: cuenta.id, trigger: 'NUEVO_SUSCRIPTOR', nombre: { startsWith: `${PREFIJO} 2/5` } },
      createdAt: { gte: new Date(ahora.getTime() - 8 * DIA), lt: new Date(ahora.getTime() - 7 * DIA + DIA) },
    },
    include: { contacto: { select: { email: true } } },
  });
  const ventana = runs.filter((r) => r.createdAt.getTime() <= ahora.getTime() - 7 * DIA);
  if (!ventana.length) {
    console.log('Todavía no hay leads de la secuencia con 7 días cumplidos. Volvé en una semana.');
    return;
  }
  const grupos = new Map<string, { n: number; compraron: number }>();
  for (const r of ventana) {
    const td = r.triggerData as { grupo?: string; cupon?: string | null };
    const g = td.grupo === 'CONTROL' ? 'CONTROL' : 'SECUENCIA';
    const hasta = r.createdAt.getTime() + 7 * DIA;
    const dentro = compras.filter((c) => c.creada.getTime() <= hasta);
    const fila = grupos.get(g) ?? { n: 0, compraron: 0 };
    fila.n++;
    if (yaCompro(dentro, r.contacto.email, r.createdAt, td.cupon)) fila.compraron++;
    grupos.set(g, fila);
  }
  console.log(`\n${slug} — leads con 7 días cumplidos (altas entre hace 8 y 7 días)\n`);
  for (const [g, f] of grupos) {
    console.log(`   ${g.padEnd(10)} ${String(f.n).padStart(5)} leads · ${String(f.compraron).padStart(4)} compraron · ${((100 * f.compraron) / f.n).toFixed(1)}%`);
  }
  const control = grupos.get('CONTROL');
  if (!control || control.n < 500) console.log(`\n⚠️ El control tiene ${control?.n ?? 0} leads acá: con menos de ~500 acumulados la diferencia no dice nada.`);
  console.log();
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
