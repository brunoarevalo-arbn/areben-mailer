// La geometría de una foto CORTADA EN PEDAZOS, cada uno con su link. Nada de HTML.
//
// 🔴 Existe porque **un mail no puede tener zonas clickeables sobre una imagen**:
// `<map>`/`<area>` lo borra Gmail y es la primera respuesta que da cualquiera. La
// única forma que sí llega a la casilla es que cada zona sea **su propia imagen**
// adentro de una celda de tabla — o sea que "poner un link en esta parte de la
// foto" se traduce a "cortar la foto en una grilla".
//
// Y una tabla es una grilla, no un plano: los cortes van en **bandas y columnas**,
// nunca en rectángulos sueltos. Es exactamente lo que pide el caso real (dos
// productos uno al lado del otro, cada uno a su categoría), y es lo único que
// Outlook dibuja sin desarmarse.
//
// 🔑 **La invariante de todo este archivo es que los pedazos EMBALDOSAN.** Sin
// hueco y sin superposición, tanto sobre la foto original —o se pierde una franja
// de la imagen, o se dibuja dos veces— como sobre el ancho del mail: si los
// anchos de una fila suman 601 en un mail de 600, Outlook desborda la tabla y se
// lleva el resto del correo. Por eso todo reparto se hace con **bordes
// acumulados** y no redondeando cada pedazo por su cuenta: el borde de uno es el
// arranque del que sigue, y el último cae exactamente en el total.
//
// ⚠️ Puro: lo importan el SERVIDOR (el renderer) y el CLIENTE (el editor, que
// dibuja los mismos cortes y le pide al canvas los mismos rectángulos). Sin
// prisma, sin next/headers, sin DOM.

import type { CeldaMosaico, FilaMosaico } from "./bloques";

/**
 * Cuántas bandas y cuántas columnas por banda.
 *
 * No son límites técnicos: **cada pedazo es un archivo que se sube, que no se
 * borra nunca más y que se descarga UNA VEZ POR DESTINATARIO.** Doce pedazos en
 * un envío a 16.800 contactos son 200.000 pedidos de imagen. El tope no está para
 * que la grilla no se rompa, está para que la factura no se dispare.
 */
export const MAX_FILAS = 6;
export const MAX_CELDAS = 4;

/**
 * El tope de pedazos de una pieza, contando toda la grilla.
 *
 * Lo hace cumplir el EDITOR (no deja agregar el corte 13), no `normalizar`: un
 * Json que ya trae 24 pedazos tiene 24 imágenes, que es caro pero no está roto, y
 * tirar la mitad sería perder pedazos de un mail sin decirlo.
 */
export const MAX_PEDAZOS = 12;

/**
 * Con qué nombre se sube un pedazo, para que la biblioteca no se inunde.
 *
 * 🔴 **Un mosaico de 12 pedazos son 12 archivos nuevos**, y el listado de
 * `/api/imagenes` corta en 200 por cuenta: tres piezas grandes y la biblioteca no
 * muestra una sola foto de las que el comerciante subió a mano. Así que los
 * pedazos se marcan en el `nombre` y el listado los filtra **en el WHERE**, no en
 * la pantalla — filtrar después dejaría igual los 200 slots consumidos.
 *
 * ⚠️ El contador de bytes SÍ los cuenta: se pagan igual, y un número que esconde
 * lo que se factura es peor que un listado largo.
 *
 * ⛔ El costo, dicho: un pedazo no se puede borrar desde la app, como las fotos de
 * `stock/`. Da igual — su URL puede estar en un mail ya entregado, así que ninguna
 * imagen de este motor se borra.
 */
export const PREFIJO_PEDAZO = "pedazo--";

/** Menos que esto no es un pedazo: es una raya, y el link no se puede tocar. */
export const MIN_PCT = 5;

/** De cuánto en cuánto se mueve un corte al arrastrarlo. */
export const PASO = 1;

/** La foto entera, sin cortar: una banda de una sola columna. */
export const GRILLA_ENTERA: FilaMosaico[] = [{ alto: 100, celdas: [{ ancho: 100 }] }];

/** Un número de la base a un porcentaje usable. Lo que no es número cae al mínimo. */
const pct = (v: unknown): number => {
  const n = Number(v);
  if (!Number.isFinite(n)) return MIN_PCT;
  return Math.min(100, Math.max(MIN_PCT, Math.round(n)));
};

