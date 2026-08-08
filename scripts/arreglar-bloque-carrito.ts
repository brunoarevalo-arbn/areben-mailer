/**
 * Le pone el bloque `carrito` a las automations de carrito abandonado que no lo
 * tienen, en el lugar donde va.
 *
 * EL PROBLEMA: las automations de BDI y Stunned se crearon **antes** de que el
 * bloque `carrito` existiera, así que su estructura es `titulo → texto → boton`.
 * El procesador, cuando no encuentra el bloque, appendea los productos **al
 * final** — o sea, después del botón. El mail sale así:
 *
 *     Todavía estás a tiempo, Mora
 *     Dejaste esto en tu carrito. Completá tu compra…   ← anuncia algo
 *     [ Completar mi compra ]                            ← el CTA
 *     (recién acá los productos)                         ← lo que anunciaba
 *
 * "Dejaste esto" seguido de nada, y lo que dejaste abajo del botón. Es
 * exactamente el caso que el preset nuevo evita declarando el bloque, y por eso
 * Zattia —creada hoy— sí lo tiene.
 *
 * Ninguna de las tres mandó nunca un carrito real (0 runs), así que esto no
 * cambia ningún mail que alguien haya recibido.
 *
 *   node --env-file=.env --import tsx scripts/arreglar-bloque-carrito.ts
 *   node --env-file=.env --import tsx scripts/arreglar-bloque-carrito.ts --aplicar
 *
 * ⚠️ Escribe `Automation.contenido`, que es el documento ENTERO. Se lee, se
 * inserta un bloque y se vuelve a escribir el mismo documento — no se reconstruye
 * desde un preset, que pisaría el texto que alguien haya editado.
 */
import { prisma } from '../lib/prisma.ts';
import { leerContenido } from '../lib/email/esquema.ts';
import { nuevoBloque, type Bloque } from '../lib/email/bloques.ts';

const aplicar = process.argv.includes('--aplicar');

/**
 * Dónde va el carrito: **justo antes del primer botón**.
 *
 * El botón es el CTA y cierra el mail; los productos son lo que lo justifica, y
 * van entre el texto que los anuncia y el llamado a la acción. Si no hay botón,
 * al final es lo correcto: no hay nada que quede huérfano abajo.
 */
function insertarCarrito(bloques: Bloque[]): Bloque[] {
  const carrito = { ...nuevoBloque('carrito'), items: [] } as Bloque;
  const i = bloques.findIndex((b) => b.tipo === 'boton');
  if (i === -1) return [...bloques, carrito];
  return [...bloques.slice(0, i), carrito, ...bloques.slice(i)];
}

async function main() {
  const autos = await prisma.automation.findMany({
    where: { trigger: 'CARRITO_ABANDONADO' },
    include: { cuenta: { select: { slug: true } } },
    orderBy: { id: 'asc' },
  });

  let tocadas = 0;
  for (const a of autos) {
    const contenido = leerContenido(a.contenido);
    const bloques = contenido?.bloques ?? [];
    const antes = bloques.map((b) => b.tipo).join(' → ');

    if (bloques.some((b) => b.tipo === 'carrito')) {
      console.log(`= ${a.cuenta.slug.padEnd(9)} ya lo tiene · ${antes}`);
      continue;
    }

    const nuevos = insertarCarrito(bloques);
    console.log(`${aplicar ? '+' : '~'} ${a.cuenta.slug.padEnd(9)} ${antes}`);
    console.log(`  ${' '.repeat(10)}→ ${nuevos.map((b) => b.tipo).join(' → ')}`);
    tocadas++;

    if (!aplicar) continue;

    // El documento ENTERO, con los bloques cambiados. Enumerar campos a mano es
    // lo que hace que cada campo nuevo se pierda solo en el envío (AGENTS.md,
    // regla 6).
    await prisma.automation.update({
      where: { id: a.id },
      data: { contenido: { ...contenido, bloques: nuevos } as never },
    });
  }

  if (!aplicar && tocadas) console.log(`\nDry-run: ${tocadas} para tocar. Volvé a correr con --aplicar.`);
  else if (aplicar) console.log(`\n✅ ${tocadas} automations arregladas.`);
  else console.log('\nNada que hacer: todas tienen su bloque.');
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
