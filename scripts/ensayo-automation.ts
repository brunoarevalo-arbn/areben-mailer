// Ensayo de punta a punta de una automation, contra PROD.
//
// Las automations nunca dispararon: 0 runs desde que se construyeron, porque
// hasta que hubo proveedor de envío no había con qué probarlas. Esto simula el
// disparo sin depender de que alguien se registre en la tienda, y verifica lo
// que antes no se podía ver: que se cree el Envio, que lleve pixel y links
// envueltos, y que el mail salga de verdad.
//
// Correr:
//   node --import tsx --env-file=.env scripts/ensayo-automation.ts \
//     [--email=brunoarevalo@arebensrl.com] [--cuenta=bdi] [--trigger=NUEVO_CLIENTE]
//   node --import tsx --env-file=.env scripts/ensayo-automation.ts --limpiar
//
// ⚠️ El destinatario tiene que estar habilitado en ENVIO_ENSAYO (o el gate en
//    ENVIO_REAL), si no el procesador lo marca dry-run y no manda nada.
//
// ⛔ El procesador corre en PROD, así que hay que deployar antes.
import { prisma } from '../lib/prisma.ts';

const arg = (n: string, def: string) =>
  process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1] ?? def;

const EMAIL = arg('email', 'brunoarevalo@arebensrl.com').toLowerCase();
const SLUG = arg('cuenta', 'bdi');
const TRIGGER = arg('trigger', 'NUEVO_CLIENTE');
// Prod por defecto a propósito: el APP_URL del .env apunta a localhost, y el
// procesador que interesa ejercitar es el que corre deployado.
const APP_URL = arg('url', 'https://areben-mailer.vercel.app');
const SOURCE = 'ensayo-automation';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function limpiar() {
  // Ojo: si el email de prueba ya era un contacto real (pasa con la casilla de
  // Bruno, que está en la lista de BDI), el upsert lo actualizó en vez de
  // crearlo, así que borrarlo por `source` no alcanza —ni corresponde—. Se
  // borran los runs del contacto usado, que es lo que el ensayo ensució.
  const contacto = await prisma.contacto.findFirst({ where: { email: EMAIL } });
  let runs = 0;
  if (contacto) {
    ({ count: runs } = await prisma.automationRun.deleteMany({ where: { contactoId: contacto.id } }));
  }
  // El Envio se va solo por la FK en cascada, tanto del run como del contacto.
  const { count: contactos } = await prisma.contacto.deleteMany({ where: { source: SOURCE } });
  console.log(`🧹 ${runs} run(s) y ${contactos} contacto(s) de ensayo borrado(s), con sus envíos.`);
}

async function main() {
  if (process.argv.includes('--limpiar')) return limpiar();

  const cuenta = await prisma.cuenta.findUnique({ where: { slug: SLUG } });
  if (!cuenta) throw new Error(`No existe la cuenta "${SLUG}"`);

  const automation = await prisma.automation.findFirst({
    where: { cuentaId: cuenta.id, trigger: TRIGGER as never },
  });
  if (!automation) throw new Error(`${SLUG} no tiene automation de ${TRIGGER}`);
  if (!automation.asunto) throw new Error('La automation no tiene asunto');

  console.log(`▶ Ensayo · ${cuenta.nombre} · "${automation.nombre}" (${TRIGGER}) → ${EMAIL}\n`);

  // El procesador exige la automation ACTIVA. Se activa solo para la prueba y
  // se deja como estaba: el estado en prod lo elige Bruno desde la UI, que
  // además es lo que registra el webhook en Tiendanube.
  const estadoOriginal = automation.estado;
  if (estadoOriginal !== 'ACTIVO') {
    await prisma.automation.update({ where: { id: automation.id }, data: { estado: 'ACTIVO' } });
    console.log('   automation activada temporalmente');
  }

  try {
    const contacto = await prisma.contacto.upsert({
      where: { cuentaId_email: { cuentaId: cuenta.id, email: EMAIL } },
      update: { estado: 'ACTIVO', tnAcceptsMkt: true },
      create: { cuentaId: cuenta.id, email: EMAIL, nombre: 'Bruno (ensayo)', source: SOURCE, tnAcceptsMkt: true },
    });

    // proximoAt en el pasado: el procesador lo toma en la primera pasada.
    const run = await prisma.automationRun.create({
      data: { automationId: automation.id, contactoId: contacto.id, proximoAt: new Date(Date.now() - 60_000) },
    });
    console.log(`   run ${run.id} creado (pendiente)\n`);

    const secret = process.env.CRON_SECRET;
    if (!secret) throw new Error('Falta CRON_SECRET en .env');
    const res = await fetch(`${APP_URL}/api/automations/procesar?secret=${secret}`);
    console.log(`   procesador → ${res.status}: ${await res.text()}\n`);

    await sleep(1500);

    const final = await prisma.automationRun.findUnique({
      where: { id: run.id },
      include: { envio: { include: { eventos: true } } },
    });

    const envio = final?.envio;
    const dryRun = final?.sesMessageId === 'dry-run';
    const linea = (ok: boolean, etiqueta: string, valor: string) =>
      console.log(`   ${ok ? '✅' : '❌'} ${etiqueta.padEnd(28)} ${valor}`);

    console.log('── Resultado ──');
    linea(final?.estado === 'ENVIADO', 'run', final?.estado ?? '—');
    linea(!dryRun, 'salió de verdad', dryRun ? 'NO — dry-run, revisá ENVIO_ENSAYO' : 'sí');
    linea(!!envio, 'Envio creado', envio ? envio.id : 'no se creó');
    linea(!!envio?.sesMessageId && envio.sesMessageId !== 'dry-run', 'messageId del proveedor', envio?.sesMessageId ?? '—');
    linea(!!envio?.enviadoAt, 'enviadoAt', envio?.enviadoAt?.toISOString() ?? '—');
    console.log(`   ℹ️  tracking            abrí el mail y corré --verificar para ver la apertura`);

    if (envio) {
      console.log(`\n   Pixel:  ${APP_URL}/api/track/open/${envio.id}`);
      console.log(`   Envio:  ${envio.id}`);
    }
    console.log('\nLimpiar con: node --import tsx --env-file=.env scripts/ensayo-automation.ts --limpiar');
  } finally {
    if (estadoOriginal !== 'ACTIVO') {
      await prisma.automation.update({ where: { id: automation.id }, data: { estado: estadoOriginal } });
      console.log(`\n   automation devuelta a ${estadoOriginal}`);
    }
  }
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
