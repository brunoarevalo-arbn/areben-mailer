// Manda UNA campaña de verdad a las casillas de ENVIO_ENSAYO, por el camino real
// (cola de prod, tracking, baja one-click), para mirarla en el buzón.
//
// Es la mitad que `ensayo-motor.ts` no cubre: aquel prueba que el motor aguante
// volumen contra el simulador; este prueba lo que solo se ve con ojos —cómo
// renderiza en Gmail/Outlook/celular, si el pixel de apertura y el redirect de
// clicks registran, y si la baja one-click aparece.
//
// Correr (la marca define el remitente y el pie):
//   APP_URL=https://areben-mailer.vercel.app \
//     node --import tsx --env-file=.env scripts/ensayo-campania.ts bdi
//   node --import tsx --env-file=.env scripts/ensayo-campania.ts --estado <campaniaId>
//
// ⚠️ Deployar antes: el worker que manda corre en prod. Y los destinatarios
// tienen que estar VERIFICADOS en SES mientras la cuenta siga en sandbox
// (scripts/ses-verify-email.ts).
import { prisma } from '../lib/prisma.ts';
import { crearEnvios } from '../lib/campanias.ts';
import { destinatarioPermitido, modoEnvio } from '../lib/email/proveedor.ts';

const LISTA = 'Ensayo interno';

function bloques() {
  return [
    { tipo: 'titulo', texto: 'Hola ${contacto.nombre} 👋', align: 'left' },
    {
      tipo: 'texto',
      texto:
        'Este es un ensayo del motor de envío. Si lo estás leyendo en tu buzón, ' +
        'el camino completo funciona: cola del servidor, render, tracking y baja.',
      align: 'left',
    },
    { tipo: 'divisor' },
    {
      tipo: 'seccion',
      bg: '#faf7f0',
      titulo: 'Qué mirar acá',
      texto:
        'Que los acentos y la ñ se vean bien, que no haya un scroll horizontal en el ' +
        'celular, y que el botón de abajo sea cómodo de tocar con el dedo.',
      botonTexto: '',
      botonUrl: '',
    },
    { tipo: 'boton', texto: 'Probar un click', url: 'https://bdiaccesorios.com.ar', align: 'left', full: false },
    {
      tipo: 'texto',
      texto: 'El click de arriba pasa por el redirect de tracking: debería quedar registrado en la campaña.',
      align: 'left',
    },
  ];
}

async function preparar(slug: string, destinos: string[]) {
  const cuenta = await prisma.cuenta.findUnique({ where: { slug } });
  if (!cuenta) throw new Error(`No existe la cuenta "${slug}"`);

  const lista =
    (await prisma.lista.findFirst({ where: { cuentaId: cuenta.id, nombre: LISTA } })) ??
    (await prisma.lista.create({ data: { cuentaId: cuenta.id, nombre: LISTA } }));

  for (const email of destinos) {
    const c = await prisma.contacto.upsert({
      where: { cuentaId_email: { cuentaId: cuenta.id, email } },
      update: { estado: 'ACTIVO', tnAcceptsMkt: true },
      create: {
        cuentaId: cuenta.id,
        email,
        nombre: email.split('@')[0],
        estado: 'ACTIVO',
        tnAcceptsMkt: true, // contactosElegibles lo exige
        source: 'ensayo-interno',
      },
    });
    await prisma.contactoLista.upsert({
      where: { contactoId_listaId: { contactoId: c.id, listaId: lista.id } },
      update: {},
      create: { contactoId: c.id, listaId: lista.id },
    });
  }

  const campania = await prisma.campania.create({
    data: {
      cuentaId: cuenta.id,
      nombre: `Ensayo interno · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
      asunto: 'Ensayo del motor de envío — ¿se ve bien?',
      preheader: 'Si estás leyendo esto en tu buzón, el camino completo funciona.',
      listaId: lista.id,
      contenido: { bloques: bloques() },
    },
  });

  return { cuenta, lista, campania };
}

async function estado(campaniaId: string) {
  const envios = await prisma.envio.findMany({
    where: { campaniaId },
    include: { contacto: { select: { email: true } } },
  });
  console.log('\n── Estado de los envíos ──');
  for (const e of envios) {
    const marcas = [
      e.abiertoAt ? `abierto ${e.abiertoAt.toISOString().slice(11, 19)}` : null,
      e.clickAt ? `click ${e.clickAt.toISOString().slice(11, 19)}` : null,
    ].filter(Boolean);
    console.log(`   ${e.estado.padEnd(10)} ${e.contacto.email.padEnd(32)} ${marcas.join(' · ') || '—'}`);
  }
  console.log();
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === '--estado') {
    if (!args[1]) throw new Error('Pasá el id de campaña');
    return estado(args[1]);
  }

  const slug = args[0];
  if (!slug) throw new Error('Pasá la marca: bdi | zattia | stunned');

  const modo = modoEnvio();
  if (modo === 'bloqueado') throw new Error('El gate está bloqueado: falta ENVIO_ENSAYO (o ENVIO_REAL)');
  if (modo === 'real') throw new Error('El gate está en REAL. Este script es para ensayo: no lo corras así.');

  // Destinos = las direcciones exactas de ENVIO_ENSAYO (las entradas "@dominio"
  // no son casillas, son reglas: no se puede mandar a un dominio).
  const destinos = (process.env.ENVIO_ENSAYO ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e && !e.startsWith('@'));
  if (!destinos.length) throw new Error('ENVIO_ENSAYO no tiene ninguna dirección concreta');

  console.log(`\n▶ Ensayo de campaña · marca ${slug} · modo ${modo}`);
  console.log(`   destinos: ${destinos.join(', ')}\n`);

  const { campania } = await preparar(slug, destinos);
  const contactos = await prisma.contacto.findMany({
    where: { cuentaId: campania.cuentaId, email: { in: destinos } },
    select: { id: true, email: true },
  });

  // Guarda: nadie fuera de la lista blanca, ni por error de tipeo en el .env.
  const ajenos = contactos.filter((c) => !destinatarioPermitido(c.email));
  if (ajenos.length) throw new Error(`Destinatarios no permitidos: ${ajenos.map((c) => c.email).join(', ')}`);

  await crearEnvios(campania.id, contactos, null);
  await prisma.campania.update({ where: { id: campania.id }, data: { estado: 'ENVIANDO' } });

  const appUrl = process.env.APP_URL;
  const secret = process.env.CRON_SECRET;
  if (!appUrl || !secret) throw new Error('Faltan APP_URL o CRON_SECRET');
  const res = await fetch(`${appUrl}/api/campanias/procesar-cola?secret=${encodeURIComponent(secret)}`, { method: 'POST' });
  console.log(`   worker → ${res.status}: ${(await res.text()).slice(0, 200)}\n`);

  await estado(campania.id);
  console.log(`   Campaña ${campania.id}`);
  console.log(`   Ver aperturas/clicks más tarde:\n     node --import tsx --env-file=.env scripts/ensayo-campania.ts --estado ${campania.id}\n`);
}

main()
  .catch((e) => {
    console.error(`\n❌ ${e instanceof Error ? e.message : e}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
