// El rebote deja escrito SI FUE DURO, no sólo que rebotó.
//
// Por qué existe: hasta el 13-ago-2026 un rebote existía únicamente como
// `Envio.estado='REBOTE'`, que no distingue una casilla que NO EXISTE de una
// llena ni de un bloqueo temporal de Gmail. Con público caliente (0,36-0,76% de
// rebote) daba igual; deja de dar igual el día que se le manda a gente que nunca
// validó una compra — ahí el rebote DURO es el número que decide si se sigue.
//
// ⚠️ Toca la base: `registrarRebote` escribe. Por eso corre sobre una cuenta
// descartable propia (`qa-rebote`) que se borra al terminar, en vez de fingir la
// escritura con un mock — un mock habría dado verde con la función rota, que es
// justo lo que este archivo tiene que impedir.
//
//   node --env-file=.env --import tsx scripts/probar-rebote-tipo.ts
import { prisma } from '../lib/prisma.ts';
import { registrarRebote } from '../lib/email/supresion.ts';

const SLUG = 'qa-rebote';
const errores: string[] = [];
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) errores.push(msg);
};

async function limpiar() {
  const cuenta = await prisma.cuenta.findUnique({ where: { slug: SLUG } });
  if (cuenta) await prisma.cuenta.delete({ where: { slug: SLUG } }); // cascade
}

async function main() {
  await limpiar();
  const cuenta = await prisma.cuenta.create({
    data: { slug: SLUG, nombre: 'QA · rebotes (borrar)' },
  });
  const contacto = await prisma.contacto.create({
    data: { cuentaId: cuenta.id, email: `qa-rebote@${SLUG}.invalid`, estado: 'ACTIVO' },
  });
  const MID = `qa-rebote-${contacto.id}`;
  const envio = await prisma.envio.create({
    data: { cuentaId: cuenta.id, contactoId: contacto.id, estado: 'ENVIADO', sesMessageId: MID },
  });

  const eventos = () =>
    prisma.evento.findMany({ where: { envioId: envio.id, tipo: 'BOUNCE' }, orderBy: { createdAt: 'asc' } });

  try {
    // ── Un rebote permanente queda escrito con su subtipo ────────────────────
    const n1 = await registrarRebote({ messageId: MID, bounceType: 'Permanent', bounceSubType: 'NoEmail' });
    const e1 = await eventos();
    ok(n1 === 1 && e1.length === 1, `el rebote permanente se escribe (${n1} evento)`);
    const meta1 = e1[0]?.meta as { bounceType?: string; bounceSubType?: string } | undefined;
    ok(meta1?.bounceType === 'Permanent', `bounceType guardado: ${meta1?.bounceType}`);
    ok(meta1?.bounceSubType === 'NoEmail', `bounceSubType guardado: ${meta1?.bounceSubType}`);

    // ── El mismo evento repetido no cuenta dos veces ─────────────────────────
    // SNS reintenta ante un 5xx, y el handler devuelve 500 a propósito para no
    // perder el rebote. Sin dedup, un reintento infla el número que se mira.
    const n2 = await registrarRebote({ messageId: MID, bounceType: 'Permanent', bounceSubType: 'NoEmail' });
    ok(n2 === 0 && (await eventos()).length === 1, `🔴 el reintento de SNS no duplica (${n2})`);

    // ── Un transitorio SÍ se escribe, aunque no queme a nadie ────────────────
    // Es el sensor de "Gmail me está frenando": un pico de Transient/General no
    // suprime contactos, así que sin esta fila no deja ningún rastro.
    const n3 = await registrarRebote({ messageId: MID, bounceType: 'Transient', bounceSubType: 'General' });
    const e3 = await eventos();
    ok(n3 === 1 && e3.length === 2, `el transitorio también se guarda (${e3.length} eventos)`);
    ok(
      e3.map((e) => (e.meta as { bounceType?: string }).bounceType).join(',') === 'Permanent,Transient',
      'los dos tipos conviven en el mismo envío',
    );

    // ── Sin nada a qué colgarlo, no se inventa una fila ──────────────────────
    ok((await registrarRebote({ bounceType: 'Permanent' })) === 0, 'sin messageId: 0 (queda en el log)');
    ok(
      (await registrarRebote({ messageId: 'no-existe', bounceType: 'Permanent' })) === 0,
      'con un messageId que no casa: 0',
    );
  } finally {
    await limpiar();
  }

  console.log(errores.length ? `\n❌ ${errores.length} en rojo` : '\n✅ El rebote queda escrito con su tipo.');
  process.exit(errores.length ? 1 : 0);
}

main().finally(() => prisma.$disconnect());
