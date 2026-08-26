// La geometría de recortar una foto a un formato. **Puro: sin DOM, sin canvas.**
//
// Vive separado del `<canvas>` a propósito: es lo único de todo el recorte que un
// script de Node puede probar. El dibujo (`lib/imagenes.ts`) es API de navegador
// y no se puede ejercitar sin un navegador, así que todo lo que se pueda decidir
// con números se decide acá.
//
// 🔑 De acá sale también el PREVIEW del editor, sin dibujar nada: un `object-fit:
// cover` con `object-position: 50% <pos>%` hace exactamente esta misma cuenta, y
// por eso lo que se ve mientras se arrastra es lo que va a quedar. Verificado
// poniendo los dos al lado en Chrome, en cuatro posiciones.
//
// ⚠️ Es un **cover**, nunca un stretch: la foto no se deforma jamás. Lo que
// sobra se corta, y qué se corta lo decide el deslizador de encuadre.

/** Los formatos que ofrece el editor. La clave es la relación, para que se lea. */
export type Formato = "16:9" | "1:1" | "4:5";

/**
 * Qué parte de la foto se conserva, de 0 a 100. **50 = centrado**, que es el
 * default y lo que hacía el recorte antes de que esto existiera.
 *
 * Existe porque el centrado automático corta cabezas: en un retrato llevado a
 * 16:9, el centro geométrico de la foto suele ser el torso.
 *
 * 🔑 **Es UN número y se aplica al eje que sobra**, no dos controles. En un
 * recorte cover sólo puede sobrar un eje: si la foto es más alta de lo que el
 * formato pide, sobra alto y el número sube y baja el recorte; si es más ancha,
 * sobra ancho y lo corre a los costados. Nunca sobran los dos, así que un
 * segundo control sería siempre una perilla muerta.
 *
 * ⚠️ Empezó siendo tres opciones (arriba · centro · abajo) y duró unas horas:
 * con tres, encuadrar una cara es elegir el menos malo de tres. Es continuo por
 * pedido de Bruno el mismo día.
 */
export const POS_CENTRO = 50;

/** Cuál de los dos ejes es el que se puede mover en este recorte. */
export type EjeSobrante = "vertical" | "horizontal" | "ninguno";

/**
 * Qué eje sobra al llevar esta foto a este formato — o sea, qué mueve el
 * deslizador y cómo hay que rotularlo.
 *
 * Vive acá, con la geometría, porque la respuesta sale de la misma cuenta que el
 * recorte: si la decidiera la pantalla por su lado, habría dos definiciones de
 * "qué se puede mover" y un día dirían cosas distintas.
 */
export function ejeSobrante(natAncho: number, natAlto: number, ratio: number): EjeSobrante {
  if (!(natAncho > 0) || !(natAlto > 0)) return "ninguno";
  const rNat = natAncho / natAlto;
  // Un píxel de diferencia no es un encuadre que alguien quiera elegir.
  if (Math.abs(rNat - ratio) < 0.005) return "ninguno";
  return rNat > ratio ? "horizontal" : "vertical";
}

export const FORMATOS: Record<Formato, { label: string; ratio: number }> = {
  // 16:9 y no 3:2: el `hero` de este motor dibuja la banda con foto a 280 px de
  // alto sobre 600 de ancho, o sea ≈16:8,4. Una foto recortada 16:9 al lado de
  // una portada se ve de la misma familia; una 3:2 sale 55 px más alta y canta.
  "16:9": { label: "Horizontal", ratio: 16 / 9 },
  // El cuadrado del slot `celda` del pack de fotos (640×640).
  "1:1": { label: "Cuadrada", ratio: 1 },
  // 4:5 es el retrato del slot `producto` (760×950) y el vertical con el que ya
  // vienen las fotos de indumentaria. Va separado del cuadrado y no colapsado en
  // un "cuadrado o vertical": son las dos formas en las que de verdad llega una
  // foto de producto, y colapsarlas obliga a cuadrar un retrato.
  "4:5": { label: "Vertical", ratio: 4 / 5 },
};

/**
 * El ancho máximo de salida, en píxeles.
 *
 * El mail mide 600 y el ancho útil son 536 CSS px ⇒ 1072 en una pantalla retina.
 * 1200 lo cubre con margen y es el mismo orden que el pack de fotos de stock,
 * que se bajó a 1000 después de medir que a 1200 no se veía ninguna diferencia
 * a 600 px de ancho.
 *
 * 🔴 **Nunca se agranda.** Una foto de 400 px sale de 400: escalar para arriba
 * no agrega información, agrega bytes y la deja blanda.
 */
export const ANCHO_MAX = 1200;

