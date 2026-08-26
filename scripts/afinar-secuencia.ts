// La pasada fina sobre los cuatro mails de disparador de BDI, después de
// LEERLOS renderizados (`ensayo-secuencia.ts`).
//
// Correr:  node --env-file=.env --import tsx scripts/afinar-secuencia.ts --cuenta=bdi --dry
//          node --env-file=.env --import tsx scripts/afinar-secuencia.ts --cuenta=bdi
//
// Mismas guardas que `completar-secuencia-carrito.ts`, que es de donde sale el
// molde: 🔴 sólo automations PAUSADAS · 🔴 copia del JSON antes de escribir (no
// hay historial) · 🔑 `updateMany` condicional por `docVersion`, igual que el
// editor · 🔑 idempotente: cada arreglo pregunta por el estado ROTO, así que
// correrlo dos veces no hace nada la segunda.
import { writeFileSync } from 'node:fs';
import { prisma } from '../lib/prisma.ts';
import { leerContenido, V_ACTUAL } from '../lib/email/esquema.ts';
import type { Bloque, ContenidoCampania } from '../lib/email/bloques.ts';

const slug = process.argv.find((a) => a.startsWith('--cuenta='))?.split('=')[1] ?? 'bdi';
const dry = process.argv.includes('--dry');
const COPIA = process.env.COPIA_DIR ?? '/tmp';

/**
 * Los `alt` de las cuatro fotos, escritos MIRÁNDOLAS.
 *
 * 🔴 **Tres de las cuatro llevan el mensaje adentro del PNG**, y con las
 * imágenes apagadas —el default de Outlook— ese mensaje no existe. El `alt` es
 * lo único que sobrevive, así que acá no describe la foto: **dice lo que la foto
 * dice**. Una que sólo muestra producto sí se describe.
 *
 * ⚠️ Un `alt` inventado es peor que ninguno: estos salieron de abrir los cuatro
 * archivos, no de adivinar por el nombre.
 */
const ALT: Record<string, string> = {
  // Tres fotos de gente en la calle con fundas BDI. No dice texto: se describe.
  '5b9deec7': 'Fundas BDI, en la calle',
  // 🔴 Un argumento de venta entero adentro de una imagen.
  'c1e91e8c': '¿Por qué elegirnos? Moda en fundas · Variedad · Diseño · Protección asegurada',
  // 🔴 La dirección y los horarios del local, también adentro de la imagen.
  'a5eef9a7': 'Y si estás en Rosario, venite: estamos en Santa Fe 1671. Lunes a viernes de 10 a 19 h, sábados de 10 a 13 h',
  // 🔴 Lleva el logo BDI dibujado adentro, que es por lo que este mail nunca
  // tuvo bloque `encabezado`.
  'dc2ff9fd': 'BDI — Queremos tu feedback',
};

/** Recorre todo trozo de texto rico y todo string de texto de un bloque. */
function porCadaTexto(b: any, f: (t: string) => string): boolean {
  let toco = false;
  const tratar = (campo: 'texto' | 'titulo' | 'subtitulo') => {
    const v = b[campo];
    if (typeof v === 'string') {
      const n = f(v);
      if (n !== v) { b[campo] = n; toco = true; }
    } else if (Array.isArray(v)) {
      for (const tr of v) {
        if (typeof tr?.t !== 'string') continue;
        const n = f(tr.t);
        if (n !== tr.t) { tr.t = n; toco = true; }
      }
    }
  };
  tratar('texto'); tratar('titulo'); tratar('subtitulo');
  return toco;
}

/**
 * Los arreglos de texto, uno por línea, con su porqué.
 *
 * 🔴 **`𝗟𝗔𝗦𝗧 𝗖𝗔𝗟𝗟` no son letras**: son Mathematical Sans-Serif Bold
 * (U+1D5DF…), el truco de "negrita" que se copia de Instagram. Un filtro de spam
 * lo lee como ofuscación —es lo que usa quien esconde palabras— y un lector de
 * pantalla lo deletrea o lo saltea. Va en mayúsculas de verdad; el peso lo pone
 * el estilo del bloque, que para eso está.
 */
