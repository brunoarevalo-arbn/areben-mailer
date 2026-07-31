// Verifica que el panel no vuelva a nacer "solo para escritorio".
//
// El 31-jul-2026 el panel no tenía UNA sola media query propia: ni un
// `hidden md:block`, ni un `flex-col md:flex-row`, ni `matchMedia`, ni un evento
// `touch*`. Volverlo responsive es un trabajo de varias tandas; esto es lo que
// evita que se degrade después, que es lo que le pasó a los permisos la primera
// vez (ver `auditar-permisos.ts`, del que este script copia la forma).
//
// Correr:  node --import tsx scripts/auditar-responsive.ts
// Sale con código 1 si aparece una violación NUEVA (sirve para CI).
//
// ⚠️ PENDIENTES es la deuda que ya existía cuando se escribió el auditor. Se
// imprime como aviso y NO hace fallar: si fallara desde el día uno, el script
// nacería en rojo y nadie lo correría. Cada tanda del plan responsive vacía un
// pedazo, y el contador de pendientes es el progreso. Cuando quede en cero, se
// borra la lista y el auditor pasa a ser puramente preventivo.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ⛔ Solo el PANEL. `lib/email/` queda afuera a propósito: el HTML de un mail
// ES una tabla anidada —es la única forma de que Outlook lo dibuje— y ese HTML
// ya tiene su propio corte responsive, hecho contra el ancho del mail y no
// contra el de la pantalla. Auditarlo con estas reglas es comparar dos cosas
// que no se parecen.
const DIRS = ['app', 'components'];

/** Del resto de `lib/` solo importa el archivo de clases compartidas. */
const SUELTOS = ['lib/ui.ts'];

/** 375px de pantalla menos los 32 de padding lateral del layout en celular. */
const ANCHO_MAXIMO = 343;

/**
 * Las dos utilidades de letra que quedan abajo de los 16px que pide iOS.
 *
 * `text-xs` entró el 31-jul-2026: la regla miraba solo `text-sm` y se le pasaba
 * el textarea del código para embeber de `FormularioEditor`, que estaba en 12px
 * —o sea, peor—. Lo que se exige es un `text-base` al lado; el `lg:` que lo
 * devuelve al tamaño de escritorio es libre.
 *
 * ⚠️ Lo que NO ve: un campo sin ninguna clase de tamaño. Ahí manda el default
 * del navegador (13,33px en un `<select>` de Chrome) y también zoomearía, pero
 * exigirlo marcaría los checkbox, los `type="color"` y los `type="range"`, que
 * no abren teclado y no zoomean nunca.
 */
const CHICO = /\btext-(?:sm|xs)\b/;

/** El string de campo de `lib/ui.ts`. Tiene que existir en un solo lugar. */
const CAMPO_LIB = 'rounded-lg border border-border-strong bg-background';

/** Los tres componentes de campo compartidos son la OTRA familia de estilo. */
const CAMPOS_UI = [
  'components/ui/Input.tsx',
  'components/ui/Select.tsx',
  'components/ui/Textarea.tsx',
];

interface Hallazgo {
  regla: number;
  archivo: string;
  linea: number;
  detalle: string;
}

/**
 * Deuda conocida al 31-jul-2026, por `regla:archivo`. Se lleva por archivo y no
 * por línea a propósito: las líneas se mueven con cualquier edición y una lista
 * que se rompe sola es una lista que se termina borrando entera.
 */
const PENDIENTES = new Set<string>([
  // ── Tanda 2a — ✅ VACIADA: PageHeader ya apila abajo de `sm`.
  // ── Tanda 2b — ✅ VACIADA: las dos familias de campo y los cuatro inline
  //    están en 16px, y el `py-1.5` copiado de ControlEstilo salió a
  //    `campoCompacto`. Las reglas 2 y 3 quedaron sin deuda: de acá en más
  //    cualquier hallazgo suyo es NUEVO y hace fallar el script.
  // ── Tanda 3 — las dos tablas pasan a TablaResponsive
  '4:app/(app)/page.tsx',
  '4:app/(app)/contactos/page.tsx',
  // ── Tanda 4 — el editor: lo que hoy solo existe con el mouse encima,
  //    y la miniatura de plantillas con su escala clavada.
  '6:components/editor/ImagenPicker.tsx',
  '6:components/editor/ListaBloques.tsx',
  '1:app/(app)/plantillas/page.tsx',
]);

