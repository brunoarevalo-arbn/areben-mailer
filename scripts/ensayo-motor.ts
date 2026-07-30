// Ensayo del motor de envío a volumen, contra el mailbox simulator de SES.
//
// Qué ejercita (nada de esto corrió nunca de punta a punta):
//   · la cola del servidor: lease, auto-encadenamiento, corte por presupuesto
//   · el camino de throttle — en sandbox SES entrega 1 mail/seg, así que un lote
//     de 20 lo toca sí o sí y la cola tiene que reencolar sin perder a nadie
//   · los estados: Envio ENCOLADO→ENVIADO con sesMessageId, Campania →ENVIADA
//
// Se puede correr CON EL GATE CERRADO y la cuenta en sandbox: el simulador está
// siempre permitido (ver destinatarioPermitido), no exige verificar el
// destinatario, no consume la cuota diaria y no afecta la reputación.
//
// Correr:
//   APP_URL=https://areben-mailer.vercel.app \
//     node --import tsx --env-file=.env scripts/ensayo-motor.ts [--contactos=60]
//   node --import tsx --env-file=.env scripts/ensayo-motor.ts --limpiar
//
// ⚠️ El worker que levanta la campaña corre en PROD, así que hay que deployar
// antes. El script escribe en la misma base que lee prod, por eso puede seguir
// el progreso desde acá.
//
// ⛔ Cuenta descartable propia (`qa-motor`): BDI/Zattia/Stunned quedan intactas
// por construcción, no por acordarse de filtrar.
import { prisma } from '../lib/prisma.ts';
import { crearEnvios } from '../lib/campanias.ts';
import { DOMINIO_SIMULADOR } from '../lib/email/proveedor.ts';

const SLUG_QA = 'qa-motor';
const POR_DEFECTO = 60;
const ESPERA_MAX_MS = 600_000;
const POLL_MS = 3_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** `260725-1930`: legible, ordenable y único por corrida. */
function nuevoRunId(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}${p(d.getMonth() + 1)}${p(d.getFullYear() % 100)}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/** `success@` siempre entrega OK en el simulador; el +tag lo hace único por contacto. */
const emailExito = (runId: string, i: number) => `success+motor-${runId}-${i}@${DOMINIO_SIMULADOR}`;

// ─────────────────────────────────────────────────────────────────────────────

async function preparar(runId: string, cuantos: number) {
  const cuenta = await prisma.cuenta.upsert({
    where: { slug: SLUG_QA },
    update: {},
    create: { slug: SLUG_QA, nombre: 'QA · Ensayo del motor (borrar)' },
  });

  const lista = await prisma.lista.create({
    data: { cuentaId: cuenta.id, nombre: `Ensayo motor ${runId}` },
  });

  for (let i = 0; i < cuantos; i += 100) {
    await prisma.contacto.createMany({
      data: Array.from({ length: Math.min(100, cuantos - i) }, (_, k) => ({
        cuentaId: cuenta.id,
        email: emailExito(runId, i + k),
        nombre: `Ensayo ${i + k}`,
        estado: 'ACTIVO' as const,
        tnAcceptsMkt: true, // contactosElegibles lo exige
        source: 'qa-simulator',
      })),
    });
  }

  const contactos = await prisma.contacto.findMany({
    where: { cuentaId: cuenta.id, email: { startsWith: `success+motor-${runId}-` } },
    select: { id: true },
  });
  await prisma.contactoLista.createMany({
    data: contactos.map((c) => ({ contactoId: c.id, listaId: lista.id })),
    skipDuplicates: true,
  });

  const campania = await prisma.campania.create({
    data: {
      cuentaId: cuenta.id,
      nombre: `Ensayo motor ${runId}`,
      asunto: `[Ensayo ${runId}] carga del motor de envío`,
      listaId: lista.id,
      contenido: {
        bloques: [
          { tipo: 'titulo', texto: 'Ensayo de carga' },
          { tipo: 'texto', texto: 'Mail generado por scripts/ensayo-motor.ts. Si te llegó, algo salió mal.' },
        ],
      },
    },
  });

  return { cuenta, lista, campania, total: contactos.length };
}

/** Guardas: cualquiera que falle aborta ANTES de mandar un solo mail. */
async function verificarGuardas(cuentaId: string, campaniaId: string) {
  const cuenta = await prisma.cuenta.findUnique({ where: { id: cuentaId } });
  if (cuenta?.slug !== SLUG_QA) throw new Error(`La cuenta resuelta no es "${SLUG_QA}" (es "${cuenta?.slug}")`);

  // Allowlist dura: el script queda incapaz de escribirle a una persona real.
  const envios = await prisma.envio.findMany({
    where: { campaniaId },
    include: { contacto: { select: { email: true } } },
  });
  const ajenos = envios.filter((e) => !e.contacto.email.endsWith(`@${DOMINIO_SIMULADOR}`));
  if (ajenos.length) {
    throw new Error(`Hay ${ajenos.length} destinatario(s) fuera del simulador: ${ajenos.slice(0, 5).map((e) => e.contacto.email).join(', ')}`);
  }
  if (!envios.length) throw new Error('No se encoló ningún envío');
  return envios.length;
}

/**
 * Deja la campaña ENVIANDO y le da el empujón inicial al worker de prod. A
 * partir de ahí NO volvemos a empujar: si la cola no se auto-encadena bien,
 * queremos que se note (el cron de 15 min sería el que la rescate).
 */
