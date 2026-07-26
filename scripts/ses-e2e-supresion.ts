// E2E del camino rebote/queja → supresión, usando el mailbox simulator de SES.
//
// Se puede correr CON LA CUENTA EN SANDBOX: el simulador no exige verificar el
// destinatario, no consume la cuota diaria (sí respeta el rate de 1/seg) y no
// afecta la reputación.
//
// Correr:
//   APP_URL=https://areben-mailer.vercel.app \
//     node --import tsx --env-file=.env scripts/ses-e2e-supresion.ts
//   node --import tsx --env-file=.env scripts/ses-e2e-supresion.ts --verificar <runId>
//   node --import tsx --env-file=.env scripts/ses-e2e-supresion.ts --limpiar
//
// ⚠️ El evento del SNS lo recibe PROD (la suscripción apunta a
// areben-mailer.vercel.app/api/ses/sns), así que hay que deployar antes de correr
// esto. El script escribe en la misma base que lee prod, por eso puede verificar
// desde acá.
//
// ⛔ NO toca ENVIO_REAL: la campaña de prueba se encola por debajo del gate, que
// sigue protegiendo el envío a las listas reales.
import { prisma } from '../lib/prisma.ts';
import { crearEnvios } from '../lib/campanias.ts';
import { procesarLote } from '../lib/email/procesar.ts';

const SLUG_QA = 'qa-ses';
const DOMINIO_SIMULADOR = 'simulator.amazonses.com';
const ESPERA_MAX_MS = 180_000;
const POLL_MS = 5_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** `260725-1930`: legible, ordenable y único por corrida. En minúscula, porque
 *  aplicarSupresion compara los emails del evento en lowercase. */
