// El pie de confianza del mail de reseña, para que los cuatro mails de BDI
// cierren igual antes de la pasada de diseño de Cande.
//
// Correr:  node --import tsx --env-file=.env scripts/pie-confianza-resena.ts --cuenta=bdi --dry
//          node --import tsx --env-file=.env scripts/pie-confianza-resena.ts --cuenta=bdi
//
// Los tres mails de carrito cierran con "Despachamos en … · Pago seguro · Te
// contestamos por WhatsApp" y el de reseña no. Se decidió poner **sólo el pie** y
// NO la barra de garantías: a alguien que ya compró no se le vende envío gratis y
// cuotas en el mail que le pide la opinión. El pie es marca, no venta.
//
// 🔴 **El color va en TOKEN (`$tenue`), no en el hex `#6b7280` de los otros tres.**
// Este mail se dibuja sobre el tema de la marca, que en BDI es OSCURO: un gris
// clavado a mano ignora el tema y queda ilegible. Es la misma corrección que ya
// se hizo en el bloque `res-cambios`.
//
// 🔑 El plazo va como `${tienda.plazoDespacho}`, no escrito: ver
// `AGENTS.md` § "Los datos de la tienda en UN lugar".
//
// ⛔ Sólo toca automations PAUSADAS · 🔴 guarda copia antes · 🔑 idempotente por
// id de bloque · escribe con `updateMany` condicional por `docVersion`.
import { writeFileSync } from 'node:fs';
import { prisma } from '../lib/prisma.ts';
import { leerContenido, V_ACTUAL } from '../lib/email/esquema.ts';
import type { Bloque, ContenidoCampania } from '../lib/email/bloques.ts';

const slug = process.argv.find((a) => a.startsWith('--cuenta='))?.split('=')[1] ?? 'bdi';
const dry = process.argv.includes('--dry');
const COPIA = process.env.COPIA_DIR ?? '/tmp';

const PIE: Bloque[] = [
  { id: 'res-d2', tipo: 'divisor' } as Bloque,
  {
    id: 'res-pie',
    tipo: 'texto',
    align: 'center',
    texto: [{ t: 'Despachamos en ${tienda.plazoDespacho}  ·  Pago seguro  ·  Te contestamos por WhatsApp', tamano: 10 }],
    estilo: { cuerpo: { color: '$tenue', tamano: 12 } },
  } as unknown as Bloque,
];

async function main() {
  const cuenta = await prisma.cuenta.findFirst({ where: { slug } });
  if (!cuenta) { console.error(`❌ no existe la cuenta "${slug}"`); process.exit(1); }

  const a = await prisma.automation.findFirst({
    where: { cuentaId: cuenta.id, trigger: 'RESENA' },
    select: { id: true, nombre: true, estado: true, docVersion: true, contenido: true },
  });
  if (!a) { console.error(`❌ ${slug} no tiene automation de reseña`); process.exit(1); }
  if (a.estado !== 'PAUSADO') { console.error(`⛔ ABORTA: "${a.nombre}" está ${a.estado}. Un mail que está saliendo no se edita por script.`); process.exit(1); }

  const doc = leerContenido(a.contenido);
  const bs = [...doc.bloques] as Bloque[];
  if (bs.some((b) => b.id === 'res-pie')) { console.log(`= ${a.nombre}: ya tiene el pie, no se toca`); return; }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const ruta = `${COPIA}/copia-resena-${slug}-${stamp}.json`;
  writeFileSync(ruta, JSON.stringify(a, null, 2));
  console.log(`🗄  copia de respaldo: ${ruta}`);

  bs.push(...PIE);
  console.log(`${dry ? '~' : '+'} ${a.nombre}: divisor + pie de confianza al final (${bs.length} bloques)`);
  if (dry) { console.log('\nSimulación: no se escribió nada.'); return; }

  const contenido: ContenidoCampania = { v: V_ACTUAL, tema: doc.tema, estilos: doc.estilos, bloques: bs } as ContenidoCampania;
  const r = await prisma.automation.updateMany({
    where: { id: a.id, docVersion: a.docVersion },
    data: { contenido: contenido as object, docVersion: { increment: 1 } },
  });
  if (r.count === 0) { console.error('   ⛔ CONFLICTO: alguien lo guardó mientras corría. NO se escribió.'); process.exit(1); }
  console.log(`   ✔ guardado (docVersion ${a.docVersion} → ${a.docVersion + 1}). Sigue PAUSADO.`);
}
main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());