async function arrancarYSeguir(campaniaId: string, total: number) {
  await prisma.campania.update({ where: { id: campaniaId }, data: { estado: 'ENVIANDO' } });

  const appUrl = process.env.APP_URL;
  const secret = process.env.CRON_SECRET;
  if (!appUrl || !secret) throw new Error('Faltan APP_URL o CRON_SECRET');

  const t0 = Date.now();
  const res = await fetch(`${appUrl}/api/campanias/procesar-cola?secret=${encodeURIComponent(secret)}`, { method: 'POST' });
  console.log(`   empujón inicial → ${res.status}: ${(await res.text()).slice(0, 200)}`);
  if (!res.ok) throw new Error('El worker de la cola no arrancó');

  let ultimoEnviados = -1;
  let quietoDesde = Date.now();
  for (;;) {
    const [enviados, encolados, fallidos] = await Promise.all([
      prisma.envio.count({ where: { campaniaId, estado: 'ENVIADO' } }),
      prisma.envio.count({ where: { campaniaId, estado: 'ENCOLADO' } }),
      prisma.envio.count({ where: { campaniaId, estado: 'FALLIDO' } }),
    ]);
    const seg = Math.round((Date.now() - t0) / 1000);

    if (enviados !== ultimoEnviados) {
      const ritmo = seg > 0 ? (enviados / seg).toFixed(2) : '—';
      console.log(`   ${String(seg).padStart(4)}s · enviados ${enviados}/${total} · encolados ${encolados} · fallidos ${fallidos} · ${ritmo}/seg`);
      ultimoEnviados = enviados;
      quietoDesde = Date.now();
    }

    if (encolados === 0) return { seg, enviados, fallidos };

    // Si la cola se quedó muda, el auto-encadenamiento falló: eso ES el hallazgo.
    if (Date.now() - quietoDesde > 120_000) {
      console.log(`   ⚠️  120s sin avanzar con ${encolados} encolados: el auto-encadenamiento se cortó.`);
      console.log('      (el cron de 15 min debería retomarla; para verlo, dejar correr y volver a mirar)');
      return { seg, enviados, fallidos, cortada: true };
    }
    if (Date.now() - t0 > ESPERA_MAX_MS) throw new Error('El ensayo pasó los 10 minutos');
    await sleep(POLL_MS);
  }
}

async function informe(campaniaId: string, total: number) {
  const campania = await prisma.campania.findUnique({
    where: { id: campaniaId },
    select: { estado: true, enviadaAt: true },
  });
  const sinMessageId = await prisma.envio.count({
    where: { campaniaId, estado: 'ENVIADO', sesMessageId: null },
  });

  const filas = [
    ['campaña quedó', campania?.estado ?? '(no existe)', 'ENVIADA'],
    ['enviados', String(await prisma.envio.count({ where: { campaniaId, estado: 'ENVIADO' } })), String(total)],
    ['fallidos', String(await prisma.envio.count({ where: { campaniaId, estado: 'FALLIDO' } })), '0'],
    ['encolados sin mandar', String(await prisma.envio.count({ where: { campaniaId, estado: 'ENCOLADO' } })), '0'],
    ['enviados sin sesMessageId', String(sinMessageId), '0'],
  ];

  console.log('\n── Resultado ──');
  let ok = true;
  for (const [que, actual, esperado] of filas) {
    const bien = actual === esperado;
    ok &&= bien;
    console.log(`   ${bien ? '✅' : '❌'} ${que.padEnd(28)} ${actual.padEnd(12)} (esperado: ${esperado})`);
  }
  return ok;
}

async function limpiar() {
  const cuenta = await prisma.cuenta.findUnique({ where: { slug: SLUG_QA } });
  if (!cuenta) return console.log('No hay nada que limpiar.');
  // Envio y ContactoLista caen por cascada desde Campania/Contacto.
  const c = await prisma.campania.deleteMany({ where: { cuentaId: cuenta.id } });
  const k = await prisma.contacto.deleteMany({ where: { cuentaId: cuenta.id } });
  const l = await prisma.lista.deleteMany({ where: { cuentaId: cuenta.id } });
  await prisma.cuenta.delete({ where: { id: cuenta.id } });
  console.log(`Borrado: ${c.count} campaña(s), ${k.count} contacto(s), ${l.count} lista(s) y la cuenta ${SLUG_QA}.`);
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--limpiar')) return limpiar();

  const cuantos = Number(args.find((a) => a.startsWith('--contactos='))?.split('=')[1] ?? POR_DEFECTO);
  if (!Number.isInteger(cuantos) || cuantos < 1 || cuantos > 5000) throw new Error('--contactos tiene que ser un entero entre 1 y 5000');

  const runId = nuevoRunId();
  console.log(`\n▶ Ensayo del motor · run ${runId} · ${cuantos} destinatarios del simulador\n`);

  const { cuenta, campania, total } = await preparar(runId, cuantos);
  console.log(`   cuenta ${cuenta.slug} · campaña ${campania.id} · ${total} contacto(s)`);

  const contactos = await prisma.contacto.findMany({
    where: { cuentaId: cuenta.id, email: { startsWith: `success+motor-${runId}-` } },
    select: { id: true },
  });
  await crearEnvios(cuenta.id, campania.id, contactos, null);

  const encolados = await verificarGuardas(cuenta.id, campania.id);
  console.log(`   guardas OK · ${encolados} envío(s) encolado(s)\n`);

  const r = await arrancarYSeguir(campania.id, total);
  console.log(`\n   terminó en ${r.seg}s${r.cortada ? ' (con la cadena cortada)' : ''}`);

  const ok = await informe(campania.id, total);
  console.log(
    ok
      ? '\n✅ El motor aguantó. Limpiar con: node --import tsx --env-file=.env scripts/ensayo-motor.ts --limpiar\n'
      : '\n❌ Algo no cerró — mirar arriba antes de limpiar.\n',
  );
  if (!ok) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(`\n❌ ${e instanceof Error ? e.message : e}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
