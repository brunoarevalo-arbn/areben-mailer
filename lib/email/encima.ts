// Dónde cae cada cosa que va ENCIMA de una foto: de `(x, y)` en % a filas y
// celdas de una tabla. Nada de HTML.
//
// 🔴 Existe porque **un mail no puede superponer elementos**: `position:absolute`
// lo borra Gmail y lo ignora Outlook (doctrina vieja del motor, ver el comentario
// de `bandaConFoto` en `render.ts` y `PLANTILLAS.md`). O sea que "arrastrar un
// botón sobre la foto" no se dibuja moviendo una capa: se dibuja **eligiendo en
// qué fila y en qué celda de una tabla cae**, y esa traducción es lo único de
// este bloque que se puede probar sin mirar una sola etiqueta.
//
// ⚠️ Puro: lo importan el SERVIDOR (el renderer) y el CLIENTE (el editor, que
// dibuja la misma grilla para que lo que se agarra sea lo que sale). Sin prisma,
// sin next/headers, sin DOM.

import type { ElementoEncima } from "./bloques";

/**
 * Cuántos elementos entran en una banda.
 *
 * No es un límite técnico: es que cada uno se lleva su fila o su celda, y a
 * partir de ahí el ancho de una celda no alcanza para una palabra. Con 8 en una
 * banda de 600px de ancho, la más angosta queda en ~75px.
 */
export const MAX_ELEMENTOS = 8;

/**
 * Dos elementos "a la misma altura" son **una sola fila**.
 *
 * 🔑 La tolerancia no es prolijidad, es lo que hace que un botón al lado de otro
 * salga al lado y no debajo: arrastrando con el dedo nadie clava dos veces el
 * mismo `y`, y sin esto un 40 y un 42 abrirían dos filas —la primera de 2% de
 * alto— y el texto de la de arriba se metería en la de abajo. El editor snapea a
 * una grilla más gruesa que esto, así que en la práctica el margen es de sobra.
 */
const TOLERANCIA_Y = 4;

/** Menos que esto no es una celda: es una raya. */
export const ANCHO_MIN = 5;

/**
 * De cuánto en cuánto se mueve una ficha al arrastrarla.
 *
 * 🔑 **`PASO_Y` es MAYOR que `TOLERANCIA_Y`, y eso no es casualidad: es lo que
 * hace que la superficie del editor no pueda mentir.** Con un paso más chico que
 * la tolerancia, dos fichas que en la pantalla se ven a alturas distintas caerían
 * en la misma fila del mail —o al revés— y no habría forma de saber cuál de las
 * dos cosas va a salir. Con el paso arriba de la tolerancia, dos elementos
 * comparten fila **si y sólo si** tienen el mismo `y`.
 *
 * El de la horizontal puede ser fino: ahí no hay filas que agrupar, cada
 * elemento se lleva su celda.
 */
export const PASO_X = 1;
export const PASO_Y = 5;

/** Al múltiplo de `paso` más cercano, dentro de 0-100. */
export const snap = (v: number, paso: number): number =>
  Math.min(100, Math.max(0, Math.round(v / paso) * paso));

/**
 * Lo que ocupa una ficha en la superficie: todo en % (el ancho, del ancho de la
 * banda; el alto, de su alto).
 *
 * ⚠️ El `alto` **se mide en la pantalla**, no se calcula: cuánto ocupa un título
 * depende de la letra, de cuántos renglones entren y del ancho de su celda. Es la
 * misma razón por la que el mail necesita un alto de banda escrito — nadie puede
 * predecir el alto de un texto, ni acá ni en Outlook.
 */
export interface CajaEncima {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

/**
 * ¿Estas dos cajas se montan una sobre la otra?
 *
 * 🔴 Es la única pregunta que el editor tiene que contestar antes de soltar, y la
 * contesta acá —en el archivo puro— y no en el componente: **un mail no puede
 * superponer dos cosas**. Si se sueltan montadas, el renderer corre a la segunda
 * (`armarPlano`) y lo que sale no es lo que se vio en la pantalla. O sea que sin
 * este freno la superficie sería una mentira prolija.
 *
 * Se tocan por el borde ⇒ NO se pisan: dos fichas pegadas una al lado de la otra
 * es un diseño normal (un botón junto a otro), y prohibirlo dejaría un hueco
 * obligatorio que nadie pidió.
 */
export const sePisan = (a: CajaEncima, b: CajaEncima): boolean =>
  a.x < b.x + b.ancho && b.x < a.x + a.ancho && a.y < b.y + b.alto && b.y < a.y + a.alto;

/** Una celda de la fila. Sin `el`, es aire: existe para empujar a la de al lado. */
export interface CeldaEncima {
  /** Ancho en % del ancho de la banda. Las celdas de una fila suman 100. */
  pct: number;
  el?: ElementoEncima;
}

export interface FilaEncima {
  /**
   * Alto en px.
   *
   * 🔴 Va en px y no en % porque **Outlook mide filas y no mide texto**: es el
   * mismo motivo por el que la banda entera necesita un `alto`. Sale de repartir
   * ese alto entre las filas según la distancia vertical entre ellas.
   */
  alto: number;
  celdas: CeldaEncima[];
}

export interface PlanoEncima {
  /** El aire que va antes de la primera fila, en px. 0 si algo arranca en `y:0`. */
  arriba: number;
  filas: FilaEncima[];
}

/** Un número de la base a un porcentaje usable. Lo que no es número cae a 0. */
const pct = (v: unknown): number => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
};