const TEXTOS: [RegExp, string, string][] = [
  [/𝗟𝗔𝗦𝗧 𝗖𝗔𝗟𝗟/g, 'LAST CALL', 'LAST CALL deja de estar escrito con caracteres Unicode matemáticos'],
  [/Último llamado para recuperar tu carrito\. ¿Todavía lo queres\? Está acá abajo — Sino podes /g,
   '¿Todavía lo querés? Está acá abajo. Si no, ',
   'el 3º: se sacan los tildes que faltaban (querés, podés), «Sino» → «Si no», y no repite el título'],
  [/ y te damos una mano/g, ' y te damos una mano', 'sin cambio'],
  [/¿NO TE CONVENCE\? PODES CAMBIARLO/g, '¿NO TE CONVENCE? PODÉS CAMBIARLO', 'PODÉS con tilde'],
  [/^Algo te da duda\? $/g, '¿Algo te da duda? ', 'el 1º: la pregunta abre con ¿'],
  [/\$\{contacto\.nombre\}/g, '${contacto.primerNombre}',
   'el saludo usa el PRIMER nombre: 16.660 de 16.842 contactos de BDI tienen nombre y apellido'],
  [/Hola \$\{contacto\.primerNombre\}, ¿Nos contás/g, 'Hola ${contacto.primerNombre}, ¿nos contás',
   'la reseña: minúscula después de la coma'],
];

async function main() {
  const cuenta = await prisma.cuenta.findFirst({ where: { slug } });
  if (!cuenta) throw new Error(`no existe la cuenta ${slug}`);

  const autos = await prisma.automation.findMany({
    where: { cuentaId: cuenta.id, trigger: { in: ['CARRITO_ABANDONADO', 'RESENA'] } },
    orderBy: { createdAt: 'asc' },
  });

  const activas = autos.filter((a) => a.estado === 'ACTIVO');
  if (activas.length) throw new Error(`hay automations ACTIVAS (${activas.map((a) => a.nombre).join(', ')}): no se editan por script`);

  // El encabezado que ya usan los tres carritos, para dárselo a la reseña.
  const cab = leerContenido(autos.find((a) => a.trigger === 'CARRITO_ABANDONADO')?.contenido as never)
    ?.bloques.find((b) => b.tipo === 'encabezado');

  for (const a of autos) {
    const doc = leerContenido(a.contenido as never);
    if (!doc) { console.log(`· ${a.nombre}: sin contenido`); continue; }
    const bs = structuredClone(doc.bloques) as any[];
    const cambios: string[] = [];

    // 1 · Los `alt` que faltan.
    for (const b of bs) {
      if (b.tipo === 'imagen' && ALT[b.id] && !b.alt) {
        b.alt = ALT[b.id];
        cambios.push(`alt de la imagen ${b.id}: «${b.alt.slice(0, 60)}${b.alt.length > 60 ? '…' : ''}»`);
      }
    }

    // 2 · Los textos.
    for (const b of bs) {
      for (const [re, por, porque] of TEXTOS) {
        const antes = JSON.stringify(b);
        porCadaTexto(b, (t) => t.replace(re, por));
        if (JSON.stringify(b) !== antes && porque !== 'sin cambio' && !cambios.includes(porque)) cambios.push(porque);
      }
    }

    // 3 · El bloque `imagen` VACÍO del 3º: no dibuja nada y ocupa lugar en el
    //     editor. Se saca sólo si está vacío de verdad (url e imagen sin nada).
    const vacias = bs.filter((b) => b.tipo === 'imagen' && !b.url && !b.urlOriginal);
    if (vacias.length) {
      for (const v of vacias) bs.splice(bs.indexOf(v), 1);
      cambios.push(`se saca ${vacias.length} bloque de imagen VACÍO (no dibujaba nada)`);
    }

    // 4 · La reseña no tiene encabezado: con las imágenes apagadas ese mail
    //     llega sin decir de quién es. El `alt` del logo es el nombre de la
    //     cuenta, así que es lo único que sobrevive apagado.
    if (a.trigger === 'RESENA' && cab && !bs.some((b) => b.tipo === 'encabezado')) {
      bs.unshift(structuredClone(cab));
      cambios.push('bloque `encabezado` al principio (el mail no decía de quién era con las imágenes apagadas)');
    }

    if (!cambios.length) { console.log(`= ${a.nombre}: nada para hacer`); continue; }
    console.log(`\n${dry ? '~' : '+'} ${a.nombre}  (${bs.length} bloques)`);
    for (const c of cambios) console.log(`     · ${c}`);
    if (dry) continue;

    const archivo = `${COPIA}/afinar-${a.id}-${a.docVersion}.json`;
    writeFileSync(archivo, JSON.stringify(a.contenido, null, 1));
    const contenido: ContenidoCampania = { ...doc, v: V_ACTUAL, bloques: bs as Bloque[] };
    const r = await prisma.automation.updateMany({
      where: { id: a.id, docVersion: a.docVersion },
      data: { contenido: contenido as object, docVersion: { increment: 1 } },
    });
    if (r.count === 0) { console.error(`   ⛔ CONFLICTO: alguien lo guardó mientras corría. NO se escribió.`); continue; }
    console.log(`   ✔ guardado (docVersion ${a.docVersion} → ${a.docVersion + 1})  copia: ${archivo}`);
  }
  console.log(`\n${dry ? 'Simulación: no se escribió nada.' : 'Listo. Siguen PAUSADOS.'}`);
}
main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());
