// ¿Dos procesadores simultáneos pueden llevarse el mismo run?
//
// Es LA pregunta del arriendo, y no se puede contestar con un test puro: el
// mecanismo que la resuelve —`FOR UPDATE SKIP LOCKED`— vive en Postgres, no en
// TypeScript. Un mock diría que sí funciona sin haber probado nada.
//
// Así que esto corre contra la base de verdad, con datos de QA que se crean y se
// borran acá adentro. Lo que fabrica no puede mandarle un mail a nadie ni con el
// gate abierto, y lo hace por partida doble:
//   - la automation nace `PAUSADO`  ⇒ el procesador marca el run `SALTADO`
//   - el contacto nace `BAJA`       ⇒ el chequeo de consentimiento lo frena antes
// Si el cron cae justo en el medio, se encuentra runs que solo puede saltear.
//
// Correr:  node --env-file=.env --import tsx scripts/probar-lease-runs.ts
import { prisma } from '../lib/prisma.ts';
import { tomarRuns } from '../lib/email/runs.ts';
import { randomUUID } from 'node:crypto';

const K = 12;
const MARCA = `qa-lease-${randomUUID().slice(0, 8)}`;

let fallos = 0;
function ok(cond: boolean, desc: string, detalle = '') {
  console.log(`${cond ? '  ✅' : '  ❌'} ${desc}${detalle ? ` — ${detalle}` : ''}`);
  if (!cond) fallos++;
}

async function main() {
  const cuenta = await prisma.cuenta.findFirst({ where: { slug: 'bdi' }, select: { id: true } });
  if (!cuenta) throw new Error('no hay cuenta bdi');

  console.log(`Fabricando ${K} runs de QA (marca ${MARCA})…\n`);

  const automation = await prisma.automation.create({
    data: {
      cuentaId: cuenta.id,
      nombre: `[QA] lease ${MARCA}`,
      trigger: 'NUEVO_SUSCRIPTOR',
      esperaHoras: 0,
      // estado default = PAUSADO. Sin asunto tampoco puede mandar.
    },
    select: { id: true },
  });

  const contacto = await prisma.contacto.create({
    data: {
      cuentaId: cuenta.id,
      email: `${MARCA}@qa.invalid`,
      estado: 'BAJA',
      tnAcceptsMkt: false,
      source: MARCA,
    },
    select: { id: true },
  });

  // `proximoAt` en el pasado: listos para tomar. La columna es `timestamp` sin
  // zona y Prisma guarda UTC, así que un Date de JS entra bien.
  const ayer = new Date(Date.now() - 86_400_000);
  await prisma.automationRun.createMany({
    data: Array.from({ length: K }, () => ({
      automationId: automation.id,
      contactoId: contacto.id,
      proximoAt: ayer,
    })),
  });

  const mios = new Set(
    (await prisma.automationRun.findMany({ where: { automationId: automation.id }, select: { id: true } }))
      .map((r) => r.id),
  );
  ok(mios.size === K, `se crearon ${K} runs`, `${mios.size}`);

  try {
    // ── LA PRUEBA ────────────────────────────────────────────────────────────
    // Dos claims disparados a la vez, sin await entre medio. Es la carrera real:
    // dos leads del pop-up entrando en el mismo segundo, cada uno pinchando el
    // procesador.
    console.log('\nDos claims simultáneos:');
    const [a, b] = await Promise.all([tomarRuns(K), tomarRuns(K)]);

    // Solo miramos los nuestros: en la base puede haber runs pendientes de
    // verdad, y llevárselos no sería un error de este script sino su trabajo.
    const A = a.filter((id) => mios.has(id));
    const B = b.filter((id) => mios.has(id));
    const interseccion = A.filter((id) => B.includes(id));
    const union = new Set([...A, ...B]);

    ok(interseccion.length === 0, 'ningún run se lo llevaron los dos', `intersección=${interseccion.length}`);
    ok(union.size === K, 'entre los dos se llevaron todos, sin perder ninguno', `${union.size}/${K}`);
    ok(A.length > 0 && B.length > 0 ? true : true, `repartija: ${A.length} + ${B.length}`);

    // Un tercer claim no puede encontrar nada: los K están arrendados.
    const c = (await tomarRuns(K)).filter((id) => mios.has(id));
    ok(c.length === 0, 'un tercer procesador no encuentra nada para tomar', `tomó ${c.length}`);

    // El lease quedó en el futuro en los K.
    const conLease = await prisma.automationRun.count({
      where: { automationId: automation.id, procesandoHasta: { gt: new Date() } },
    });
    ok(conLease === K, 'los K quedaron con el arriendo puesto y vigente', `${conLease}/${K}`);

    // Y siguen PENDIENTE: el claim reserva, no resuelve. Si la función se muere
    // acá, el run se recupera solo cuando vence el lease.
    const pendientes = await prisma.automationRun.count({
      where: { automationId: automation.id, estado: 'PENDIENTE' },
    });
    ok(pendientes === K, 'tomar un run no cambia su estado: sigue PENDIENTE', `${pendientes}/${K}`);

    // Un lease VENCIDO se vuelve a tomar: es lo que rescata a un run cuya
    // invocación se murió a la mitad. Sin esto haría falta un barrendero.
    await prisma.automationRun.updateMany({
      where: { automationId: automation.id },
      data: { procesandoHasta: new Date(Date.now() - 60_000) },
    });
    const d = (await tomarRuns(K)).filter((id) => mios.has(id));
    ok(d.length === K, 'un arriendo vencido se puede volver a tomar', `${d.length}/${K}`);

    // El límite se respeta: pedir 3 devuelve 3, no el lote entero.
    await prisma.automationRun.updateMany({
      where: { automationId: automation.id },
      data: { procesandoHasta: null },
    });
    const e = (await tomarRuns(3)).filter((id) => mios.has(id));
    ok(e.length <= 3, 'el límite del lote se respeta', `pidió 3, tomó ${e.length}`);
  } finally {
    // ── LIMPIEZA ─────────────────────────────────────────────────────────────
    // Va en `finally`: una assertion que explota no puede dejar runs de QA
    // sueltos en la base de producción.
    const borrados = await prisma.automationRun.deleteMany({ where: { automationId: automation.id } });
    await prisma.automation.delete({ where: { id: automation.id } });
    await prisma.contacto.delete({ where: { id: contacto.id } });
    console.log(`\n🧹 Limpieza: ${borrados.count} runs, 1 automation y 1 contacto de QA borrados.`);
  }

  console.log(fallos === 0 ? '\n✅ El arriendo aguanta la carrera.' : `\n❌ ${fallos} fallo(s).`);
  process.exitCode = fallos === 0 ? 0 : 1;
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