const REGLAS: Record<number, string> = {
  1: 'ancho fijo mayor al de un celular',
  2: 'campo con letra menor a 16px (iOS zoomea al enfocar)',
  3: 'el string de campo de lib/ui.ts, copiado',
  4: '<table> fuera de TablaResponsive',
  5: 'PageHeader sin apilar',
  6: 'acción que solo existe con el mouse encima',
};

function archivos(dir: string, salida: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    if (entrada === 'node_modules' || entrada.startsWith('.')) continue;
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) archivos(ruta, salida);
    else if (/\.tsx?$/.test(entrada)) salida.push(ruta);
  }
  return salida;
}

const lineaDe = (src: string, i: number) => src.slice(0, i).split('\n').length;

const hallazgos: Hallazgo[] = [];
const push = (regla: number, archivo: string, linea: number, detalle: string) =>
  hallazgos.push({ regla, archivo, linea, detalle });

for (const archivo of [...DIRS.flatMap((d) => archivos(d)), ...SUELTOS]) {
  const src = readFileSync(archivo, 'utf8');

  // Las constantes de `lib/ui.ts` no son un <input>: son los strings de los que
  // salen ~20. Se miran aparte o la regla 2 no las vería nunca.
  //
  // ⚠️ Se recorren TODAS y no solo `campoBase`: el 31-jul-2026 el string se
  // partió en un tronco (`campoSinAlto`) más dos variantes de alto, y un regex
  // anclado en el nombre `campoBase` habría dejado de encontrar nada y cantado
  // victoria en silencio. Comillas y backticks porque las variantes son
  // template literals.
  if (archivo === 'lib/ui.ts') {
    for (const m of src.matchAll(/const \w+ =\s*\n?\s*[`"]([^`"]*)[`"]/g)) {
      if (CHICO.test(m[1]) && !/\btext-base\b/.test(m[1])) {
        push(2, archivo, lineaDe(src, m.index!), 'constante de campo en letra chica');
      }
    }
  }

  // ── 1. Anchos fijos que no entran en un celular ────────────────────────────
  for (const m of src.matchAll(/\b(?:min-)?w-\[(\d+)px\]/g)) {
    const px = Number(m[1]);
    if (px > ANCHO_MAXIMO) push(1, archivo, lineaDe(src, m.index!), `${m[0]} (>${ANCHO_MAXIMO}px)`);
  }

  // ── 2. Campos por debajo de 16px ───────────────────────────────────────────
  // Los tres componentes compartidos se miran por su `baseClasses`; el resto,
  // por lo que cada <input>/<select>/<textarea> tiene a mano. La ventana de 400
  // caracteres después de la etiqueta alcanza para el className y evita tener
  // que parsear JSX (los `=>` de los onChange rompen cualquier regex de tag).
  if (CAMPOS_UI.includes(archivo)) {
    for (const m of src.matchAll(/const baseClasses = '([^']*)'/g)) {
      if (CHICO.test(m[1]) && !/\btext-base\b/.test(m[1])) {
        push(2, archivo, lineaDe(src, m.index!), 'baseClasses en letra chica');
      }
    }
  }
  for (const m of src.matchAll(/<(input|select|textarea)\b/g)) {
    const ventana = src.slice(m.index!, m.index! + 400);
    const cn = ventana.match(/className=(?:\{([^}]*(?:\}[^}]*)?)\}|"([^"]*)")/);
    if (!cn) continue;
    const expr = cn[1] ?? cn[2] ?? '';
    const heredaDeLib = /\b(campoBase|inputClass|campoCompacto)\b/.test(expr);
    const declaraOk = /\btext-base\b/.test(expr);
    const declaraChico = CHICO.test(expr);
    if (!heredaDeLib && !declaraOk && declaraChico) {
      push(2, archivo, lineaDe(src, m.index!), `<${m[1]}> en letra chica`);
    }
  }

  // ── 3. El string de campo de lib/ui.ts, copiado ────────────────────────────
  if (archivo !== 'lib/ui.ts') {
    for (const m of src.matchAll(new RegExp(CAMPO_LIB, 'g'))) {
      push(3, archivo, lineaDe(src, m.index!), 'usá campoBase de @/lib/ui');
    }
  }

  // ── 4. Tablas ──────────────────────────────────────────────────────────────
  if (archivo !== 'components/ui/TablaResponsive.tsx') {
    for (const m of src.matchAll(/<table\b/g)) {
      push(4, archivo, lineaDe(src, m.index!), 'esconde columnas sin avisar');
    }
  }

  // ── 5. El encabezado compartido tiene que apilar ───────────────────────────
  if (archivo === 'components/ui/PageHeader.tsx' && !/\bflex-col\b/.test(src)) {
    push(5, archivo, 1, 'el título y las acciones pelean por la misma línea');
  }

  // ── 6. Acciones que solo existen con el mouse encima ───────────────────────
  // `opacity-0` + `group-hover:opacity-*` sobre algo que se toca es una acción
  // que en un celular NO EXISTE. Vale si tiene un camino táctil al lado.
  //
  // Se ancla en el `opacity-0` y se miran 200 caracteres a cada lado, en crudo.
  // Dos decisiones, las dos por un falso resultado real:
  //  · No se lee el string entrecomillado, porque las dos clases casi nunca
  //    están en el mismo literal: viven a los costados de un `${sel ? … : …}`
  //    o adentro de un `[…].join(' ')`, y un regex que corta en la primera
  //    comilla ve la mitad y no encuentra nada.
  //  · No se ancla en `className=`, porque la ventana de uno se pisa con la del
  //    de al lado y el mismo botón salía marcado tres veces. Anclado acá, cada
  //    `opacity-0` es exactamente un hallazgo.
  for (const m of src.matchAll(/\bopacity-0\b/g)) {
    const c = src.slice(Math.max(0, m.index! - 200), m.index! + 200);
    if (!/group-hover:opacity-/.test(c)) continue;
    if (/max-lg:opacity-(?:100|60)/.test(c)) continue;
    push(6, archivo, lineaDe(src, m.index!), 'sin camino táctil');
  }
}