/**
 * Reparte un total entre varias partes, en enteros que **suman exactamente el
 * total**.
 *
 * 🔴 Es el corazón del archivo y la razón de que no se redondee parte por parte:
 * tres columnas de 33,33% de 536 px redondeadas cada una dan 179+179+179 = 537, y
 * ese píxel de más en Outlook desborda la tabla. Acumulando el borde, la tercera
 * mide lo que sobra —178— y la fila cierra clavada.
 *
 * ⚠️ Los porcentajes se normalizan contra su propia suma, así que no hace falta
 * que den 100: un documento editado a mano con 90 o con 110 sale igual de repartido.
 */
export function repartir(partes: readonly number[], total: number): number[] {
  if (!partes.length) return [];
  const suma = partes.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0) || 1;
  const out: number[] = [];
  let acum = 0;
  let borde = 0;
  for (let i = 0; i < partes.length; i++) {
    acum += Number.isFinite(partes[i]) ? partes[i] : 0;
    // El último cae en `total` por definición, sin depender de que la suma de los
    // porcentajes haya dado exactamente 100.
    const hasta = i === partes.length - 1 ? total : Math.round((total * acum) / suma);
    out.push(hasta - borde);
    borde = hasta;
  }
  return out;
}

/**
 * La grilla de la base, acotada a algo que se pueda dibujar.
 *
 * ⚠️ **No es la red del editor**: el editor ya no deja hacer una banda de 2% ni
 * una columna trece. Esto es lo que hace que un Json editado a mano —o escrito
 * por una versión futura— no emita una fila cuyas celdas suman 130. La misma
 * doctrina que `armarPlano` en `encima.ts`: el renderer es el último lugar por el
 * que pasa todo, y `esActual()` deja pasar lo ya guardado sin re-sanear.
 *
 * Los porcentajes salen **acotados primero y escalados después**: al revés, una
 * celda de 0,1% se llevaría el mínimo del reparto y correría a todas las demás.
 */
export function normalizar(filas: readonly FilaMosaico[] | undefined): FilaMosaico[] {
  const vivas = (filas ?? [])
    .filter((f): f is FilaMosaico => !!f && Array.isArray(f.celdas) && f.celdas.length > 0)
    .slice(0, MAX_FILAS)
    .map((f) => ({
      alto: pct(f.alto),
      celdas: f.celdas
        .filter((c): c is CeldaMosaico => !!c && typeof c === "object")
        .slice(0, MAX_CELDAS)
        .map((c) => ({ ...c, ancho: pct(c.ancho) })),
    }))
    .filter((f) => f.celdas.length > 0);

  if (!vivas.length) return GRILLA_ENTERA.map((f) => ({ ...f, celdas: f.celdas.map((c) => ({ ...c })) }));

  const altos = repartir(vivas.map((f) => f.alto), 100);
  return vivas.map((f, i) => ({
    alto: altos[i],
    celdas: repartir(f.celdas.map((c) => c.ancho), 100).map((ancho, j) => ({ ...f.celdas[j], ancho })),
  }));
}

/** Cuántos pedazos tiene esta grilla. */
export const cuantosPedazos = (filas: readonly FilaMosaico[]): number =>
  filas.reduce((n, f) => n + f.celdas.length, 0);

/** Un solo pedazo: la foto sin cortar. */
export const sinCortar = (filas: readonly FilaMosaico[]): boolean => cuantosPedazos(filas) <= 1;

/**
 * ¿Están TODOS los pedazos recortados y subidos?
 *
 * 🔑 Es la pregunta que decide qué dibuja el mail, y por eso es "todos" y no
 * "alguno": una grilla a medio cortar saldría con dos pedazos y cuatro huecos, en
 * la casilla de otra persona. Mientras falte uno, sale **la foto entera** —que es
 * lo que había antes de cortar y nunca se ve roto—. Ver el `case "mosaico"` del
 * renderer.
 */
export const estaCortado = (filas: readonly FilaMosaico[]): boolean =>
  filas.length > 0 && filas.every((f) => f.celdas.every((c) => !!c.url));

/** Cuántos pedazos linkean a algún lado: es lo que el ensayo cuenta contra el HTML. */
export const conLink = (filas: readonly FilaMosaico[]): number =>
  filas.reduce((n, f) => n + f.celdas.filter((c) => !!c.enlace?.trim()).length, 0);