/**
 * Los elementos de una banda, ya repartidos en filas y celdas.
 *
 * `arriba` + la suma de los altos de las filas da exactamente `alto`: es lo que
 * hace que la banda mida lo que dice medir, con la foto de fondo entrando entera.
 *
 * 🔑 **Nada se pisa, y no por buena voluntad: el ancho de cada celda se recorta
 * hasta donde arranca la que sigue.** Una tabla no puede dibujar dos cosas en el
 * mismo lugar, así que si el documento trae dos elementos montados —un Json
 * editado a mano, o el editor de una versión futura sin la guarda— lo que sale es
 * uno corrido y no un HTML roto. El editor además lo impide antes de soltar; esto
 * es la red de abajo.
 *
 * ⚠️ Un elemento **sin texto no ocupa lugar**: es como se lo saca sin borrarlo,
 * la misma convención que `botonTexto` vacío en `hero`, `seccion` y `columnas`.
 */
export function armarPlano(elementos: readonly ElementoEncima[], alto: number): PlanoEncima {
  const vivos = elementos
    .filter((el) => !!el && typeof el.texto === "string" && el.texto.trim() !== "")
    .slice(0, MAX_ELEMENTOS)
    .map((el) => ({ ...el, x: pct(el.x), y: pct(el.y) }))
    // Por `y` para armar las filas, y a igual `y` por `x`: el orden de la lista
    // no significa nada (el lugar lo dan las coordenadas), así que el HTML tiene
    // que salir igual sin importar en qué orden se agregaron.
    .sort((a, b) => a.y - b.y || a.x - b.x);

  if (!vivos.length) return { arriba: 0, filas: [] };

  // Las filas: se abre una nueva recién cuando el `y` se despega del de la
  // primera de la fila en curso. Contra la PRIMERA y no contra la anterior, para
  // que una cadena de elementos separados de a 3 puntos no termine siendo una
  // fila de 30 de alto.
  const grupos: (typeof vivos)[] = [];
  for (const el of vivos) {
    const actual = grupos[grupos.length - 1];
    if (actual && el.y - actual[0].y <= TOLERANCIA_Y) actual.push(el);
    else grupos.push([el]);
  }

  const topDe = (g: (typeof vivos)[number][]) => Math.round((alto * g[0].y) / 100);
  const filas: FilaEncima[] = grupos.map((g, i) => {
    const siguiente = grupos[i + 1];
    // La última fila se estira hasta el borde de la banda: así el reparto suma
    // el alto entero y no queda un hueco sin dueño abajo.
    const hasta = siguiente ? topDe(siguiente) : alto;
    return { alto: Math.max(1, hasta - topDe(g)), celdas: celdasDe(g) };
  });

  return { arriba: topDe(grupos[0]), filas };
}

/**
 * Una fila, en celdas que suman 100.
 *
 * El aire va como celda vacía y no como padding: el padding de un `<td>` no lo
 * respeta Outlook igual que el ancho, y acá lo que hay que clavar es **dónde
 * arranca cada cosa**.
 */
function celdasDe(grupo: readonly ElementoEncima[]): CeldaEncima[] {
  const orden = [...grupo].sort((a, b) => a.x - b.x);
  const celdas: CeldaEncima[] = [];
  let cursor = 0;
  for (let i = 0; i < orden.length; i++) {
    const el = orden[i];
    // Ya no queda ancho para una celda de verdad: lo que sigue **no se dibuja**.
    // Es el único caso en que este archivo pierde algo, y es preferible a emitir
    // una fila cuyas celdas suman 130 —que en Outlook desborda la banda entera y
    // se lleva el resto del mail—. Sólo se llega acá con un Json amontonado a
    // mano: el editor no deja soltar dos elementos encima.
    if (cursor > 100 - ANCHO_MIN) break;
    // Nunca antes de donde terminó el anterior: es acá donde "se pisan" se
    // convierte en "se corren". Y el techo es 100 - ANCHO_MIN para que al último
    // le quede algo de celda incluso si alguien lo mandó al borde derecho.
    const x = Math.min(Math.max(el.x, cursor), 100 - ANCHO_MIN);
    if (x > cursor) celdas.push({ pct: x - cursor });
    // Hasta dónde puede crecer: donde empieza el que sigue, o el borde.
    const tope = i + 1 < orden.length ? Math.max(orden[i + 1].x, x + ANCHO_MIN) : 100;
    const libre = Math.max(ANCHO_MIN, Math.min(100, tope) - x);
    const pedido = el.ancho === undefined ? libre : Math.min(Math.max(pct(el.ancho), ANCHO_MIN), libre);
    celdas.push({ pct: pedido, el });
    cursor = x + pedido;
  }
  if (cursor < 100) celdas.push({ pct: 100 - cursor });
  return celdas;
}