const clave = (h: Hallazgo) => `${h.regla}:${h.archivo}`;
const nuevos = hallazgos.filter((h) => !PENDIENTES.has(clave(h)));
const viejos = hallazgos.filter((h) => PENDIENTES.has(clave(h)));

if (viejos.length) {
  const porRegla = new Map<number, number>();
  for (const h of viejos) porRegla.set(h.regla, (porRegla.get(h.regla) ?? 0) + 1);
  console.log(`\n⏳ Deuda conocida — ${viejos.length} caso(s) en ${new Set(viejos.map(clave)).size} archivo(s):`);
  for (const [regla, n] of [...porRegla].sort((a, b) => a[0] - b[0])) {
    console.log(`   regla ${regla} · ${REGLAS[regla]} → ${n}`);
  }
}

// Un pendiente que ya no aparece es una tanda terminada: hay que sacarlo de la
// lista o el auditor deja de proteger ese archivo en silencio.
const resueltos = [...PENDIENTES].filter((k) => !hallazgos.some((h) => clave(h) === k));
if (resueltos.length) {
  console.log(`\n🧹 ${resueltos.length} pendiente(s) ya resuelto(s) — sacalos de PENDIENTES:`);
  for (const k of resueltos) console.log(`   ${k}`);
}

if (nuevos.length) {
  console.table(
    nuevos.map((h) => ({ regla: h.regla, qué: REGLAS[h.regla], archivo: `${h.archivo}:${h.linea}`, detalle: h.detalle })),
  );
  console.error(`\n❌ ${nuevos.length} violación(es) NUEVA(s) de responsive.\n`);
  process.exit(1);
}

console.log(`\n✅ Sin violaciones nuevas (${hallazgos.length} caso(s) conocido(s) pendientes).\n`);