/** Los pedazos que van a salir mudos si el cliente de mail bloquea las imágenes. */
export const sinAlt = (filas: readonly FilaMosaico[]): number =>
  filas.reduce((n, f) => n + f.celdas.filter((c) => !c.alt?.trim()).length, 0);

// ─────────────────────────────────────────────────────────────────────────────
// El plano que dibuja el mail
// ─────────────────────────────────────────────────────────────────────────────

export interface CeldaPlano {
  /** Ancho en px. Los de una fila suman EXACTAMENTE el ancho útil. */
  ancho: number;
  /**
   * El mismo ancho en PORCENTAJE de la tabla, y los de una fila suman
   * exactamente 100.
   *
   * 🔴 **No es una duplicación: son dos lectores distintos.** Word/Outlook usa el
   * `width` en píxeles del atributo —ahí el reparto exacto es lo único que impide
   * que la fila desborde la tabla— y cualquier navegador usa el porcentaje del
   * CSS, que es lo que hace que el mosaico se pueda achicar. Con píxeles también
   * en el `style`, en un teléfono de 375px la tabla salía de 634 y se llevaba el
   * mail entero al scroll horizontal.
   *
   * Sale de `repartir` sobre una escala de 10.000 (centésimas de punto) por el
   * mismo motivo que los píxeles: tres tercios redondeados por separado dan
   * 100,01% y eso vuelve a desbordar.
   */
  pct: number;
  celda: CeldaMosaico;
}

export interface FilaPlano {
  /**
   * Alto en px, **el mismo para todas las celdas de la fila**.
   *
   * 🔴 Va declarado **en el atributo `height` del `<img>`** y no se deja en
   * `auto` ahí: si cada pedazo calcula su alto de su propia relación de aspecto,
   * los redondeos difieren en un píxel entre celdas vecinas y aparece el escalón
   * —una rayita blanca horizontal— justo en el lugar donde la foto tenía que
   * verse continua. Ese escalón es de **Word**, que redondea a píxeles enteros y
   * lee el atributo.
   *
   * ⚠️ En el CSS, en cambio, el alto va `auto` (18-ago-2026): clavarlo también
   * ahí dejaba la foto estirada en cuanto la tabla se achicaba en un teléfono. Y
   * no reabre el escalón, porque los pedazos de una banda se cortaron todos al
   * mismo alto: `alto_natural / ancho_natural` escala igual para todos, así que
   * el alto calculado sale el mismo — y un navegador, además, hace subpíxeles.
   *
   * `0` = no se sabe (la foto todavía no se midió) y entonces no se declara nada.
   */
  alto: number;
  celdas: CeldaPlano[];
}

export interface PlanoMosaico {
  /** El ancho útil, en px. Es también lo que mide la tabla. */
  ancho: number;
  filas: FilaPlano[];
}

/**
 * La grilla, ya en píxeles del mail.
 *
 * `ratio` es alto/ancho de la foto ORIGINAL, que es lo único que permite saber
 * cuánto mide cada banda una vez que la foto se estira al ancho del mail.
 * Ausente o 0 ⇒ las filas salen sin alto declarado: se puede, pero es el caso en
 * el que reaparece el escalón entre pedazos vecinos.
 */
