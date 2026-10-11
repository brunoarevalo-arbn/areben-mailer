// Escribe «Carrito v2 · B» (`secuencia-carrito-b.ts`) sobre los 4 «Carrito v2»
// que ya existen en PAUSADO. No prende nada ni manda nada: prender es
// `cambiar-secuencia-carrito.ts`, que es otra decisión.
//
//   node --env-file=.env --import tsx scripts/actualizar-secuencia-carrito-b.ts            # mira, no escribe
//   node --env-file=.env --import tsx scripts/actualizar-secuencia-carrito-b.ts --escribir
//
// 🔴 Va DESPUÉS del deploy: la B usa piezas que la Prisma vieja lee sin problema
// (es Json), pero el renderer viejo NO las conoce —la `banda` no existe, el
// carrito sin `vista` se dibuja en lista— y el editor de producción mostraría
// otra cosa que el mail.
//
// - Aborta si alguna de las 4 no está PAUSADA: no se reescribe un mail que sale.
// - Guarda una copia del Json de antes en `.mirar/copias/` (para `--volver`).
// - Escribe con `updateMany` condicional por `docVersion`, como el editor: si
//   alguien lo guardó mientras corría, NO se escribe.
// - `remitenteNombre` / `responderA` no se tocan (el 2/4 lo sigue firmando Bruno).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { prisma } from '../lib/prisma.ts';
import { armarSecuenciaB, PREFIJO } from './secuencia-carrito-b.ts';

const slug = process.argv.find((a) => a.startsWith('--cuenta='))?.split('=')[1] ?? 'bdi';
const escribir = process.argv.includes('--escribir');
const volver = process.argv.find((a) => a.startsWith('--volver='))?.split('=')[1];

async function main() {
  const cuenta = await prisma.cuenta.findFirst({ where: { slug } });
  if (!cuenta) throw new Error(`no existe la cuenta "${slug}"`);
  const todas = await prisma.automation.findMany({
    where: { cuentaId: cuenta.id, trigger: 'CARRITO_ABANDONADO' },
    orderBy: { esperaHoras: 'asc' },
    select: { id: true, nombre: true, estado: true, esperaHoras: true, contenido: true, asunto: true, preheader: true, docVersion: true },
  });
  const v2 = todas.filter((a) => a.nombre.startsWith(PREFIJO));
  if (v2.length !== 4) throw new Error(`se esperaban 4 «${PREFIJO}» y hay ${v2.length}`);
  const activas = v2.filter((a) => a.estado !== 'PAUSADO');
  if (activas.length) throw new Error(`⛔ hay «${PREFIJO}» que NO están PAUSADAS: ${activas.map((a) => a.nombre).join(', ')}`);

  // `--volver=<copia.json>`: deja los 4 como estaban en esa copia.
  const nuevos = volver
    ? (JSON.parse(readFileSync(volver, 'utf8')) as { nombre: string; asunto: string | null; preheader: string | null; contenido: object }[])
    : armarSecuenciaB(todas.filter((a) => !a.nombre.startsWith(PREFIJO)));

  if (!volver) {
    const dir = join(process.cwd(), '.mirar', 'copias');
    mkdirSync(dir, { recursive: true });
    const archivo = join(dir, `carrito-v2-antes-de-b-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    writeFileSync(archivo, JSON.stringify(v2.map(({ nombre, asunto, preheader, contenido }) => ({ nombre, asunto, preheader, contenido })), null, 2));
    console.log(`copia de lo de hoy: ${archivo}`);
  }

  for (const a of v2) {
    const n = nuevos.find((m) => m.nombre === a.nombre);
    if (!n) throw new Error(`no armé nada para «${a.nombre}»`);
    console.log(`${escribir ? '+' : '~'} ${a.nombre}`);
    console.log(`     asunto:    «${a.asunto}» → «${n.asunto}»`);
    console.log(`     preheader: «${a.preheader ?? ''}» → «${n.preheader ?? ''}»`);
    if (!escribir) continue;
    const r = await prisma.automation.updateMany({
      where: { id: a.id, docVersion: a.docVersion, estado: 'PAUSADO' },
      data: { contenido: n.contenido as object, asunto: n.asunto, preheader: n.preheader, docVersion: { increment: 1 } },
    });
    if (r.count === 0) { console.error('   ⛔ CONFLICTO: alguien lo guardó (o lo prendió) mientras corría. NO se escribió.'); continue; }
    console.log(`   ✔ guardado (docVersion ${a.docVersion} → ${a.docVersion + 1})`);
  }
  console.log(escribir ? '\nListo. Siguen PAUSADOS: mandate la prueba del 1/4 y del 2/4 desde /automations.\n' : '\n(no se escribió nada: agregá --escribir)\n');
}

main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());