export interface Recorte {
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
 * Qué rectángulo de la foto original va a parar a qué lienzo.
 *
 * `ratio` ausente = no se recorta nada, sólo se achica si hace falta. Es el modo
 * que usa toda subida (una foto de celular de 4000 px viaja entera a cada
 * casilla, y el egress se paga por destinatario).
 */
export function encuadre(
  natAncho: number,
  natAlto: number,
  ratio: number | undefined,
  anchoMax = ANCHO_MAX,
  pos: number = POS_CENTRO,
): Recorte {
  // Una foto que todavía no cargó mide 0×0 y dividir por eso da NaN, que
  // terminaría en un `<canvas width="NaN">` y una imagen en blanco en el mail de
  // otra persona. Se frena acá y no en el llamador.
  if (!(natAncho > 0) || !(natAlto > 0)) return { sx: 0, sy: 0, sw: 0, sh: 0, dw: 0, dh: 0 };

  if (ratio === undefined) {
    const dw = Math.min(natAncho, anchoMax);
    return {
      sx: 0,
      sy: 0,
      sw: natAncho,
      sh: natAlto,
      dw,
      dh: Math.max(1, Math.round((natAlto * dw) / natAncho)),
    };
  }

  const rNat = natAncho / natAlto;
  // El deslizador puede llegar con cualquier cosa (queda guardado en el Json del
  // bloque): se acota acá, que es el único lugar por el que pasa todo.
  const p = Math.min(100, Math.max(0, Number.isFinite(pos) ? pos : POS_CENTRO));
  let sx = 0;
  let sy = 0;
  let sw = natAncho;
  let sh = natAlto;

  if (rNat > ratio) {
    // Sobra ANCHO: se corre a los costados. 0 = pegado a la izquierda.
    sw = Math.round(natAlto * ratio);
    sx = Math.round(((natAncho - sw) * p) / 100);
  } else if (rNat < ratio) {
    // Sobra ALTO: sube y baja. 0 = pegado arriba.
    sh = Math.round(natAncho / ratio);
    sy = Math.round(((natAlto - sh) * p) / 100);
  }

  const dw = Math.min(sw, anchoMax);
  return { sx, sy, sw, sh, dw, dh: Math.max(1, Math.round(dw / ratio)) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Recortar el AIRE: llevar una imagen al borde de su tinta
//
// Es un recorte distinto del de arriba y por eso vive aparte: `encuadre()`
// contesta "llevame esta foto a 16:9", que es una decisión de quien arma el
// mail; esto contesta "sacale el vacío que tiene adentro", que no es una
// decisión de nadie — es un defecto del archivo.
//
// 🔴 **De dónde salió.** Medido el 26-ago-2026 sobre los cuatro logos que hay
// en uso: el de BDI en Blob es 1080×1350 con la tinta en 1045×408 (465 px de
// aire arriba y 477 abajo), y los tres que devuelve Tiendanube en `/store`
// tienen lo mismo — Zattia 4506×3940 con tinta 2583×2880, Stunned 2397×959 con
// tinta 2060×303. Así vienen los logos de tienda, y ese aire lo paga el
// encabezado de cada mail: el de BDI ocupaba 120×150 px para una marca de
// 116×45. Ni `logoAncho` ni el `padY` del bloque lo pueden sacar, porque el
// vacío está adentro de los píxeles.
// ─────────────────────────────────────────────────────────────────────────────

/** El rectángulo que ocupa la tinta, en píxeles del original. Ambos extremos incluidos. */
export interface CajaTinta {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Cuánto alfa hace falta para que un píxel cuente como tinta.
 *
 * No es 0: un PNG exportado de Illustrator deja un halo de 1-2 de alfa alrededor
 * del trazo, y con el umbral en 0 la caja sale del tamaño del archivo y el
 * recorte no saca nada.
 */
export const TOL_ALFA = 16;

/**
 * Cuánto se tiene que apartar un píxel OPACO del fondo para contar como tinta.
 *
 * Sólo se usa cuando el margen es de color liso (un logo exportado sobre
 * blanco). Un JPEG de un logo sobre blanco tiene el blanco a 250-255 por el
 * re-encode, así que el umbral no puede ser 0.
 */
export const TOL_COLOR = 24;

/**
 * Qué proporción del archivo tiene que quedar para que valga la pena recortar.
 *
 * Arriba de esto no hay aire que sacar y `recorteDeAire` devuelve `null`. Sin
 * este freno, apretar el botón sobre un logo ya recortado sube un archivo nuevo
 * —una clave de Blob que ya no se puede borrar, porque su URL puede estar en un
 * mail entregado— y una vuelta de re-encode, para dejar la misma imagen.
 */
const SIN_AIRE = 0.99;

/** La diferencia de color más grande entre dos píxeles, canal por canal. */
const distancia = (
  r: number, g: number, b: number,
  rr: number, rg: number, rb: number,
) => Math.max(Math.abs(r - rr), Math.abs(g - rg), Math.abs(b - rb));

/**
 * El color de fondo del que se mide el aire: el que tienen las CUATRO esquinas.
 *
 * `null` cuando no coinciden, y eso significa "el margen no es liso" ⇒ el
 * llamador se queda sólo con el alfa. Es la respuesta correcta y no un problema:
 * una imagen con las esquinas distintas no tiene un margen de color que sacar, y
 * recortar por color ahí cortaría la foto.
 */
function fondoDe(rgba: ArrayLike<number>, ancho: number, alto: number): number[] | null {
  const px = (x: number, y: number) => {
    const i = (y * ancho + x) * 4;
    return [rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]];
  };
  const ref = px(0, 0);
  for (const [x, y] of [[ancho - 1, 0], [0, alto - 1], [ancho - 1, alto - 1]] as const) {
    const o = px(x, y);
    // Dos esquinas transparentes son el mismo fondo aunque su RGB no coincida:
    // un PNG guarda cualquier cosa abajo de un alfa 0.
    if (ref[3] <= TOL_ALFA && o[3] <= TOL_ALFA) continue;
    if (o[3] !== ref[3] || distancia(o[0], o[1], o[2], ref[0], ref[1], ref[2]) > TOL_COLOR) return null;
  }
  return ref;
}

/**
 * Dónde empieza y dónde termina la tinta de una imagen. `null` = está vacía.
 *
 * **Puro: recibe el RGBA crudo, no un canvas.** Es lo mismo que hace el resto de
 * este archivo y por el mismo motivo — así un script de Node lo puede ejercer
 * con un array armado a mano (`scripts/probar-recorte.ts`), que es la única
 * forma de probar un recorte sin navegador.
 *
 * 🔴 **El alfa se mira PRIMERO, y el color sólo entre los píxeles opacos.** El
 * logo que Tiendanube devuelve para BDI es tinta BLANCA sobre transparente:
 * cualquier regla del tipo "tinta = lo que no es blanco" —o aplanar sobre blanco
 * antes de medir— borra el logo entero y deja la caja vacía. Sobre un fondo
 * transparente, tener alfa YA es ser tinta, sin mirar de qué color.
 */
export function cajaDeTinta(
  rgba: ArrayLike<number>,
  ancho: number,
  alto: number,
): CajaTinta | null {
  if (!(ancho > 0) || !(alto > 0) || rgba.length < ancho * alto * 4) return null;

  const fondo = fondoDe(rgba, ancho, alto);
  // Fondo opaco ⇒ el aire es de color y hay que compararlo. Fondo transparente,
  // o esquinas que no coinciden ⇒ el único criterio confiable es el alfa.
  const porColor = fondo !== null && fondo[3] > TOL_ALFA;

  let x0 = ancho, y0 = alto, x1 = -1, y1 = -1;
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = (y * ancho + x) * 4;
      if (rgba[i + 3] <= TOL_ALFA) continue;
      if (porColor && distancia(rgba[i], rgba[i + 1], rgba[i + 2], fondo[0], fondo[1], fondo[2]) <= TOL_COLOR) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/**
 * La caja de tinta, como recorte listo para el canvas. `null` = no hay aire.
 *
 * Devuelve el mismo `Recorte` que `encuadre()` para que el módulo del canvas
 * dibuje los dos con el mismo código: qué rectángulo se toma y de qué tamaño
 * sale es toda la decisión, y toda la decisión vive acá.
 *
 * ⚠️ **Al ras, sin margen.** El aire alrededor del logo lo pone el `padY` del
 * bloque, que se edita sin volver a subir nada: los píxeles para la marca, el
 * CSS para el aire. Un margen horneado en el archivo es exactamente el problema
 * que esto vino a arreglar.
 */
export function recorteDeAire(
  natAncho: number,
  natAlto: number,
  caja: CajaTinta | null,
  anchoMax = ANCHO_MAX,
): Recorte | null {
  if (!(natAncho > 0) || !(natAlto > 0) || !caja) return null;
  // La caja puede venir de una medición hecha sobre una copia achicada: se acota
  // acá, que es el único lugar por el que pasa todo, igual que el deslizador.
  const sx = Math.min(Math.max(0, Math.round(caja.x0)), natAncho - 1);
  const sy = Math.min(Math.max(0, Math.round(caja.y0)), natAlto - 1);
  const sw = Math.min(Math.max(1, Math.round(caja.x1) - sx + 1), natAncho - sx);
  const sh = Math.min(Math.max(1, Math.round(caja.y1) - sy + 1), natAlto - sy);
  if (sw * sh >= natAncho * natAlto * SIN_AIRE) return null;
  const dw = Math.min(sw, anchoMax);
  return { sx, sy, sw, sh, dw, dh: Math.max(1, Math.round((sh * dw) / sw)) };
}