export function armarMosaico(
  filas: readonly FilaMosaico[] | undefined,
  anchoUtil: number,
  ratio?: number,
): PlanoMosaico {
  const g = normalizar(filas);
  const total = ratio && ratio > 0 ? Math.max(1, Math.round(anchoUtil * ratio)) : 0;
  const altos = total ? repartir(g.map((f) => f.alto), total) : g.map(() => 0);
  return {
    ancho: anchoUtil,
    filas: g.map((f, i) => ({
      alto: altos[i],
      celdas: (() => {
        const partes = f.celdas.map((c) => c.ancho);
        const px = repartir(partes, anchoUtil);
        // 🔑 **El porcentaje sale de los PÍXELES ya repartidos, no del reparto
        // otra vez.** Son los dos lados de la misma celda —el atributo que lee
        // Word y el CSS que lee un navegador— y tienen que describir el mismo
        // corte: recalcularlos por separado los deja diferentes por redondeo, y
        // esa diferencia se convierte en una diferencia de ALTO entre pedazos
        // vecinos, que es la costura que este bloque existe para no tener. Como
        // los píxeles suman el ancho exacto, los porcentajes suman 100 exacto.
        return px.map((ancho, j) => ({
          ancho,
          pct: Math.round((ancho / anchoUtil) * 1_000_000) / 10_000,
          celda: f.celdas[j],
        }));
      })(),
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Los rectángulos que se le piden al canvas
// ─────────────────────────────────────────────────────────────────────────────

export interface Pedazo {
  fila: number;
  celda: number;
  /** El rectángulo que se toma de la foto original. */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** El tamaño del lienzo de salida. */
  dw: number;
  dh: number;
}

/**
 * A qué tamaño se dibuja cada pedazo.
 *
 * **Al doble de lo que se muestra**, por las pantallas finas: un pedazo de 268 px
 * en el mail se sube de 536. Es la misma cuenta que `ANCHO_MAX` hace para una
 * foto suelta (536 útiles ⇒ 1072 en retina).
 *
 * 🔴 **Nunca se agranda.** Si la foto original no da para el doble, se usa lo que
 * hay: escalar para arriba no agrega información, agrega bytes —y acá los bytes
 * se pagan por destinatario y por pedazo.
 */
export const escalaDe = (natAncho: number, anchoUtil: number): number =>
  natAncho > 0 ? Math.min(1, (2 * anchoUtil) / natAncho) : 1;

/**
 * Qué rectángulo de la foto original va a parar a cada pedazo.
 *
 * Los rectángulos **embaldosan la foto**: el borde de uno es el arranque del que
 * sigue y el último llega al píxel final. Sin eso, cortar en tres deja dos
 * franjas de la imagen sin dibujar —o las dibuja dos veces— y se ve como una
 * costura.
 */
export function pedazosDe(
  filas: readonly FilaMosaico[] | undefined,
  natAncho: number,
  natAlto: number,
  escala: number,
): Pedazo[] {
  const g = normalizar(filas);
  const alturas = repartir(g.map((f) => f.alto), natAlto);
  const out: Pedazo[] = [];
  let sy = 0;
  g.forEach((f, i) => {
    const sh = alturas[i];
    const anchos = repartir(f.celdas.map((c) => c.ancho), natAncho);
    let sx = 0;
    anchos.forEach((sw, j) => {
      out.push({
        fila: i,
        celda: j,
        sx,
        sy,
        sw,
        sh,
        dw: Math.max(1, Math.round(sw * escala)),
        dh: Math.max(1, Math.round(sh * escala)),
      });
      sx += sw;
    });
    sy += sh;
  });
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo que hace el editor con los cortes
//
// Viven acá y no en el componente por lo mismo que `armarPlano`: son cuentas con
// números, se pueden ejercer sin abrir un navegador, y son justo donde se rompe
// la invariante de que los pedazos embaldosen.
// ─────────────────────────────────────────────────────────────────────────────

/** Los bordes acumulados de una lista de tamaños: dónde cae cada corte, en %. */
export const bordes = (partes: readonly number[]): number[] => {
  const out: number[] = [];
  let acum = 0;
  for (let i = 0; i < partes.length - 1; i++) {
    acum += partes[i];
    out.push(acum);
  }
  return out;
};

/** Parte en dos, por la mitad. Devuelve la lista nueva. */
const partir = <T extends { ancho?: number; alto?: number }>(
  lista: readonly T[],
  i: number,
  clave: "ancho" | "alto",
  nuevo: (mitad: number) => T,
): T[] => {
  const v = (lista[i]?.[clave] as number | undefined) ?? 0;
  const a = Math.round(v / 2);
  return [
    ...lista.slice(0, i),
    { ...lista[i], [clave]: a } as T,
    nuevo(v - a),
    ...lista.slice(i + 1),
  ];
};

/**
 * Parte una banda en dos, de arriba a abajo.
 *
 * 🔑 **La banda de abajo hereda las columnas de la de arriba, sin sus pedazos.**
 * Heredar los `url` dejaría dos bandas mostrando la MISMA franja de la foto, que
 * es exactamente el error que nadie ve hasta que el mail está mandado. El link y
 * el texto alternativo sí se heredan: son del destino, no de la imagen.
 */
export function partirFila(filas: readonly FilaMosaico[], i: number): FilaMosaico[] {
  if (filas.length >= MAX_FILAS || !filas[i]) return [...filas];
  return partir(filas, i, "alto", (mitad) => ({
    alto: mitad,
    celdas: filas[i].celdas.map((c) => ({ ancho: c.ancho, enlace: c.enlace, alt: c.alt })),
  }));
}

/** Parte una columna de una banda en dos. Mismo criterio con los pedazos. */
export function partirCelda(filas: readonly FilaMosaico[], f: number, i: number): FilaMosaico[] {
  const fila = filas[f];
  if (!fila || fila.celdas.length >= MAX_CELDAS || !fila.celdas[i]) return [...filas];
  const celdas = partir(fila.celdas, i, "ancho", (mitad) => ({
    ancho: mitad,
    enlace: fila.celdas[i].enlace,
    alt: fila.celdas[i].alt,
  }));
  return filas.map((x, k) => (k === f ? { ...x, celdas } : x));
}

/** Saca una banda y le regala su alto a la de al lado. Nunca deja cero bandas. */
export function quitarFila(filas: readonly FilaMosaico[], i: number): FilaMosaico[] {
  if (filas.length <= 1 || !filas[i]) return [...filas];
  const resto = filas.filter((_, k) => k !== i);
  const vecina = i === 0 ? 0 : i - 1;
  return resto.map((f, k) => (k === vecina ? { ...f, alto: f.alto + filas[i].alto } : f));
}

/** Saca una columna de una banda y le regala su ancho a la de al lado. */
export function quitarCelda(filas: readonly FilaMosaico[], f: number, i: number): FilaMosaico[] {
  const fila = filas[f];
  if (!fila || fila.celdas.length <= 1 || !fila.celdas[i]) return [...filas];
  const resto = fila.celdas.filter((_, k) => k !== i);
  const vecina = i === 0 ? 0 : i - 1;
  const celdas = resto.map((c, k) => (k === vecina ? { ...c, ancho: c.ancho + fila.celdas[i].ancho } : c));
  return filas.map((x, k) => (k === f ? { ...x, celdas } : x));
}

/**
 * Mueve el corte número `i` (el que separa la parte `i` de la `i+1`) a `destino`,
 * medido desde el arranque en %.
 *
 * 🔴 **Sólo se reparten esas dos partes**: lo que una gana, la otra lo pierde, y
 * las demás no se enteran. Un corte que corriera a todas dejaría que arrastrar la
 * primera línea moviera la última banda del mail.
 *
 * El mínimo de cada lado es `MIN_PCT`, así que un corte arrastrado hasta el borde
 * frena solo en vez de dejar una banda de cero.
 */
function moverCorte(partes: readonly number[], i: number, destino: number): number[] {
  if (i < 0 || i + 1 >= partes.length) return [...partes];
  const antes = partes.slice(0, i).reduce((a, b) => a + b, 0);
  const par = partes[i] + partes[i + 1];
  const rel = Math.round(destino) - antes;
  const primero = Math.min(par - MIN_PCT, Math.max(MIN_PCT, rel));
  return partes.map((v, k) => (k === i ? primero : k === i + 1 ? par - primero : v));
}

/** El corte horizontal `i`, a `destino`% del alto de la foto. */
export function moverCorteFila(filas: readonly FilaMosaico[], i: number, destino: number): FilaMosaico[] {
  const altos = moverCorte(filas.map((f) => f.alto), i, destino);
  return filas.map((f, k) => ({ ...f, alto: altos[k] }));
}

/** El corte vertical `i` de la banda `f`, a `destino`% del ancho de la foto. */
export function moverCorteCelda(
  filas: readonly FilaMosaico[],
  f: number,
  i: number,
  destino: number,
): FilaMosaico[] {
  const fila = filas[f];
  if (!fila) return [...filas];
  const anchos = moverCorte(fila.celdas.map((c) => c.ancho), i, destino);
  return filas.map((x, k) => (k === f ? { ...x, celdas: x.celdas.map((c, j) => ({ ...c, ancho: anchos[j] })) } : x));
}

/**
 * La misma grilla, con todos los pedazos tirados.
 *
 * Se llama cada vez que un corte se mueve: los pedazos que había son de la grilla
 * ANTERIOR, y dejarlos puestos haría que el mail dibujara los cortes viejos
 * mientras el editor muestra los nuevos. Sin pedazos, el mail vuelve a mostrar la
 * foto entera hasta que alguien vuelva a cortar — que es la única salida que no
 * miente. El link y el texto alternativo se quedan: son del destino.
 */
export const tirarPedazos = (filas: readonly FilaMosaico[]): FilaMosaico[] =>
  filas.map((f) => ({ ...f, celdas: f.celdas.map(({ url: _url, ...resto }) => resto) }));
