// Qué le pasó a la cola de envío. Es la mitad que faltaba de la bitácora: una
// tabla que nadie puede leer repite, un piso más arriba, el problema que la
// motivó (un `console.log` que en Hobby no se puede abrir).
//
//   node --env-file=.env --import tsx scripts/mirar-cola.ts            # últimas 24 h
//   node --env-file=.env --import tsx scripts/mirar-cola.ts --horas=72
//   node --env-file=.env --import tsx scripts/mirar-cola.ts --campania=<id>
import { prisma } from '../lib/prisma.ts';

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const horas = Number(arg('horas') ?? 24);
const campaniaId = arg('campania');

const ms = (n: unknown) => (typeof n === 'number' ? `${(n / 1000).toFixed(1)}s` : '—');

async function main() {
  const desde = new Date(Date.now() - horas * 3600_000);
  const filas = await prisma.eventoCola.findMany({
    where: { createdAt: { gte: desde }, ...(campaniaId ? { campaniaId } : {}) },
    orderBy: { createdAt: 'asc' },
  });
  if (!filas.length) {
    console.log(`Sin actividad de cola en las últimas ${horas} h.`);
    console.log('⚠️ Ojo: la bitácora arrancó el 14-ago-2026. Antes de eso no hay nada que mirar.');
    return;
  }

  const nombres = new Map<string, string>();
  for (const id of new Set(filas.map((f) => f.campaniaId).filter(Boolean) as string[])) {
    const c = await prisma.campania.findUnique({ where: { id }, select: { nombre: true } });
    nombres.set(id, c?.nombre ?? '(borrada)');
  }

  // Un relevo que arrancó y no cerró es el caso que no se podía ver: significa
  // que a la invocación la mataron en plena escalera, y no que la escalera haya
  // corrido entera sin encontrar sucesor. Son dos bugs distintos.
  const abiertos = new Set<string>();
  const huerfanos: typeof filas = [];
  for (const f of filas) {
    const k = `${f.campaniaId}`;
    if (f.ev === 'relevo-inicio') {
      if (abiertos.has(k)) huerfanos.push(f);
      abiertos.add(k);
    } else if (['relevo-ok', 'cadena-recuperada', 'cadena-cortada'].includes(f.ev)) {
      abiertos.delete(k);
    }
  }

  let camp = '';
  for (const f of filas) {
    const n = f.campaniaId ? `${nombres.get(f.campaniaId)} [${f.campaniaId}]` : '(sin campaña)';
    if (n !== camp) {
      console.log(`\n──── ${n}`);
      camp = n;
    }
    const m = f.meta as Record<string, unknown>;
    const hora = f.createdAt.toISOString().slice(11, 23);
    const marca = f.ev === 'cadena-cortada' ? '🔴' : f.ev === 'cadena-recuperada' ? '🟡' : '  ';
    const detalle =
      f.ev === 'cola'
        ? `${m.enviados} enviados · ${m.restantes} restantes · ${m.lotes} lotes · ${m.motivo} · ${ms(m.ms)}`
        : Object.entries(m)
            .map(([k, v]) => (k === 'ms' || k === 'coste' ? `${k} ${ms(v)}` : `${k} ${v}`))
            .join(' · ');
    console.log(`${marca} ${hora}  ${f.ev.padEnd(18)} ${detalle}`);
  }

  const cortes = filas.filter((f) => f.ev === 'cadena-cortada').length;
  const recup = filas.filter((f) => f.ev === 'cadena-recuperada').length;
  const relevos = filas.filter((f) => f.ev.startsWith('relevo-inicio')).length;
  const lotes = filas.filter((f) => f.ev === 'cola');
  const peor = Math.max(0, ...lotes.map((f) => Number((f.meta as Record<string, unknown>).ms ?? 0)));

  console.log(`\n──── ${horas} h`);
  console.log(`relevos ${relevos} · 🟡 recuperados ${recup} · 🔴 cortados ${cortes}`);
  console.log(`invocación más larga: ${ms(peor)}  (el techo es 60s)`);
  if (huerfanos.length) {
    console.log(`🔴 ${huerfanos.length} relevo(s) SIN CERRAR ⇒ la invocación murió en plena escalera, no le faltó sucesor:`);
    for (const f of huerfanos) console.log(`   ${f.createdAt.toISOString()}  ${f.campaniaId}`);
  }
  if (abiertos.size) console.log(`⚠️ ${abiertos.size} relevo(s) todavía abierto(s) (puede ser uno en curso)`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