function nuevoRunId(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}${p(d.getMonth() + 1)}${p(d.getFullYear() % 100)}-${p(d.getHours())}${p(d.getMinutes())}`.toLowerCase();
}

const emailBounce = (runId: string) => `bounce+ses-e2e-${runId}@${DOMINIO_SIMULADOR}`;
const emailComplaint = (runId: string) => `complaint+ses-e2e-${runId}@${DOMINIO_SIMULADOR}`;

// ─────────────────────────────────────────────────────────────────────────────

async function preparar(runId: string) {
  // Cuenta descartable: como todas las métricas de la app están scopeadas por
  // cuentaId, BDI/Zattia/Stunned quedan intactas por construcción, no por filtrar.
  const cuenta = await prisma.cuenta.upsert({
    where: { slug: SLUG_QA },
    update: {},
    create: { slug: SLUG_QA, nombre: 'QA · Simulador SES (borrar)' },
  });

  const lista = await prisma.lista.create({
    data: { cuentaId: cuenta.id, nombre: `E2E supresión ${runId}` },
  });

  const contactos = [];
  for (const [email, nombre] of [
    [emailBounce(runId), 'Rebote'],
    [emailComplaint(runId), 'Queja'],
  ]) {
    const c = await prisma.contacto.create({
      data: {
        cuentaId: cuenta.id,
        email,
        nombre,
        estado: 'ACTIVO',
        tnAcceptsMkt: true, // contactosElegibles lo exige
        source: 'qa-simulator',
        listas: { create: { listaId: lista.id } },
      },
    });
    contactos.push(c);
  }

  const campania = await prisma.campania.create({
    data: {
      cuentaId: cuenta.id,
      nombre: `E2E supresión ${runId}`,
      asunto: `[E2E ${runId}] prueba de supresión`,
      listaId: lista.id,
      contenido: {
        bloques: [
          { tipo: 'titulo', texto: 'Prueba automática' },
          { tipo: 'texto', texto: 'Mail generado por scripts/ses-e2e-supresion.ts. Si te llegó, algo salió mal.' },
        ],
      },
    },
  });

  return { cuenta, lista, campania, contactos };
}

/** Guardas: cualquiera que falle aborta ANTES de mandar un solo mail. */
async function verificarGuardas(cuentaId: string, campaniaId: string) {
  if (process.env.SES_CONFIGURATION_SET !== 'areben-mailer') {
    throw new Error(
      `SES_CONFIGURATION_SET es "${process.env.SES_CONFIGURATION_SET ?? '(vacío)'}" y tiene que ser "areben-mailer".\n` +
        '   Sin el configuration set, SES no publica los eventos al SNS y el test NO PUEDE pasar nunca.',
    );
  }

  const cuenta = await prisma.cuenta.findUnique({ where: { id: cuentaId } });
  if (cuenta?.slug !== SLUG_QA) throw new Error(`La cuenta resuelta no es "${SLUG_QA}" (es "${cuenta?.slug}")`);

  // Allowlist dura: el script queda incapaz de escribirle a una persona real.
  const envios = await prisma.envio.findMany({
    where: { campaniaId },
    include: { contacto: { select: { email: true } } },
  });
  const ajenos = envios.filter((e) => !e.contacto.email.endsWith(`@${DOMINIO_SIMULADOR}`));
  if (ajenos.length) {
    throw new Error(`Hay ${ajenos.length} destinatario(s) fuera del simulador: ${ajenos.map((e) => e.contacto.email).join(', ')}`);
  }
  if (!envios.length) throw new Error('No se encoló ningún envío');

  return envios.length;
}

async function enviar(campaniaId: string) {
  let vueltas = 0;
  for (;;) {
    const r = await procesarLote(campaniaId);
    if (!r) throw new Error('La campaña desapareció');
    console.log(`   lote ${++vueltas}: ${r.enviados} enviados, ${r.fallidos} fallidos, ${r.restantes} restantes${r.throttled ? ' (throttled)' : ''}`);
    if (r.restantes === 0) break;
    await sleep(1100); // rate del sandbox: 1 mail por segundo
  }
}

/**
 * Modo --cola: en vez de mandar desde acá, deja la campaña ENVIANDO y le pide al
 * worker de producción que la levante. Ejercita el lease, el auto-encadenamiento
 * y el camino real de la cola del servidor.
 */
async function enviarPorLaCola(campaniaId: string) {
  await prisma.campania.update({ where: { id: campaniaId }, data: { estado: 'ENVIANDO' } });

  const appUrl = process.env.APP_URL;
  const secret = process.env.CRON_SECRET;
  if (!appUrl || !secret) throw new Error('Faltan APP_URL o CRON_SECRET para usar --cola');

  const res = await fetch(`${appUrl}/api/campanias/procesar-cola?secret=${encodeURIComponent(secret)}`, { method: 'POST' });
  const cuerpo = await res.text();
  console.log(`   worker respondió ${res.status}: ${cuerpo}`);
  if (!res.ok) throw new Error('El worker de la cola falló');

  // El worker puede haber encadenado; esperamos a que no queden encolados.
  for (let i = 0; i < 60; i++) {
    const encolados = await prisma.envio.count({ where: { campaniaId, estado: 'ENCOLADO' } });
    if (encolados === 0) {
      const c = await prisma.campania.findUnique({ where: { id: campaniaId }, select: { estado: true } });
      console.log(`   cola vacía · campaña quedó ${c?.estado}`);
      return;
    }
    await sleep(2000);
  }
  throw new Error('La cola no terminó en 2 minutos');
}

// ─────────────────────────────────────────────────────────────────────────────

interface Fila {
  que: string;
  esperado: string;
  actual: string;
  ok: boolean;
}

async function estado(runId: string): Promise<Fila[]> {
  const filas: Fila[] = [];
  for (const [email, esperadoContacto, esperadoEnvio] of [
    [emailBounce(runId), 'REBOTADO', 'REBOTE'],
    [emailComplaint(runId), 'SPAM', 'SPAM'],
  ]) {
    const contacto = await prisma.contacto.findFirst({
      where: { email },
      include: { envios: { select: { estado: true, sesMessageId: true } } },
    });
    filas.push({
      que: `contacto ${email.split('+')[0]}`,
      esperado: esperadoContacto,
      actual: contacto?.estado ?? '(no existe)',
      ok: contacto?.estado === esperadoContacto,
    });
    const envio = contacto?.envios[0];
    filas.push({
      que: `envío   ${email.split('+')[0]}`,
      esperado: esperadoEnvio,
      actual: envio ? `${envio.estado}${envio.sesMessageId ? '' : ' (sin messageId ⚠️)'}` : '(no existe)',
      ok: envio?.estado === esperadoEnvio,
    });
  }
  return filas;
}

function imprimir(filas: Fila[]) {
  for (const f of filas) {
    const icono = f.ok ? '✅' : '⏳';
    console.log(`   ${icono} ${f.que.padEnd(45)} ${f.actual.padEnd(24)} (esperado: ${f.esperado})`);
  }
}

async function esperarEventos(runId: string) {
  const t0 = Date.now();
  for (;;) {
    const filas = await estado(runId);
    if (filas.every((f) => f.ok)) return filas;
    if (Date.now() - t0 > ESPERA_MAX_MS) return filas;
    await sleep(POLL_MS);
  }
}

async function limpiar() {
  const cuenta = await prisma.cuenta.findUnique({ where: { slug: SLUG_QA } });
  if (!cuenta) {
    console.log(`No existe la cuenta "${SLUG_QA}" — nada que limpiar.`);
    return;
  }
  // El cascade se lleva contactos, listas, campañas, envíos y eventos.
  await prisma.cuenta.delete({ where: { slug: SLUG_QA } });
  console.log(`🧹 Cuenta "${SLUG_QA}" borrada (con todos sus datos).`);
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const [flag, arg] = process.argv.slice(2);

  if (flag === '--limpiar') return limpiar();

  if (flag === '--verificar') {
    if (!arg) throw new Error('Falta el runId: --verificar <runId>');
    console.log(`\n🔎 Estado de la corrida ${arg}:\n`);
    const filas = await estado(arg);
    imprimir(filas);
    console.log(filas.every((f) => f.ok) ? '\n✅ Todo verde.\n' : '\n⏳ Todavía no cerró.\n');
    return;
  }

  const viaCola = flag === '--cola';
  const runId = nuevoRunId();
  console.log(`\n🧪 E2E de supresión — runId ${runId}${viaCola ? ' (por la cola del servidor)' : ''}`);
  console.log(`   provider=${process.env.EMAIL_PROVIDER ?? 'ses'} · configSet=${process.env.SES_CONFIGURATION_SET} · appUrl=${process.env.APP_URL}\n`);

  console.log('1. Preparando datos de prueba…');
  const { cuenta, campania } = await preparar(runId);
  const contactos = await prisma.contacto.findMany({ where: { cuentaId: cuenta.id }, select: { id: true } });
  await crearEnvios(campania.id, contactos, null);

  console.log('2. Verificando guardas…');
  const total = await verificarGuardas(cuenta.id, campania.id);
  console.log(`   ✅ ${total} envíos, todos a @${DOMINIO_SIMULADOR}\n`);

  console.log(viaCola ? '3. Enviando por la COLA DEL SERVIDOR…' : '3. Enviando por SES…');
  if (viaCola) await enviarPorLaCola(campania.id);
  else await enviar(campania.id);

  const envios = await prisma.envio.findMany({
    where: { campaniaId: campania.id },
    include: { contacto: { select: { email: true } } },
  });
  console.log('');
  for (const e of envios) console.log(`   ${e.contacto.email} → ${e.sesMessageId ?? '(SIN messageId ⚠️)'}`);

  console.log(`\n4. Esperando los eventos del SNS (hasta ${ESPERA_MAX_MS / 1000}s)…\n`);
  const filas = await esperarEventos(runId);
  imprimir(filas);

  const ok = filas.every((f) => f.ok);
  console.log(
    ok
      ? '\n✅ CAMINO DE SUPRESIÓN VERIFICADO de punta a punta.\n'
      : '\n❌ No cerró. Los datos quedan en la base para diagnosticar (no limpies todavía).\n' +
          '   Mirá los logs de prod filtrando por "ses-sns":  vercel logs areben-mailer.vercel.app\n' +
          '   · Si NO hay ninguna línea → el evento no llegó (config set / suscripción SNS / deploy).\n' +
          '   · Si hay línea con contactos:0, envios:0 → llegó pero no matcheó (comparar messageId).\n',
  );
  console.log(`   Re-verificar:  node --import tsx --env-file=.env scripts/ses-e2e-supresion.ts --verificar ${runId}`);
  console.log(`   Limpiar:       node --import tsx --env-file=.env scripts/ses-e2e-supresion.ts --limpiar\n`);

  if (!ok) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(`\n❌ ${e instanceof Error ? e.message : e}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
