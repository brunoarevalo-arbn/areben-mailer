// La pregunta "¿alguien tomó la posta?" es sobre el LEASE, no sobre la request.
//
// Por qué existe: el 13-ago-2026 el T06 salió con un hueco de 476 s en el medio
// —1.180 envíos, la cadena muerta, 822 esperando al cron de 15 min— y no dejó una
// sola línea de log. El dispatch daba por entregada cualquier request que no
// tirara error, y con `AbortSignal.timeout` un cold start del sucesor es
// indistinguible de un despacho exitoso: los dos terminan en un abort.
//
// Este archivo fija las cinco respuestas de las que depende reintentar o no.
// ⚠️ Toca la base (lee campañas), así que corre sobre una cuenta descartable.
//
//   node --env-file=.env --import tsx scripts/probar-cadena-cola.ts
import { prisma } from '../lib/prisma.ts';
import { tomaronLaPosta } from '../lib/email/cola.ts';

const SLUG = 'qa-cadena';
const errores: string[] = [];
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) errores.push(msg);
};

const limpiar = async () => {
  const c = await prisma.cuenta.findUnique({ where: { slug: SLUG } });
  if (c) await prisma.cuenta.delete({ where: { slug: SLUG } });
};

async function main() {
  await limpiar();
  const cuenta = await prisma.cuenta.create({ data: { slug: SLUG, nombre: 'QA · cadena (borrar)' } });
  const campania = await prisma.campania.create({
    data: { cuentaId: cuenta.id, nombre: 'QA cadena', estado: 'ENVIANDO' },
  });
  const poner = (procesandoHasta: Date | null, estado: 'ENVIANDO' | 'ENVIADA' = 'ENVIANDO') =>
    prisma.campania.update({ where: { id: campania.id }, data: { procesandoHasta, estado } });

  try {
    // Lease vivo: alguien está trabajando ⇒ la posta llegó, no se reintenta.
    await poner(new Date(Date.now() + 60_000));
    ok(await tomaronLaPosta(campania.id), 'lease en el futuro ⇒ la posta se tomó');

    // Lease libre: NADIE está trabajando y quedan envíos. Éste es el caso que
    // costó 8 minutos de campaña parada — antes ni se preguntaba.
    await poner(null);
    ok(!(await tomaronLaPosta(campania.id)), '🔴 lease en null ⇒ la posta se PERDIÓ (hay que reintentar)');

    // Vencido es lo mismo que libre: `tomarCampania` lo trata igual.
    await poner(new Date(Date.now() - 1_000));
    ok(!(await tomaronLaPosta(campania.id)), 'lease vencido ⇒ la posta se perdió');

    // Ya terminó: no hay nada que pasar, reintentar sería despertar un worker al pedo.
    await poner(null, 'ENVIADA');
    ok(await tomaronLaPosta(campania.id), 'campaña ENVIADA ⇒ no hay posta que pasar');

    ok(await tomaronLaPosta('no-existe'), 'campaña borrada en el medio ⇒ tampoco se reintenta');
  } finally {
    await limpiar();
  }

  console.log(errores.length ? `\n❌ ${errores.length} en rojo` : '\n✅ La posta se confirma por el lease.');
  process.exit(errores.length ? 1 : 0);
}

main().finally(() => prisma.$disconnect());
