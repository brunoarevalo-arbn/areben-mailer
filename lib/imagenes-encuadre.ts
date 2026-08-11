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
